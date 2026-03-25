import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, PlusCircle, MinusCircle, ListFilter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getEffectiveUser } from "@/components/utils/ImpersonationContext";

export default function CommissionTools() {
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const realUser = await base44.auth.me();
      setCurrentUser(getEffectiveUser(realUser));
    };
    fetchUser();
  }, []);

  // ─── Pro-Rata Calculator ──────────────────────────────────────────────────
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [proRataResults, setProRataResults] = useState(null);

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-tools'],
    queryFn: () => base44.entities.Student.list(),
    enabled: !!currentUser,
  });

  const { data: fundingTransactions = [] } = useQuery({
    queryKey: ['funding-tx-for-tools'],
    queryFn: () => base44.entities.FundingTransaction.list(),
    enabled: !!currentUser,
  });

  const coManagedStudents = useMemo(() => students.filter(s => {
    if (!s.co_mentors_details) return false;
    try {
      const co = JSON.parse(typeof s.co_mentors_details === 'string' ? s.co_mentors_details : JSON.stringify(s.co_mentors_details));
      return Array.isArray(co) && co.length > 0;
    } catch (_) { return false; }
  }), [students]);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [selectedStudentId, students]);

  const handleCalculate = () => {
    if (!selectedStudentId || !withdrawalAmount) {
      toast.error('Select a student and enter a withdrawal amount');
      return;
    }
    const amount = parseFloat(withdrawalAmount);
    if (amount <= 0) { toast.error('Withdrawal amount must be > 0'); return; }
    if (!selectedStudent?.co_mentors_details) { toast.error('Student has no co-mentor data'); return; }

    let coMentors = [];
    try {
      coMentors = typeof selectedStudent.co_mentors_details === 'string'
        ? JSON.parse(selectedStudent.co_mentors_details)
        : selectedStudent.co_mentors_details;
    } catch (_) { toast.error('Invalid co-mentor data'); return; }

    const primaryMentorId = selectedStudent.primary_mentor_id;
    const mentorDeposits = {};
    coMentors.forEach(cm => { mentorDeposits[cm.mentor_id] = 0; });
    mentorDeposits[primaryMentorId] = 0;

    fundingTransactions
      .filter(t => t.student_id === selectedStudentId && t.type === 'DEPOSIT' && t.status === 'APPROVED')
      .forEach(t => {
        const mid = t.initiating_mentor_id || primaryMentorId;
        if (mentorDeposits.hasOwnProperty(mid)) mentorDeposits[mid] += t.amount_usd || 0;
      });

    const totalDeposits = Object.values(mentorDeposits).reduce((s, v) => s + v, 0);
    if (totalDeposits === 0) { toast.error('No approved deposits found'); return; }

    const allMentors = [...coMentors];
    if (!coMentors.some(cm => cm.mentor_id === primaryMentorId)) {
      allMentors.push({ mentor_id: primaryMentorId, mentor_name: selectedStudent.primary_mentor_name });
    }

    setProRataResults(
      allMentors
        .filter(m => (mentorDeposits[m.mentor_id] || 0) > 0)
        .map(m => ({
          mentor_id: m.mentor_id,
          mentor_name: m.mentor_name,
          total_deposits: mentorDeposits[m.mentor_id] || 0,
          share_percent: (mentorDeposits[m.mentor_id] / totalDeposits) * 100,
          withdrawal_share: amount * (mentorDeposits[m.mentor_id] / totalDeposits),
        }))
    );
  };

  // ─── Manual Commission Adjustment ────────────────────────────────────────
  const [adjMentorId, setAdjMentorId] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjType, setAdjType] = useState('ADDITION');
  const [adjNotes, setAdjNotes] = useState('');

  const { data: mentors = [] } = useQuery({
    queryKey: ['mentor-users-for-tools'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAllUsers', {});
      return (res.data?.users || []).filter(u => ['junior_mentor', 'senior_mentor', 'subjunior_mentor'].includes(u.app_role));
    },
    enabled: !!currentUser,
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ['manual-commission-adjustments'],
    queryFn: () => base44.entities.ManualCommissionAdjustment.list('-created_date'),
    enabled: !!currentUser,
  });

  const createAdjMutation = useMutation({
    mutationFn: async () => {
      const mentor = mentors.find(m => m.id === adjMentorId);
      if (!mentor) throw new Error('Mentor not found');
      const raw = parseFloat(adjAmount);
      if (!raw || raw === 0) throw new Error('Invalid amount');
      const finalAmount = adjType === 'DEDUCTION' ? -Math.abs(raw) : Math.abs(raw);
      return base44.entities.ManualCommissionAdjustment.create({
        mentor_id: mentor.id,
        mentor_name: mentor.full_name,
        amount_usd: finalAmount,
        reason: adjReason,
        adjustment_type: adjType,
        notes: adjNotes,
        created_by_id: currentUser.id,
        created_by_name: currentUser.full_name,
      });
    },
    onSuccess: () => {
      toast.success('Adjustment added');
      setAdjMentorId(''); setAdjAmount(''); setAdjReason(''); setAdjNotes(''); setAdjType('ADDITION');
      queryClient.invalidateQueries(['manual-commission-adjustments']);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Commission Tools</h1>

        {/* Pro-Rata Calculator */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-blue-600" />
              Pro-Rata Withdrawal Calculator
            </CardTitle>
            <CardDescription>Read-only view of proportional distributions for co-managed students.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Co-Managed Student *</Label>
                <Select value={selectedStudentId} onValueChange={v => { setSelectedStudentId(v); setProRataResults(null); }}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {coManagedStudents.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.student_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Withdrawal Amount (USD) *</Label>
                <Input type="number" step="0.01" min="0" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} placeholder="Enter amount" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCalculate} disabled={!selectedStudentId || !withdrawalAmount} className="w-full bg-blue-600 hover:bg-blue-700">
                  Calculate Distribution
                </Button>
              </div>
            </div>

            {proRataResults && (
              <div className="rounded-md border bg-white mt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Mentor</TableHead>
                      <TableHead className="text-right">Total Deposits</TableHead>
                      <TableHead className="text-right">Share %</TableHead>
                      <TableHead className="text-right">Withdrawal Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proRataResults.map(r => (
                      <TableRow key={r.mentor_id}>
                        <TableCell className="font-medium">{r.mentor_name}</TableCell>
                        <TableCell className="text-right font-mono">${r.total_deposits.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">{r.share_percent.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-semibold text-red-700">${r.withdrawal_share.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Commission Adjustment */}
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlusCircle className="h-5 w-5 text-purple-600" />
              Manual Commission Adjustment
            </CardTitle>
            <CardDescription>Add or deduct commission for a mentor. Affects quarterly ledger release/buffer calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mentor *</Label>
                <Select value={adjMentorId} onValueChange={setAdjMentorId}>
                  <SelectTrigger><SelectValue placeholder="Select mentor" /></SelectTrigger>
                  <SelectContent>
                    {mentors.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name} — {m.app_role.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={adjType} onValueChange={setAdjType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADDITION">Addition</SelectItem>
                    <SelectItem value="DEDUCTION">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (USD) *</Label>
                <Input type="number" step="0.01" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="e.g. 150.00" />
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="e.g. Q1 performance bonus" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea value={adjNotes} onChange={e => setAdjNotes(e.target.value)} rows={2} placeholder="Additional details..." />
            </div>
            <Button
              onClick={() => createAdjMutation.mutate()}
              disabled={createAdjMutation.isPending || !adjMentorId || !adjAmount || !adjReason}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {createAdjMutation.isPending ? 'Saving...' : 'Add Adjustment'}
            </Button>
          </CardContent>
        </Card>

        {/* Adjustments Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListFilter className="h-5 w-5 text-gray-600" />
              All Manual Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Date</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount (USD)</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No adjustments yet.</TableCell></TableRow>
                ) : (
                  adjustments.map(adj => (
                    <TableRow key={adj.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">{format(new Date(adj.created_date), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">{adj.mentor_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={adj.adjustment_type === 'ADDITION' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                          {adj.adjustment_type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${adj.amount_usd >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${adj.amount_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">{adj.reason}</TableCell>
                      <TableCell className="text-sm">{adj.created_by_name}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}