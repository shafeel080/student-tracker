import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import StatsCard from "../components/dashboard/StatsCard";
import { Users, TrendingUp, DollarSign, Target, AlertCircle, Award, Wallet, Activity, Trophy, Zap, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import TransactionTable from "../components/transactions/TransactionTable";
import { canViewAllStudents, isMentorRole, canApproveTransactions } from "../components/utils/DataMasking";
import { 
  filterFundingTransactionsByRole, 
  canProcessFundingTransaction 
} from "../components/utils/FundingAccessControl";
import { calculateQuarterlyNetDepositAndCommission } from "../components/utils/CommissionUtils";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);

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
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100),
    enabled: !!currentUser
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list(),
    enabled: !!currentUser
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['targets'],
    queryFn: () => base44.entities.Target.list(),
    enabled: !!currentUser
  });

  const { data: fundingTransactions = [] } = useQuery({
    queryKey: ['funding-transactions'],
    queryFn: () => base44.entities.FundingTransaction.list('-requested_at', 50),
    enabled: !!currentUser
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser
  });

  const { data: mentorPoints = [] } = useQuery({
    queryKey: ['mentor-points'],
    queryFn: () => base44.entities.MentorPoints.list('-total_points'),
    enabled: !!currentUser && isMentorRole(currentUser.app_role)
  });

  const { data: mentorTargets = [] } = useQuery({
    queryKey: ['mentor-targets'],
    queryFn: () => base44.entities.MentorTarget.list(),
    enabled: !!currentUser && isMentorRole(currentUser.app_role)
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

  // Filter data based on user role
  const filteredStudents = canViewAllStudents(currentUser.app_role)
    ? students
    : isMentorRole(currentUser.app_role)
    ? students.filter(s => {
        if (currentUser.app_role === 'senior_mentor') {
          // Senior mentors see their students + junior mentors' students
          return s.senior_mentor_id === currentUser.id || 
                 s.primary_mentor_id === currentUser.id;
        }
        return s.primary_mentor_id === currentUser.id;
      })
    : [];

  const filteredTransactions = isMentorRole(currentUser.app_role)
    ? transactions.filter(t => t.primary_mentor_id === currentUser.id)
    : transactions;

  const pendingTransactions = filteredTransactions.filter(t => t.status === 'pending');
  
  const myFundingTransactions = filterFundingTransactionsByRole(currentUser, fundingTransactions, students, allUsers);
  const pendingFundingRequests = myFundingTransactions.filter(t => t.status === 'PENDING').length;

  // Calculate net deposit from approved funding transactions
  const approvedFundingTransactions = myFundingTransactions.filter(t => t.status === 'APPROVED');
  const totalDeposits = approvedFundingTransactions
    .filter(t => t.type === 'DEPOSIT')
    .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
  const totalWithdrawals = approvedFundingTransactions
    .filter(t => t.type === 'WITHDRAWAL')
    .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
  const totalNetDeposit = totalDeposits - totalWithdrawals;

  const myCommissions = commissions.filter(c => c.mentor_id === currentUser.id);
  const totalCommission = myCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  // Calculate commission for mentors
  const quarterCommission = isMentorRole(currentUser.app_role) 
    ? calculateQuarterlyNetDepositAndCommission(myFundingTransactions, currentUser)
    : null;

  // Prepare chart data - Last 6 months transaction trend
  const now = new Date();
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      deposits: 0,
      withdrawals: 0
    };
  });

  myFundingTransactions
    .filter(t => t.status === 'APPROVED' && t.requested_at)
    .forEach(t => {
      const txDate = new Date(t.requested_at);
      const monthsAgo = Math.floor((now - txDate) / (1000 * 60 * 60 * 24 * 30));
      if (monthsAgo >= 0 && monthsAgo < 6) {
        const idx = 5 - monthsAgo;
        if (t.type === 'DEPOSIT') {
          last6Months[idx].deposits += t.amount_usd || 0;
        } else {
          last6Months[idx].withdrawals += t.amount_usd || 0;
        }
      }
    });

  // Status distribution for pie chart
  const statusData = [
    { name: 'Pending', value: myFundingTransactions.filter(t => t.status === 'PENDING').length, color: '#f59e0b' },
    { name: 'Approved', value: myFundingTransactions.filter(t => t.status === 'APPROVED').length, color: '#10b981' },
    { name: 'Rejected', value: myFundingTransactions.filter(t => t.status === 'REJECTED').length, color: '#ef4444' }
  ].filter(s => s.value > 0);

  // Leaderboard position for mentors
  const myRank = isMentorRole(currentUser.app_role) 
    ? mentorPoints.findIndex(mp => mp.mentor_id === currentUser.id) + 1 
    : null;
  const myPoints = mentorPoints.find(mp => mp.mentor_id === currentUser.id);

  // Target progress for mentors
  const activeTargets = isMentorRole(currentUser.app_role)
    ? mentorTargets.filter(t => t.mentor_id === currentUser.id && t.target_status === 'IN_PROGRESS')
    : [];

  // Top performing students
  const topStudents = filteredStudents
    .map(student => {
      const studentTransactions = myFundingTransactions.filter(
        t => t.student_id === student.id && t.status === 'APPROVED'
      );
      const netDeposit = studentTransactions
        .filter(t => t.type === 'DEPOSIT')
        .reduce((sum, t) => sum + (t.amount_usd || 0), 0) -
        studentTransactions
        .filter(t => t.type === 'WITHDRAWAL')
        .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
      return { ...student, netDeposit };
    })
    .filter(s => s.netDeposit > 0)
    .sort((a, b) => b.netDeposit - a.netDeposit)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl shadow-xl p-8 border border-blue-700">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-white">
              Welcome back, {currentUser.full_name}
            </h1>
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm">
                <Activity className="h-4 w-4 mr-1.5" />
                {currentUser.app_role?.replace(/_/g, ' ')}
              </span>
              <span className="text-blue-100">•</span>
              <span className="text-blue-100 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions & Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="border-gray-200 shadow-lg">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {isMentorRole(currentUser.app_role) ? (
                <>
                  <Link to={createPageUrl('Students')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      View Students
                    </Button>
                  </Link>
                  <Link to={createPageUrl('MyFundingRequests')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Wallet className="h-4 w-4 mr-2" />
                      Funding Activities
                    </Button>
                  </Link>
                  <Link to={createPageUrl('MyTargets')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Target className="h-4 w-4 mr-2" />
                      My Targets
                    </Button>
                  </Link>
                  <Link to={createPageUrl('Leaderboard')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Trophy className="h-4 w-4 mr-2" />
                      Leaderboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to={createPageUrl('FundingRequests')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Wallet className="h-4 w-4 mr-2" />
                      Funding Requests
                    </Button>
                  </Link>
                  <Link to={createPageUrl('TargetsManagement')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Target className="h-4 w-4 mr-2" />
                      Manage Targets
                    </Button>
                  </Link>
                  <Link to={createPageUrl('Personnel')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Personnel
                    </Button>
                  </Link>
                  <Link to={createPageUrl('CommissionReports')}>
                    <Button variant="outline" className="w-full justify-start">
                      <Award className="h-4 w-4 mr-2" />
                      Commission Reports
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          {/* Leaderboard Position (Mentors Only) */}
          {isMentorRole(currentUser.app_role) && myRank && (
            <Card className="border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-yellow-50 to-amber-50">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Your Leaderboard Rank
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-full w-24 h-24 flex items-center justify-center mx-auto text-3xl font-bold shadow-lg">
                    #{myRank}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{myPoints?.total_points?.toLocaleString() || 0}</p>
                    <p className="text-sm text-gray-600">Total Points</p>
                  </div>
                  <Link to={createPageUrl('Leaderboard')}>
                    <Button size="sm" className="w-full bg-yellow-600 hover:bg-yellow-700">
                      View Full Leaderboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Target Progress (Mentors Only) */}
          {isMentorRole(currentUser.app_role) && activeTargets.length > 0 && (
            <Card className="border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Active Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {activeTargets.slice(0, 3).map((target) => {
                  const progress = (target.achievement_percent || 0);
                  return (
                    <div key={target.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{target.period_type}</span>
                        <span className="text-gray-600">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full ${
                            progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        ${(target.achievement_net_deposit_usd || 0).toLocaleString()} / ${target.target_net_deposit_usd?.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
                <Link to={createPageUrl('MyTargets')}>
                  <Button size="sm" variant="outline" className="w-full mt-2">
                    View All Targets
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Top Students */}
          {topStudents.length > 0 && (
            <Card className="border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  Top Students
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {topStudents.map((student, index) => (
                  <div key={student.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{student.full_name}</p>
                        <p className="text-xs text-gray-600">{student.student_code}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">
                      ${student.netDeposit.toLocaleString()}
                    </p>
                  </div>
                ))}
                <Link to={createPageUrl('Students')}>
                  <Button size="sm" variant="outline" className="w-full mt-2">
                    View All Students
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Pending Approvals Alert (Admins) */}
          {canProcessFundingTransaction(currentUser.app_role) && pendingFundingRequests > 0 && (
            <Card className="border-amber-200 bg-amber-50 shadow-lg">
              <CardHeader className="border-b border-amber-100">
                <CardTitle className="text-lg font-semibold flex items-center gap-2 text-amber-900">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 text-center space-y-3">
                <div className="text-4xl font-bold text-amber-900">{pendingFundingRequests}</div>
                <p className="text-sm text-amber-800">Funding requests awaiting your review</p>
                <Link to={createPageUrl('FundingRequests')}>
                  <Button className="w-full bg-amber-600 hover:bg-amber-700">
                    Review Requests
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Students"
            value={filteredStudents.length}
            icon={Users}
            color="blue"
            trend={`${filteredStudents.filter(s => s.status === 'ACTIVE').length} active`}
            trendUp={true}
          />
          {isMentorRole(currentUser.app_role) ? (
            <>
              <StatsCard
                title="Quarter Net Deposit"
                value={`$${quarterCommission?.netDepositUsd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
                icon={DollarSign}
                color="emerald"
                trend="Current quarter"
                trendUp={quarterCommission?.netDepositUsd > 0}
              />
              <StatsCard
                title="Quarter Commission"
                value={`$${quarterCommission?.grossCommissionUsd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
                icon={Award}
                color="purple"
                trend="4% of net deposit"
                trendUp={quarterCommission?.grossCommissionUsd > 0}
              />
              <StatsCard
                title="Pending Requests"
                value={pendingFundingRequests}
                icon={Wallet}
                color="amber"
                trend="Awaiting approval"
              />
            </>
          ) : (
            <>
              <StatsCard
                title="Net Deposits"
                value={`$${totalNetDeposit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={DollarSign}
                color="emerald"
                trend="All students"
                trendUp={totalNetDeposit > 0}
              />
              {canProcessFundingTransaction(currentUser.app_role) && (
                <StatsCard
                  title="Pending Funding Requests"
                  value={fundingTransactions.filter(t => t.status === 'PENDING').length}
                  icon={Wallet}
                  color="amber"
                  trend="Needs review"
                />
              )}
            </>
          )}
        </div>

        {/* Charts Section */}
        {myFundingTransactions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transaction Trend Chart */}
            <Card className="lg:col-span-2 border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Transaction Trends (Last 6 Months)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={last6Months}>
                    <defs>
                      <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="deposits" stroke="#10b981" fillOpacity={1} fill="url(#colorDeposits)" name="Deposits" />
                    <Area type="monotone" dataKey="withdrawals" stroke="#ef4444" fillOpacity={1} fill="url(#colorWithdrawals)" name="Withdrawals" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution Chart */}
            <Card className="border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} transactions`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Transactions */}
        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {myFundingTransactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {tx.student_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tx.type === 'DEPOSIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${(tx.amount_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tx.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                          tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tx.requested_at ? new Date(tx.requested_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {myFundingTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                        No transactions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}