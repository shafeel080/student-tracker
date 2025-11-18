import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CheckCircle } from "lucide-react";
import { filterLedgersByRole, canMarkReleased } from "../components/utils/LedgerUtils";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CommissionReports() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterMentor, setFilterMentor] = useState('all');
  const [filterQuarter, setFilterQuarter] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: ledgers = [] } = useQuery({
    queryKey: ['commission-ledgers'],
    queryFn: () => base44.entities.CommissionLedger.list('-year', '-quarter_number'),
    enabled: !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser
  });

  const markReleasedMutation = useMutation({
    mutationFn: ({ id, date }) => base44.entities.CommissionLedger.update(id, {
      is_released: true,
      actual_release_date: date
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['commission-ledgers']);
      toast.success('Commission marked as released');
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

  // Filter ledgers
  let filteredLedgers = filterLedgersByRole(currentUser, ledgers);

  if (filterMentor !== 'all') {
    filteredLedgers = filteredLedgers.filter(l => l.mentor_id === filterMentor);
  }
  if (filterQuarter !== 'all') {
    filteredLedgers = filteredLedgers.filter(l => l.quarter_number === parseInt(filterQuarter));
  }
  if (filterYear !== 'all') {
    filteredLedgers = filteredLedgers.filter(l => l.year === parseInt(filterYear));
  }
  if (filterStatus !== 'all') {
    if (filterStatus === 'released') {
      filteredLedgers = filteredLedgers.filter(l => l.is_released);
    } else if (filterStatus === 'pending') {
      filteredLedgers = filteredLedgers.filter(l => !l.is_released);
    }
  }
  if (searchTerm) {
    filteredLedgers = filteredLedgers.filter(l =>
      l.mentor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.quarter?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Get unique values for filters
  const mentorsWithLedgers = [...new Set(ledgers.map(l => l.mentor_id))]
    .map(id => users.find(u => u.id === id))
    .filter(Boolean);
  
  const years = [...new Set(ledgers.map(l => l.year))].sort((a, b) => b - a);

  // Calculate summary
  const totalGrossCommission = filteredLedgers.reduce((sum, l) => sum + (l.gross_commission_usd || 0), 0);
  const totalReleased = filteredLedgers
    .filter(l => l.is_released)
    .reduce((sum, l) => sum + (l.commission_release_usd || 0), 0);
  const totalPending = filteredLedgers
    .filter(l => !l.is_released)
    .reduce((sum, l) => sum + (l.commission_release_usd || 0), 0);

  const handleMarkReleased = (ledger) => {
    const today = new Date().toISOString().split('T')[0];
    if (window.confirm(`Mark commission as released for ${ledger.mentor_name} - ${ledger.quarter}?`)) {
      markReleasedMutation.mutate({ id: ledger.id, date: today });
    }
  };

  const canMark = canMarkReleased(currentUser);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Commission Reports</h1>
          <p className="text-gray-600 mt-1">View and manage all mentor commission ledgers</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Total Gross Commission</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">${totalGrossCommission.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Total Released</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">${totalReleased.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">Pending Release</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">${totalPending.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search mentor or quarter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterMentor} onValueChange={setFilterMentor}>
                <SelectTrigger>
                  <SelectValue placeholder="All Mentors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mentors</SelectItem>
                  {mentorsWithLedgers.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      {mentor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterQuarter} onValueChange={setFilterQuarter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Quarters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quarters</SelectItem>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Commission Table */}
        <Card className="border-gray-200">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg font-semibold">Commission Ledgers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Mentor</TableHead>
                    <TableHead className="font-semibold">Quarter</TableHead>
                    <TableHead className="font-semibold">Net Deposit</TableHead>
                    <TableHead className="font-semibold">Gross</TableHead>
                    <TableHead className="font-semibold">Release</TableHead>
                    <TableHead className="font-semibold">Buffer</TableHead>
                    <TableHead className="font-semibold">Buffer In</TableHead>
                    <TableHead className="font-semibold">Buffer Out</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {canMark && <TableHead className="font-semibold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLedgers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMark ? 10 : 9} className="text-center py-8 text-gray-500">
                        No commission ledgers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLedgers.map((ledger) => (
                      <TableRow key={ledger.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">{ledger.mentor_name}</TableCell>
                        <TableCell className="font-semibold text-blue-600">{ledger.quarter}</TableCell>
                        <TableCell className="font-semibold">${ledger.net_deposit_usd?.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">${ledger.gross_commission_usd?.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          ${ledger.commission_release_usd?.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-semibold text-amber-600">
                          ${ledger.commission_buffer_usd?.toFixed(2)}
                        </TableCell>
                        <TableCell>${ledger.buffer_carried_in_usd?.toFixed(2)}</TableCell>
                        <TableCell>${ledger.buffer_carried_out_usd?.toFixed(2)}</TableCell>
                        <TableCell>
                          {ledger.is_released ? (
                            <div>
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                RELEASED
                              </Badge>
                              {ledger.actual_release_date && (
                                <div className="text-xs text-gray-600 mt-1">
                                  {format(new Date(ledger.actual_release_date), 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                              PENDING
                            </Badge>
                          )}
                        </TableCell>
                        {canMark && (
                          <TableCell className="text-right">
                            {!ledger.is_released && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkReleased(ledger)}
                                disabled={markReleasedMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Mark Released
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}