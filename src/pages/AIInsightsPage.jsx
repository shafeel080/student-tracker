import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, TrendingUp, Users, DollarSign, AlertTriangle } from "lucide-react";
import AIInsights from "../components/ai/AIInsights";
import AIAssistant from "../components/ai/AIAssistant";

export default function AIInsightsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('performance');

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
    enabled: !!currentUser
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['funding-transactions'],
    queryFn: () => base44.entities.FundingTransaction.list('-created_date'),
    enabled: !!currentUser
  });

  const { data: ledgers = [] } = useQuery({
    queryKey: ['commission-ledgers'],
    queryFn: () => base44.entities.CommissionLedger.list('-created_date'),
    enabled: !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        return await base44.entities.User.list();
      } catch (error) {
        return [];
      }
    },
    enabled: !!currentUser,
    retry: false
  });

  if (!currentUser) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Prepare data for different insights
  const mentors = users.filter(u => ['junior_mentor', 'senior_mentor'].includes(u.app_role));
  
  const mentorPerformanceData = mentors.map(mentor => {
    const mentorTransactions = transactions.filter(t => 
      t.primary_mentor_id === mentor.id && t.status === 'APPROVED'
    );
    const mentorStudents = students.filter(s => s.primary_mentor_id === mentor.id);
    const mentorLedgers = ledgers.filter(l => l.mentor_id === mentor.id);
    
    const totalDeposits = mentorTransactions
      .filter(t => t.type === 'DEPOSIT')
      .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
    
    const totalWithdrawals = mentorTransactions
      .filter(t => t.type === 'WITHDRAWAL')
      .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
    
    const netDeposit = totalDeposits - totalWithdrawals;
    const totalCommission = mentorLedgers.reduce((sum, l) => sum + (l.commission_release_usd || 0), 0);
    
    return {
      mentor_name: mentor.full_name,
      mentor_role: mentor.app_role,
      total_students: mentorStudents.length,
      net_deposit: netDeposit,
      total_commission: totalCommission,
      avg_deposit_per_student: mentorStudents.length > 0 ? netDeposit / mentorStudents.length : 0
    };
  });

  const studentRiskData = students.map(student => {
    const studentTransactions = transactions.filter(t => 
      t.student_id === student.id && t.status === 'APPROVED'
    );
    
    const totalDeposits = studentTransactions
      .filter(t => t.type === 'DEPOSIT')
      .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
    
    const lastTransaction = studentTransactions[0];
    const daysSinceLastTransaction = lastTransaction 
      ? Math.floor((new Date() - new Date(lastTransaction.created_date)) / (1000 * 60 * 60 * 24))
      : 999;
    
    return {
      student_name: student.full_name,
      student_code: student.student_code,
      total_deposits: totalDeposits,
      transaction_count: studentTransactions.length,
      days_since_last_transaction: daysSinceLastTransaction,
      status: student.status
    };
  });

  const commissionTrendsData = {
    total_approved_transactions: transactions.filter(t => t.status === 'APPROVED').length,
    total_pending_transactions: transactions.filter(t => t.status === 'PENDING').length,
    total_net_deposits: transactions
      .filter(t => t.status === 'APPROVED' && t.type === 'DEPOSIT')
      .reduce((sum, t) => sum + (t.amount_usd || 0), 0) -
      transactions
      .filter(t => t.status === 'APPROVED' && t.type === 'WITHDRAWAL')
      .reduce((sum, t) => sum + (t.amount_usd || 0), 0),
    total_commissions_released: ledgers
      .filter(l => l.is_released)
      .reduce((sum, l) => sum + (l.commission_release_usd || 0), 0),
    total_commissions_pending: ledgers
      .filter(l => !l.is_released)
      .reduce((sum, l) => sum + (l.commission_release_usd || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-600" />
              AI-Powered Insights
            </h1>
            <p className="text-gray-600 mt-1">Get intelligent analysis and predictions</p>
          </div>
          <AIAssistant position="inline" />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Mentors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">{mentors.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{students.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span className="text-2xl font-bold">{commissionTrendsData.total_pending_transactions}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Net Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">
                  ${commissionTrendsData.total_net_deposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="performance">
              <TrendingUp className="h-4 w-4 mr-2" />
              Performance Analysis
            </TabsTrigger>
            <TabsTrigger value="risk">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Student Risk Assessment
            </TabsTrigger>
            <TabsTrigger value="trends">
              <DollarSign className="h-4 w-4 mr-2" />
              Commission Trends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-6">
            <AIInsights 
              data={mentorPerformanceData} 
              type="mentor_performance" 
            />
          </TabsContent>

          <TabsContent value="risk" className="mt-6">
            <AIInsights 
              data={studentRiskData} 
              type="student_risk" 
            />
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <AIInsights 
              data={commissionTrendsData} 
              type="commission_trends" 
            />
          </TabsContent>
        </Tabs>

        {/* AI Assistant */}
        <AIAssistant />
      </div>
    </div>
  );
}