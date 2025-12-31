import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";
import {
  getQuarterDates,
  getQuarterLabel,
  calculateQuarterNetDeposit,
  calculateQuarterCommission,
  calculateReleaseDate
} from "../components/utils/LedgerUtils";
import { toast } from "sonner";
import { logAction } from "../components/utils/AuditLogger";

export default function QuarterClosing() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['funding-transactions'],
    queryFn: () => base44.entities.FundingTransaction.list(),
    enabled: !!currentUser
  });

  const { data: ledgers = [] } = useQuery({
    queryKey: ['commission-ledgers'],
    queryFn: () => base44.entities.CommissionLedger.list('-created_date'),
    enabled: !!currentUser
  });

  const closeLedgerMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.CommissionLedger.create(data);
      await logAction('close_quarter', 'CommissionLedger', result.id, `Closed quarter ${data.quarter} for ${data.mentor_name}`, null, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['commission-ledgers']);
      toast.success('Quarter ledger created successfully');
    }
  });

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Get quarter dates
  const quarterDate = new Date(selectedYear, (selectedQuarter - 1) * 3, 1);
  const { start_date, end_date } = getQuarterDates(quarterDate);
  const quarterLabel = getQuarterLabel(selectedYear, selectedQuarter);

  // Check if quarter has ended
  const quarterEndDate = new Date(end_date);
  const currentDate = new Date();
  const isQuarterEnded = currentDate > quarterEndDate;

  // Get all mentors
  const mentors = users.filter(u => ['junior_mentor', 'senior_mentor'].includes(u.app_role));

  // Calculate mentor data
  const mentorData = mentors.map(mentor => {
    // Check if ledger already exists
    const existingLedger = ledgers.find(
      l => l.mentor_id === mentor.id && l.quarter === quarterLabel
    );

    if (existingLedger) {
      return { mentor, ledger: existingLedger, isClosed: true };
    }

    // Calculate live data
    const netDeposit = calculateQuarterNetDeposit(mentor.id, start_date, end_date, transactions);

    // Get previous quarter's buffer
    const prevQuarter = selectedQuarter === 1 ? 4 : selectedQuarter - 1;
    const prevYear = selectedQuarter === 1 ? selectedYear - 1 : selectedYear;
    const prevQuarterLabel = getQuarterLabel(prevYear, prevQuarter);
    const prevLedger = ledgers.find(l => l.mentor_id === mentor.id && l.quarter === prevQuarterLabel);
    const bufferCarriedIn = prevLedger?.commission_buffer_usd || 0;

    const commission = calculateQuarterCommission(netDeposit, bufferCarriedIn);

    return {
      mentor,
      netDeposit,
      bufferCarriedIn,
      ...commission,
      isClosed: false
    };
  });

  const handleGenerateLedger = (mentorInfo) => {
    const ledgerData = {
      mentor_id: mentorInfo.mentor.id,
      mentor_name: mentorInfo.mentor.full_name,
      quarter: quarterLabel,
      year: selectedYear,
      quarter_number: selectedQuarter,
      start_date,
      end_date,
      net_deposit_usd: mentorInfo.netDeposit,
      gross_commission_usd: mentorInfo.gross_commission_usd,
      commission_release_usd: mentorInfo.commission_release_usd,
      commission_buffer_usd: mentorInfo.commission_buffer_usd,
      buffer_carried_in_usd: mentorInfo.bufferCarriedIn,
      buffer_carried_out_usd: mentorInfo.commission_buffer_usd,
      is_closed: true,
      is_released: false,
      release_date: calculateReleaseDate(end_date),
      closed_by_id: currentUser.id,
      closed_by_name: currentUser.full_name,
      closed_at: new Date().toISOString()
    };

    closeLedgerMutation.mutate(ledgerData);
  };

  const handleBulkGenerate = () => {
    const unclosedMentors = mentorData.filter(m => !m.isClosed);
    if (unclosedMentors.length === 0) {
      toast.info('All mentors already have ledgers for this quarter');
      return;
    }

    if (window.confirm(`Generate ledgers for ${unclosedMentors.length} mentors?`)) {
      unclosedMentors.forEach(mentorInfo => {
        handleGenerateLedger(mentorInfo);
      });
    }
  };

  const years = Array.from({ length: 7 }, (_, i) => 2024 + i);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Quarter Closing</h1>
          <p className="text-gray-600 mt-2 text-base">Generate commission ledgers for completed quarters</p>
        </div>

        {/* Quarter Selection */}
        <Card className="border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50">
            <CardTitle className="text-lg font-semibold tracking-tight">Select Quarter</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Year</label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Quarter</label>
                <Select value={selectedQuarter.toString()} onValueChange={(v) => setSelectedQuarter(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                    <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                    <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700 mb-2">Period</div>
                <div className="text-base font-semibold text-gray-900">
                  {new Date(start_date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC' })} - {new Date(end_date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC' })}
                </div>
              </div>

              <Button 
                onClick={handleBulkGenerate} 
                disabled={!isQuarterEnded}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Generate All Ledgers
              </Button>
            </div>
            {!isQuarterEnded && (
              <p className="text-sm text-amber-600 mt-2">
                ⚠️ Ledgers can only be generated after the quarter has ended (after {new Date(end_date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC' })})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Mentors Table */}
        <Card className="border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50">
            <CardTitle className="text-lg font-semibold tracking-tight">Mentor Commission Summary - {quarterLabel}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Mentor</TableHead>
                    <TableHead className="font-semibold">Net Deposit</TableHead>
                    <TableHead className="font-semibold">Buffer In</TableHead>
                    <TableHead className="font-semibold">Gross (4%)</TableHead>
                    <TableHead className="font-semibold">Release (75%)</TableHead>
                    <TableHead className="font-semibold">Buffer (25%)</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mentorData.map((data) => (
                    <TableRow key={data.mentor.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium">{data.mentor.full_name}</TableCell>
                      <TableCell className="font-semibold">
                        ${data.isClosed ? data.ledger.net_deposit_usd.toFixed(2) : data.netDeposit.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        ${data.isClosed ? data.ledger.buffer_carried_in_usd.toFixed(2) : data.bufferCarriedIn.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${data.isClosed ? data.ledger.gross_commission_usd.toFixed(2) : data.gross_commission_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-emerald-600 font-semibold">
                        ${data.isClosed ? data.ledger.commission_release_usd.toFixed(2) : data.commission_release_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-amber-600 font-semibold">
                        ${data.isClosed ? data.ledger.commission_buffer_usd.toFixed(2) : data.commission_buffer_usd.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {data.isClosed ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            <Lock className="h-3 w-3 mr-1" />
                            CLOSED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            OPEN
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!data.isClosed && (
                          <Button
                            size="sm"
                            onClick={() => handleGenerateLedger(data)}
                            disabled={!isQuarterEnded || closeLedgerMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                          >
                            Generate Ledger
                          </Button>
                        )}
                        {data.isClosed && (
                          <span className="text-sm text-gray-500">
                            <CheckCircle className="h-4 w-4 inline text-emerald-600" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}