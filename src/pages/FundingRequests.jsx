import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, TrendingUp, TrendingDown, Eye, Edit } from "lucide-react";
import ProcessFundingDialog from "../components/funding/ProcessFundingDialog";
import { 
  canProcessFundingTransaction,
  filterFundingTransactionsByRole 
} from "../components/utils/FundingAccessControl";
import { toast } from "sonner";
import { format } from "date-fns";

export default function FundingRequests() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterMentor, setFilterMentor] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FundingTransaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['funding-transactions']);
      setShowProcessDialog(false);
      setSelectedTransaction(null);
      toast.success('Transaction processed successfully');
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

  // Filter transactions
  let filteredTransactions = filterFundingTransactionsByRole(currentUser, transactions, students, users);

  // Apply filters
  if (filterStatus !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.status === filterStatus);
  }
  if (filterType !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.type === filterType);
  }
  if (filterMentor !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.primary_mentor_name === filterMentor);
  }
  if (searchTerm) {
    filteredTransactions = filteredTransactions.filter(t =>
      t.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mt5_login?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Get unique mentors for filter
  const uniqueMentors = [...new Set(transactions.map(t => t.primary_mentor_name))].filter(Boolean);

  const canProcess = canProcessFundingTransaction(currentUser.role);

  const handleProcess = (transaction) => {
    setSelectedTransaction(transaction);
    setShowProcessDialog(true);
  };

  const handleProcessSubmit = (formData) => {
    const updatedData = {
      ...formData,
      approved_by_id: currentUser.id,
      approved_by_name: currentUser.full_name,
      approved_at: new Date().toISOString()
    };
    
    updateMutation.mutate({
      id: selectedTransaction.id,
      data: updatedData
    });
  };

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

  // Calculate summary stats
  const pendingCount = filteredTransactions.filter(t => t.status === 'PENDING').length;
  const approvedCount = filteredTransactions.filter(t => t.status === 'APPROVED').length;
  const rejectedCount = filteredTransactions.filter(t => t.status === 'REJECTED').length;
  const totalPendingAmount = filteredTransactions
    .filter(t => t.status === 'PENDING')
    .reduce((sum, t) => sum + (t.amount_usd || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Funding Requests Management</h1>
            <p className="text-gray-600 mt-1">Review and process deposit and withdrawal requests</p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Pending Requests</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{approvedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{rejectedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Pending Amount</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">${totalPendingAmount.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by student, code, MT5 login, or transaction ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <Tabs value={filterStatus} onValueChange={setFilterStatus}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                  <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Type Filter */}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="DEPOSIT">Deposit</SelectItem>
                  <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                </SelectContent>
              </Select>

              {/* Mentor Filter */}
              <Select value={filterMentor} onValueChange={setFilterMentor}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Mentor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mentors</SelectItem>
                  {uniqueMentors.map((mentor) => (
                    <SelectItem key={mentor} value={mentor}>
                      {mentor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="border-gray-200">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg font-semibold">Funding Requests</CardTitle>
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
                    <TableHead className="font-semibold">Primary Mentor</TableHead>
                    <TableHead className="font-semibold">MT5 Login</TableHead>
                    <TableHead className="font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">Payment</TableHead>
                    <TableHead className="font-semibold">User ID</TableHead>
                    <TableHead className="font-semibold">Txn ID</TableHead>
                    <TableHead className="font-semibold">Approved By</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                        No funding requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="text-sm">
                          {transaction.requested_at
                            ? format(new Date(transaction.requested_at), 'MMM d, HH:mm')
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
                        <TableCell className="text-sm">{transaction.primary_mentor_name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {transaction.mt5_login || '-'}
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900">
                          ${transaction.amount_usd?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm">{transaction.payment_method}</TableCell>
                        <TableCell className="text-sm">{transaction.user_id || '-'}</TableCell>
                        <TableCell className="text-sm font-mono">
                          {transaction.transaction_id || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {transaction.approved_by_name ? (
                            <div>
                              <p className="font-medium">{transaction.approved_by_name}</p>
                              {transaction.approved_at && (
                                <p className="text-xs text-gray-500">
                                  {format(new Date(transaction.approved_at), 'MMM d, HH:mm')}
                                </p>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {transaction.screenshot_url && (
                              <a
                                href={transaction.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            {canProcess && transaction.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleProcess(transaction)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Process Dialog */}
        <ProcessFundingDialog
          transaction={selectedTransaction}
          open={showProcessDialog}
          onClose={() => {
            setShowProcessDialog(false);
            setSelectedTransaction(null);
          }}
          onProcess={handleProcessSubmit}
        />
      </div>
    </div>
  );
}