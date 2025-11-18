import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, TrendingDown, DollarSign, Award, Wallet, Eye } from "lucide-react";
import FundingRequestForm from "../components/funding/FundingRequestForm";
import { 
  canCreateFundingTransaction,
  filterFundingTransactionsByRole 
} from "../components/utils/FundingAccessControl";
import { 
  calculateQuarterlyNetDepositAndCommission,
  getCurrentQuarterLabel 
} from "../components/utils/CommissionUtils";
import { filterStudentsByRole } from "../components/utils/StudentAccessControl";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MyFundingRequests() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
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
    enabled: !!currentUser
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FundingTransaction.create(data),
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

  // Filter transactions and students for this mentor
  const myTransactions = filterFundingTransactionsByRole(currentUser, transactions, students, users);
  const myStudents = filterStudentsByRole(students, currentUser, users);

  // Calculate quarterly commission
  const commission = calculateQuarterlyNetDepositAndCommission(myTransactions, currentUser);
  const quarterLabel = getCurrentQuarterLabel();

  const canCreate = canCreateFundingTransaction(currentUser.app_role);

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
            <h1 className="text-3xl font-bold text-gray-900">My Funding Requests</h1>
            <p className="text-gray-600 mt-1">Manage your deposit and withdrawal requests</p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          )}
        </div>

        {/* Commission Summary - Current Quarter */}
        <Card className="border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="border-b border-blue-100">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              Commission Summary - {quarterLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Net Deposit</p>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${commission.netDepositUsd.toFixed(2)}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Gross Commission (4%)</p>
                  <Award className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  ${commission.grossCommissionUsd.toFixed(2)}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Release (75%)</p>
                  <Wallet className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ${commission.release75Usd.toFixed(2)}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Buffer (25%)</p>
                  <Wallet className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  ${commission.buffer25Usd.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    <TableHead className="font-semibold">Payment Method</TableHead>
                    <TableHead className="font-semibold">Screenshot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No funding requests yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    myTransactions.map((transaction) => (
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
                        <TableCell className="text-sm">{transaction.payment_method}</TableCell>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add Request Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Funding Request</DialogTitle>
            </DialogHeader>
            <FundingRequestForm
              students={myStudents}
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