import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import StatsCard from "../components/dashboard/StatsCard";
import { Users, TrendingUp, DollarSign, Target, AlertCircle, Award, Wallet, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <TransactionTable
              transactions={filteredTransactions.slice(0, 10)}
              currentUser={currentUser}
              onView={() => {}}
              onApprove={() => {}}
              onReject={() => {}}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}