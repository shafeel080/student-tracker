import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import StatsCard from "../components/dashboard/StatsCard";
import { Users, TrendingUp, DollarSign, Target, AlertCircle, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TransactionTable from "../components/transactions/TransactionTable";
import { canViewAllStudents, isMentorRole, canApproveTransactions } from "../components/utils/DataMasking";

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
          <StatsCard
            title="Net Deposits"
            value={`$${totalNetDeposit.toFixed(2)}`}
            icon={DollarSign}
            color="emerald"
          />
          {isMentorRole(currentUser.role) && (
            <StatsCard
              title="My Commissions"
              value={`$${totalCommission.toFixed(2)}`}
              icon={Award}
              color="purple"
            />
          )}
          {canApproveTransactions(currentUser.role) && (
            <StatsCard
              title="Pending Approvals"
              value={pendingTransactions.length}
              icon={AlertCircle}
              color="amber"
            />
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