import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function MyStudentRequests() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: requests = [] } = useQuery({
    queryKey: ['my-student-requests'],
    queryFn: () => base44.entities.StudentRequest.list('-requested_at'),
    enabled: !!currentUser
  });

  if (!currentUser) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Filter to show only current user's requests
  const myRequests = requests.filter(r => r.requested_by_id === currentUser.id);

  // Apply search
  const filteredRequests = myRequests.filter(r => {
    if (!searchTerm) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return r.full_name?.toLowerCase().includes(lowerSearch) ||
      r.email?.toLowerCase().includes(lowerSearch);
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING_LEVEL_UPGRADE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'TRANSFERRED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING_LEVEL_UPGRADE':
        return <Clock className="h-4 w-4" />;
      case 'APPROVED':
      case 'TRANSFERRED':
        return <CheckCircle className="h-4 w-4" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const pendingCount = myRequests.filter(r => 
    r.status === 'PENDING_LEVEL_UPGRADE'
  ).length;
  const approvedCount = myRequests.filter(r => r.status === 'APPROVED' || r.status === 'TRANSFERRED').length;
  const rejectedCount = myRequests.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">My Student Requests</h1>
          <p className="text-gray-600 mt-2">Track the status of your student registration requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none bg-gradient-to-br from-yellow-100 to-orange-100 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-200 rounded-xl">
                  <Clock className="h-6 w-6 text-yellow-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Pending</p>
                  <p className="text-2xl font-bold text-yellow-800">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-gradient-to-br from-green-100 to-emerald-100 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-200 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Approved</p>
                  <p className="text-2xl font-bold text-green-800">{approvedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-gradient-to-br from-red-100 to-pink-100 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-200 rounded-xl">
                  <XCircle className="h-6 w-6 text-red-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Rejected</p>
                  <p className="text-2xl font-bold text-red-800">{rejectedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by student name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Requests Table */}
        <Card className="border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              My Requests ({filteredRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Requested</TableHead>
                    <TableHead className="font-semibold">Student Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Phone</TableHead>
                    <TableHead className="font-semibold">Country</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No requests found. Submit a student request from the Students page.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request) => (
                      <TableRow key={request.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="text-sm">
                          {request.requested_at ? format(new Date(request.requested_at), 'MMM d, yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{request.full_name}</TableCell>
                        <TableCell className="text-sm">{request.email}</TableCell>
                        <TableCell className="text-sm">{request.phone || '-'}</TableCell>
                        <TableCell className="text-sm">{request.country || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${getStatusColor(request.status)} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(request.status)}
                            <span className="text-xs">
                              {request.status === 'PENDING_LEVEL_UPGRADE' ? 'Pending Upgrade' :
                               request.status.replace(/_/g, ' ')}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          {request.status === 'REJECTED' && (
                            <div className="text-red-600">
                              {request.level_upgrade_rejection_reason || 'Upgrade rejected'}
                            </div>
                          )}
                          {request.status === 'TRANSFERRED' && (
                            <div className="text-purple-600">Student transferred successfully</div>
                          )}
                          {request.status === 'APPROVED' && request.request_type === 'LEVEL_UPGRADE' && (
                            <div className="text-green-600">Upgraded to Level 2</div>
                          )}
                          {request.status === 'APPROVED' && request.request_type !== 'LEVEL_UPGRADE' && (
                            <div className="text-green-600">Student created</div>
                          )}
                          {request.status === 'PENDING_LEVEL_UPGRADE' && (
                            <div className="text-gray-500">Awaiting upgrade approval</div>
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
      </div>
    </div>
  );
}