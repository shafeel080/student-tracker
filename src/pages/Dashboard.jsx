import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import StatsCard from "../components/dashboard/StatsCard";
import { Users, TrendingUp, DollarSign, Target, AlertCircle, Award, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TransactionTable from "../components/transactions/TransactionTable";
import { canViewAllStudents, isMentorRole, canApproveTransactions } from "../components/utils/DataMasking";
import { 
  filterFundingTransactionsByRole, 
  canProcessFundingTransaction 
} from "../components/utils/FundingAccessControl";
import { calculateQuarterlyNetDepositAndCommission } from "../components/utils/CommissionUtils";

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
  const filteredStudents = canViewAllStudents(currentUser.role)
    ? students
    : isMentorRole(currentUser.role)
    ? students.filter(s => {
        if (currentUser.role === 'senior_mentor') {
          // Senior mentors see their students + junior mentors' students
          return s.mentor_id === currentUser.id || 
                 students.some(js => js.mentor_id === currentUser.id);
        }
        return s.mentor_id === currentUser.id;
      })
    : [];

  const filteredTransactions = isMentorRole(currentUser.role)
    ? transactions.filter(t => t.mentor_id === currentUser.id)
    : transactions;

  const pendingTransactions = filteredTransactions.filter(t => t.status === 'pending');
  const totalNetDeposit = filteredStudents.reduce((sum, s) => sum + (s.net_deposit || 0), 0);
  const myCommissions = commissions.filter(c => c.mentor_id === currentUser.id);
  const totalCommission = myCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  
  const myFundingTransactions = filterFundingTransactionsByRole(currentUser, fundingTransactions, students, allUsers);
  const pendingFundingRequests = myFundingTransactions.filter(t => t.status === 'PENDING').length;
  
  // Calculate commission for mentors
  const quarterCommission = isMentorRole(currentUser.role) 
    ? calculateQuarterlyNetDepositAndCommission(myFundingTransactions, currentUser)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, <span className="font-semibold">{currentUser.full_name}</span>
              <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {currentUser.role?.replace(/_/g, ' ')}
              </span>
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Students"
            value={filteredStudents.length}
            icon={Users}
            color="blue"
          />
          {isMentorRole(currentUser.role) ? (
            <>
              <StatsCard
                title="Quarter Net Deposit"
                value={`$${quarterCommission?.netDepositUsd?.toFixed(2) || '0.00'}`}
                icon={DollarSign}
                color="emerald"
              />
              <StatsCard
                title="Quarter Commission"
                value={`$${quarterCommission?.grossCommissionUsd?.toFixed(2) || '0.00'}`}
                icon={Award}
                color="purple"
              />
              <StatsCard
                title="Pending Requests"
                value={pendingFundingRequests}
                icon={Wallet}
                color="amber"
              />
            </>
          ) : (
            <>
              <StatsCard
                title="Net Deposits"
                value={`$${totalNetDeposit.toFixed(2)}`}
                icon={DollarSign}
                color="emerald"
              />
              {canProcessFundingTransaction(currentUser.role) && (
                <StatsCard
                  title="Pending Funding Requests"
                  value={fundingTransactions.filter(t => t.status === 'PENDING').length}
                  icon={Wallet}
                  color="amber"
                />
              )}
            </>
          )}
        </div>

        {/* Recent Transactions */}
        <Card className="border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-xl font-bold">Recent Transactions</CardTitle>
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