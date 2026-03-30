import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, TrendingDown, DollarSign, Award, Wallet, Eye, Users, Clock } from "lucide-react";
import FundingRequestForm from "../components/funding/FundingRequestForm";
import { 
  canCreateFundingTransaction,
  filterFundingTransactionsByRole 
} from "../components/utils/FundingAccessControl";
import { 
  calculateQuarterlyNetDepositAndCommission,
  getCurrentQuarterLabel,
  isWithinCurrentQuarter
} from "../components/utils/CommissionUtils";
import { filterStudentsByRole } from "../components/utils/StudentAccessControl";
import { getEffectiveUser } from "../components/utils/ImpersonationContext";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MyFundingRequests() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('my');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const realUser = await base44.auth.me();
      setCurrentUser(getEffectiveUser(realUser));
    };
    fetchUser();
  }, []);

  const { data: transactions = [] } = useQuery({
    queryKey: ['funding-transactions'],
    queryFn: () => base44.entities.FundingTransaction.list('-requested_at'),
    enabled: !!currentUser
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
    enabled: !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: false // Disabled to avoid 403 errors
  });

  const { data: pendingReferrals = [] } = useQuery({
    queryKey: ['my-pending-referrals'],
    queryFn: async () => {
      const all = await base44.entities.MentorReferral.list('-created_at');
      return all.filter(r => r.initiating_mentor_id === currentUser?.id && r.status === 'pending');
    },
    enabled: !!currentUser
  });

  const { data: manualAdjustments = [] } = useQuery({
    queryKey: ['my-manual-adjustments'],
    queryFn: () => base44.entities.ManualCommissionAdjustment.list('-created_date'),
    enabled: !!currentUser,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Refetch current user to ensure we have the latest upline_commission_percentage
      const freshUser = await base44.auth.me();
      const uplinePercentage = parseFloat(freshUser.upline_commission_percentage) || 0;

      // Update the data with fresh percentage
      const updatedData = {
        ...data,
        upline_commission_percentage: uplinePercentage
      };

      console.log('=== CREATING TRANSACTION ===');
      console.log('Logged in user:', freshUser.full_name, '(', freshUser.email, ')');
      console.log('User ID:', freshUser.id);
      console.log('User role:', freshUser.app_role);
      console.log('Raw upline_commission_percentage from DB:', freshUser.upline_commission_percentage);
      console.log('Parsed uplinePercentage:', uplinePercentage);
      console.log('Full freshUser object:', freshUser);
      console.log('Data being submitted:', updatedData);
      console.log('============================');

      return base44.entities.FundingTransaction.create(updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['funding-transactions']);
      setShowAddDialog(false);
      toast.success('Funding request submitted successfully');
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

  // Filter transactions based on user role
  const isAssistance = currentUser.app_role === 'assistance';
  
  let myTransactions, myStudents, teamTransactions;
  
  if (isAssistance && currentUser.assigned_mentor_id) {
    // Assistance users see transactions and students of their assigned mentor
    myTransactions = transactions.filter(t => t.primary_mentor_id === currentUser.assigned_mentor_id);
    myStudents = students.filter(s => s.primary_mentor_id === currentUser.assigned_mentor_id);
    teamTransactions = [];
  } else {
    // Filter MY transactions - by initiating_mentor_id or primary_mentor_id (covers assistance-submitted & legacy transactions)
    myTransactions = transactions.filter(t =>
      t.initiating_mentor_id === currentUser.id ||
      t.primary_mentor_id === currentUser.id
    );
    myStudents = students.filter(s => {
      if (s.primary_mentor_id === currentUser.id) return true;
      if (!s.co_mentors_details) return false;
      try {
        const co = Array.isArray(s.co_mentors_details) ? s.co_mentors_details : JSON.parse(s.co_mentors_details);
        return Array.isArray(co) && co.some(m => m.mentor_id === currentUser.id);
      } catch (_) { return false; }
    });

    // Filter TEAM transactions - transactions where I am senior mentor but NOT primary mentor
    teamTransactions = transactions.filter(t => 
      currentUser.app_role === 'senior_mentor' && 
      t.senior_mentor_id === currentUser.id &&
      t.primary_mentor_id !== currentUser.id
    );
  }

  // Calculate MY commission
  const commission = calculateQuarterlyNetDepositAndCommission(myTransactions, currentUser);
  const quarterLabel = getCurrentQuarterLabel();

  // Apply manual adjustments for current quarter
  const myAdjustments = manualAdjustments.filter(a =>
    a.mentor_id === currentUser.id && isWithinCurrentQuarter(a.created_date)
  );
  const adjustmentTotal = myAdjustments.reduce((sum, a) => sum + (a.amount_usd || 0), 0);
  const adjustedGross = commission.grossCommissionUsd + adjustmentTotal;
  const adjustedRelease = adjustedGross * 0.75;
  const adjustedBuffer = adjustedGross * 0.25;

  // Calculate TEAM commission - each transaction uses its own stored percentage
  const approvedTeamTransactions = teamTransactions.filter(t => 
    t.status === 'APPROVED' && isWithinCurrentQuarter(t.requested_at)
  );

  // Calculate commission per transaction
  const teamCommissionData = approvedTeamTransactions.map(t => {
    const amount = t.amount_usd || 0;
    const uplinePercentage = parseFloat(t.upline_commission_percentage) || 0;

    // Calculate commission for this specific transaction
    let netDepositImpact = t.type === 'DEPOSIT' ? amount : -amount;
    let grossCommission = (netDepositImpact * uplinePercentage) / 100;

    console.log('Team transaction calc:', {
      transactionId: t.id,
      mentorName: t.primary_mentor_name,
      type: t.type,
      amount,
      uplinePercentage,
      netDepositImpact,
      grossCommission
    });

    return {
      juniorMentorName: t.primary_mentor_name,
      netDeposit: netDepositImpact,
      grossCommission: grossCommission,
      release: grossCommission * 0.75,
      buffer: grossCommission * 0.25
    };
  });

  // Group by mentor for display
  const mentorSummaryMap = new Map();
  teamCommissionData.forEach(data => {
    if (!mentorSummaryMap.has(data.juniorMentorName)) {
      mentorSummaryMap.set(data.juniorMentorName, {
        juniorMentorName: data.juniorMentorName,
        netDeposit: 0,
        grossCommission: 0,
        release: 0,
        buffer: 0
      });
    }
    const summary = mentorSummaryMap.get(data.juniorMentorName);
    summary.netDeposit += data.netDeposit;
    summary.grossCommission += data.grossCommission;
    summary.release += data.release;
    summary.buffer += data.buffer;
  });

  const teamCommissionDataGrouped = Array.from(mentorSummaryMap.values());

  const totalTeamCommission = {
    netDeposit: teamCommissionDataGrouped.reduce((sum, data) => sum + data.netDeposit, 0),
    grossCommission: teamCommissionDataGrouped.reduce((sum, data) => sum + data.grossCommission, 0),
    release: teamCommissionDataGrouped.reduce((sum, data) => sum + data.release, 0),
    buffer: teamCommissionDataGrouped.reduce((sum, data) => sum + data.buffer, 0)
  };

  const canCreate = canCreateFundingTransaction(currentUser.app_role);
  const isSeniorMentor = currentUser.app_role === 'senior_mentor';

  const getReferralStatusColor = () => 'bg-orange-100 text-orange-800 border-orange-200';

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type) => {
    return type === 'DEPOSIT'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Funding Activities</h1>
            <p className="text-gray-600 mt-2 text-base">Manage your deposit and withdrawal requests</p>
          </div>
          {canCreate && activeTab === 'my' && (
            <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md" style={{ gridTemplateColumns: isSeniorMentor ? '1fr 1fr' : '1fr' }}>
            <TabsTrigger value="my">My Funding Requests</TabsTrigger>
            {isSeniorMentor && (
              <TabsTrigger value="team">Team Funding Requests</TabsTrigger>
            )}
          </TabsList>

          {/* My Funding Requests Tab */}
          <TabsContent value="my" className="space-y-6">
            {/* Commission Summary - hidden for assistance role */}
            {!isAssistance && (<Card className="border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="border-b border-blue-100">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-600" />
                  Commission Summary - {quarterLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Net Deposit</p>
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">${commission.netDepositUsd.toFixed(2)}</p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Gross Commission (4%)</p>
                      <Award className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">${commission.grossCommissionUsd.toFixed(2)}</p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Manual Adjustments</p>
                      <Wallet className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className={`text-2xl font-bold ${adjustmentTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {adjustmentTotal >= 0 ? '+' : ''}${adjustmentTotal.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{myAdjustments.length} adjustment(s)</p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Adjusted Gross</p>
                      <Award className="h-5 w-5 text-indigo-600" />
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">${adjustedGross.toFixed(2)}</p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Release (75%)</p>
                      <Wallet className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-green-600">${adjustedRelease.toFixed(2)}</p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-amber-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Buffer (25%)</p>
                      <Wallet className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold text-amber-600">${adjustedBuffer.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>)}

            {/* Transactions Table */}
            <Card className="border-gray-200">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-lg font-semibold">Request History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Requested</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Student</TableHead>
                        <TableHead className="font-semibold">Code</TableHead>
                        <TableHead className="font-semibold">MT5 Login</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        {!isAssistance && <TableHead className="font-semibold">Commission</TableHead>}
                        <TableHead className="font-semibold">Payment Method</TableHead>
                        <TableHead className="font-semibold">Rejection Reason</TableHead>
                        <TableHead className="font-semibold">Screenshot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myTransactions.length === 0 && pendingReferrals.length === 0 && myAdjustments.length === 0 ? (
                       <TableRow>
                         <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                           No funding requests yet
                         </TableCell>
                       </TableRow>
                      ) : (
                       <>
                       {pendingReferrals.map((referral) => (
                         <TableRow key={`ref-${referral.id}`} className="hover:bg-orange-50 bg-orange-50/40 transition-colors">
                           <TableCell className="text-sm">
                             {referral.created_at ? format(new Date(referral.created_at), 'MMM d, yyyy HH:mm') : '-'}
                           </TableCell>
                           <TableCell>
                             <div className="flex items-center gap-2">
                               <TrendingUp className="h-4 w-4 text-blue-600" />
                               <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">DEPOSIT</Badge>
                             </div>
                           </TableCell>
                           <TableCell>
                             <Badge variant="outline" className={getReferralStatusColor()}>
                               <Clock className="h-3 w-3 mr-1" />
                               Pending Co-Mgmt Approval
                             </Badge>
                           </TableCell>
                           <TableCell className="font-medium">{referral.student_name}</TableCell>
                           <TableCell className="font-mono text-sm text-blue-600">{referral.student_code || '-'}</TableCell>
                           <TableCell className="font-mono text-sm">{referral.mt5_login || '-'}</TableCell>
                           <TableCell className="font-semibold text-gray-900">${parseFloat(referral.requested_deposit_amount || 0).toFixed(2)}</TableCell>
                           {!isAssistance && <TableCell className="text-gray-400">-</TableCell>}
                           <TableCell className="text-sm">{referral.payment_method || '-'}</TableCell>
                           <TableCell>-</TableCell>
                           <TableCell>
                             {referral.screenshot_url ? (
                               <a href={referral.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                                 <Eye className="h-4 w-4" />
                               </a>
                             ) : '-'}
                           </TableCell>
                         </TableRow>
                       ))}
                       {myAdjustments.map((adj) => (
                         <TableRow key={`adj-${adj.id}`} className="hover:bg-purple-50 bg-purple-50/30 transition-colors">
                           <TableCell className="text-sm">{adj.created_date ? format(new Date(adj.created_date), 'MMM d, yyyy HH:mm') : '-'}</TableCell>
                           <TableCell><Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">ADJUSTMENT</Badge></TableCell>
                           <TableCell>
                             <Badge variant="outline" className={adj.adjustment_type === 'ADDITION' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                               {adj.adjustment_type}
                             </Badge>
                           </TableCell>
                           <TableCell className="font-medium">{adj.reason}</TableCell>
                           <TableCell>-</TableCell>
                           <TableCell>-</TableCell>
                           <TableCell className={`font-semibold ${adj.amount_usd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                             {adj.amount_usd >= 0 ? '+' : ''}${adj.amount_usd.toFixed(2)}
                           </TableCell>
                           {!isAssistance && <TableCell>-</TableCell>}
                           <TableCell>-</TableCell>
                           <TableCell>-</TableCell>
                           <TableCell>-</TableCell>
                         </TableRow>
                       ))}
                       {myTransactions.map((transaction) => {
                        const commissionEarned = transaction.commission_amount || 0;
                         return (
                         <TableRow key={transaction.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="text-sm">
                              {transaction.requested_at
                                ? format(new Date(transaction.requested_at), 'MMM d, yyyy HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {transaction.type === 'DEPOSIT' ? (
                                  <TrendingUp className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-purple-600" />
                                )}
                                <Badge variant="outline" className={getTypeColor(transaction.type)}>
                                  {transaction.type}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(transaction.status)}>
                                {transaction.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{transaction.student_name}</TableCell>
                            <TableCell className="font-mono text-sm text-blue-600">
                              {transaction.student_code}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {transaction.mt5_login || '-'}
                            </TableCell>
                            <TableCell className="font-semibold text-gray-900">
                              ${transaction.amount_usd?.toFixed(2)}
                            </TableCell>
                            {!isAssistance && (
                              <TableCell className={`font-semibold ${commissionEarned >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.status === 'APPROVED' 
                                  ? `$${commissionEarned.toFixed(2)}` 
                                  : '-'}
                              </TableCell>
                            )}
                            <TableCell className="text-sm">{transaction.payment_method}</TableCell>
                            <TableCell className="text-sm">
                              {transaction.status === 'REJECTED' && transaction.rejection_reason ? (
                                <span className="text-red-600 font-medium">{transaction.rejection_reason}</span>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {transaction.screenshot_url ? (
                                <a
                                  href={transaction.screenshot_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            </TableRow>
                            );
                            })}
                            </>
                            )}
                            </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Funding Requests Tab */}
          {isSeniorMentor && (
            <TabsContent value="team" className="space-y-6">
              {/* Team Commission Summary */}
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                <CardHeader className="border-b border-purple-100">
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Team Commission Summary - {quarterLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-600">Team Net Deposit</p>
                        <DollarSign className="h-5 w-5 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        ${totalTeamCommission.netDeposit.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {teamCommissionDataGrouped.length} junior mentor(s), {approvedTeamTransactions.length} transactions
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-emerald-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-600">Upline Commission</p>
                        <Award className="h-5 w-5 text-emerald-600" />
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">
                        ${totalTeamCommission.grossCommission.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-green-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-600">Release (75%)</p>
                        <Wallet className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        ${totalTeamCommission.release.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-amber-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-600">Buffer (25%)</p>
                        <Wallet className="h-5 w-5 text-amber-600" />
                      </div>
                      <p className="text-2xl font-bold text-amber-600">
                        ${totalTeamCommission.buffer.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Transaction History */}
              <Card className="border-gray-200">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold">Team Request History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Requested</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Student</TableHead>
                          <TableHead className="font-semibold">Code</TableHead>
                          <TableHead className="font-semibold">Junior Mentor</TableHead>
                          <TableHead className="font-semibold">MT5 Login</TableHead>
                          <TableHead className="font-semibold">Amount</TableHead>
                          <TableHead className="font-semibold">Upline Commission</TableHead>
                          <TableHead className="font-semibold">Payment Method</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                              No team funding requests yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamTransactions.map((transaction) => {
                            const txAmount = transaction.amount_usd || 0;
                            const uplinePercentage = (transaction.upline_commission_percentage || 0) / 100;
                            let uplineCommission = 0;

                            if (transaction.status === 'APPROVED') {
                              uplineCommission = transaction.type === 'DEPOSIT' 
                                ? Math.min(txAmount, 25000) * uplinePercentage 
                                : 0;
                            }

                            return (
                            <TableRow key={transaction.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="text-sm">
                                {transaction.requested_at
                                  ? format(new Date(transaction.requested_at), 'MMM d, yyyy HH:mm')
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {transaction.type === 'DEPOSIT' ? (
                                    <TrendingUp className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-purple-600" />
                                  )}
                                  <Badge variant="outline" className={getTypeColor(transaction.type)}>
                                    {transaction.type}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(transaction.status)}>
                                  {transaction.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{transaction.student_name}</TableCell>
                              <TableCell className="font-mono text-sm text-blue-600">
                                {transaction.student_code}
                              </TableCell>
                              <TableCell className="font-medium text-purple-600">
                                {transaction.primary_mentor_name}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {transaction.mt5_login || '-'}
                              </TableCell>
                              <TableCell className="font-semibold text-gray-900">
                                ${transaction.amount_usd?.toFixed(2)}
                              </TableCell>
                              <TableCell className={`font-semibold ${uplineCommission >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.status === 'APPROVED' 
                                  ? `$${uplineCommission.toFixed(2)} (${transaction.upline_commission_percentage || 0}%)` 
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-sm">{transaction.payment_method}</TableCell>
                              </TableRow>
                              );
                              })
                              )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Add Request Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Funding Request</DialogTitle>
            </DialogHeader>
            <FundingRequestForm
              students={myStudents}
              allStudents={students}
              currentUser={currentUser}
              onSubmit={(data) => createMutation.mutate(data)}
              onCancel={() => setShowAddDialog(false)}
              isSubmitting={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}