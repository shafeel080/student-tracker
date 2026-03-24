import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Calculator, Plus } from "lucide-react";
import { toast } from "sonner";

export default function CoManageCalculator({ students = [], coManagedStudents = [] }) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [applyingMentorId, setApplyingMentorId] = useState(null);

  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: ['funding-transactions-calculator'],
    queryFn: () => base44.entities.FundingTransaction.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return user;
    }
  });

  const createDeductionMutation = useMutation({
    mutationFn: async ({ mentorId, mentorName, amount }) => {
      const student = students.find(s => s.id === selectedStudentId);
      if (!currentUser) throw new Error('User not authenticated');

      const deduction = await base44.entities.MentorDeduction.create({
        mentor_id: mentorId,
        mentor_name: mentorName,
        student_id: selectedStudentId,
        student_name: student?.full_name,
        student_code: student?.student_code,
        amount_usd: amount,
        reason: 'Pro-rata withdrawal deduction',
        created_by_id: currentUser.id,
        created_by_name: currentUser.full_name,
        notes: `Calculated from withdrawal of $${parseFloat(withdrawalAmount).toFixed(2)}`
      });

      return deduction;
    },
    onSuccess: (deduction) => {
      queryClient.invalidateQueries(['mentor-deductions']);
      toast.success(`Deduction created for ${deduction.mentor_name}`);
      setApplyingMentorId(null);
    },
    onError: (error) => {
      toast.error(`Failed to create deduction: ${error.message}`);
    }
  });

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [selectedStudentId, students]);

  const handleCalculate = () => {
    if (!selectedStudentId || !withdrawalAmount) {
      toast.error('Please select a student and enter a withdrawal amount');
      return;
    }

    if (parseFloat(withdrawalAmount) <= 0) {
      toast.error('Withdrawal amount must be greater than 0');
      return;
    }

    if (!selectedStudent?.co_mentors_details) {
      toast.error('Selected student has no co-mentor details');
      return;
    }

    setIsCalculating(true);

    try {
      let coMentors = [];
      try {
        coMentors = typeof selectedStudent.co_mentors_details === 'string'
          ? JSON.parse(selectedStudent.co_mentors_details)
          : selectedStudent.co_mentors_details;
      } catch (_) {
        throw new Error('Invalid co-mentor data format');
      }

      if (!Array.isArray(coMentors) || coMentors.length === 0) {
        throw new Error('No co-mentors found');
      }

      const amount = parseFloat(withdrawalAmount);
      const totalCombined = coMentors.reduce((sum, m) => sum + (m.net_deposit_contribution_usd || 0), 0);

      const calculatedResults = coMentors.map(mentor => {
        const mentorNet = mentor.net_deposit_contribution_usd || 0;
        const sharePercent = totalCombined > 0 ? (mentorNet / totalCombined) * 100 : (100 / coMentors.length);
        const withdrawalShare = totalCombined > 0
          ? amount * (mentorNet / totalCombined)
          : amount / coMentors.length;

        return {
          mentor_id: mentor.mentor_id,
          mentor_name: mentor.mentor_name,
          total_deposits: mentorNet,
          share_percent: sharePercent,
          withdrawal_share: withdrawalShare
        };
      });

      setResults(calculatedResults);
    } catch (error) {
      toast.error(`Calculation failed: ${error.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApplyDeduction = async (result) => {
    setApplyingMentorId(result.mentor_id);
    try {
      await createDeductionMutation.mutateAsync({
        mentorId: result.mentor_id,
        mentorName: result.mentor_name,
        amount: result.withdrawal_share
      });
    } finally {
      setApplyingMentorId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Pro-Rata Withdrawal Calculator
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">Calculate and apply proportional withdrawal deductions for co-managed students</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student-select">Co-Managed Student *</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a co-managed student" />
                </SelectTrigger>
                <SelectContent>
                  {coManagedStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name} ({student.student_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdrawal-amount">Withdrawal Amount (USD) *</Label>
              <Input
                id="withdrawal-amount"
                type="number"
                step="0.01"
                min="0"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleCalculate}
                disabled={isCalculating || !selectedStudentId || !withdrawalAmount}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isCalculating ? 'Calculating...' : 'Calculate'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Withdrawal Distribution Results</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Total Withdrawal: ${parseFloat(withdrawalAmount).toFixed(2)} | Student: {selectedStudent?.full_name}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Mentor Name</TableHead>
                    <TableHead className="font-semibold text-right">Total Deposits</TableHead>
                    <TableHead className="font-semibold text-right">Share %</TableHead>
                    <TableHead className="font-semibold text-right">Withdrawal Share</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.mentor_id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{result.mentor_name}</TableCell>
                      <TableCell className="text-right font-mono">${result.total_deposits.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{result.share_percent.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-semibold text-red-700">${result.withdrawal_share.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleApplyDeduction(result)}
                          disabled={applyingMentorId === result.mentor_id || createDeductionMutation.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {applyingMentorId === result.mentor_id ? 'Applying...' : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Apply
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Applied deductions will appear in:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Mentor's Funding Activities (as deduction records)</li>
                  <li>Quarter Closing calculations (subtracted from commission)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!results && selectedStudentId && !isCalculating && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-6 text-center text-gray-500">
            Enter withdrawal amount and click Calculate to see the distribution
          </CardContent>
        </Card>
      )}
    </div>
  );
}