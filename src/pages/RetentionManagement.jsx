import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Search, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function RetentionManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDrawAdmin, setSelectedDrawAdmin] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: retentionRequests = [] } = useQuery({
    queryKey: ['retention-requests'],
    queryFn: () => base44.entities.RetentionAssignmentRequest.list('-triggered_date'),
    enabled: !!currentUser
  });

  const { data: drawAdmins = [] } = useQuery({
    queryKey: ['draw-admins'],
    queryFn: async () => {
      try {
        const users = await base44.entities.User.list();
        return users.filter(u => u.app_role === 'draw_admin');
      } catch (error) {
        console.warn('Unable to fetch draw admins:', error);
        return [];
      }
    },
    enabled: !!currentUser,
    retry: false
  });

  const assignmentMutation = useMutation({
    mutationFn: async (data) => {
      const { requestId, drawAdminId, drawAdminName } = data;
      
      // Update the retention request
      await base44.entities.RetentionAssignmentRequest.update(requestId, {
        status: 'assigned',
        assigned_draw_admin_id: drawAdminId,
        assigned_draw_admin_name: drawAdminName,
        assigned_by_id: currentUser.id,
        assigned_by_name: currentUser.full_name,
        assigned_at: new Date().toISOString(),
        notes: assignmentNotes
      });

      // Update the student
      const request = retentionRequests.find(r => r.id === requestId);
      if (request) {
        await base44.entities.Student.update(request.student_id, {
          assigned_draw_admin_id: drawAdminId,
          assigned_draw_admin_name: drawAdminName,
          retention_status: 'assigned'
        });

        // Log the action
        await base44.entities.RetentionLog.create({
          student_id: request.student_id,
          student_code: request.student_code,
          student_name: request.student_name,
          draw_admin_id: drawAdminId,
          draw_admin_name: drawAdminName,
          action_type: 'assigned',
          description: `Assigned to ${drawAdminName} by ${currentUser.full_name}`,
          logged_at: new Date().toISOString(),
          status: 'pending'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['retention-requests']);
      toast.success('Student assigned to Draw Admin successfully');
      setShowAssignDialog(false);
      setSelectedRequest(null);
      setSelectedDrawAdmin('');
      setAssignmentNotes('');
    },
    onError: (error) => {
      toast.error('Failed to assign student');
      console.error(error);
    }
  });

  if (!currentUser) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (currentUser.app_role !== 'academic_head') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 mt-2">Only academic heads can manage retention assignments</p>
        </div>
      </div>
    );
  }

  const pendingRequests = retentionRequests.filter(r => r.status === 'pending_assignment');
  const assignedRequests = retentionRequests.filter(r => r.status === 'assigned');

  const filteredPendingRequests = pendingRequests.filter(r =>
    r.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mentor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAssign = () => {
    if (!selectedDrawAdmin) {
      toast.error('Please select a Draw Admin');
      return;
    }
    assignmentMutation.mutate({
      requestId: selectedRequest.id,
      drawAdminId: selectedDrawAdmin,
      drawAdminName: drawAdmins.find(d => d.id === selectedDrawAdmin)?.full_name
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Retention Management</h1>
          <div className="text-right">
            <p className="text-sm text-gray-600">Students triggered 25K Net Deposit</p>
            <p className="text-2xl font-bold text-blue-600">{pendingRequests.length} Pending</p>
          </div>
        </div>

        {/* Pending Assignments Tab */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Pending Assignments</h2>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by student, code, or mentor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Student Code</TableHead>
                  <TableHead className="font-semibold">Student Name</TableHead>
                  <TableHead className="font-semibold">Mentor Name</TableHead>
                  <TableHead className="font-semibold">Net Deposit (USD)</TableHead>
                  <TableHead className="font-semibold">Triggered Date</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPendingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No pending assignments
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPendingRequests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-mono text-sm font-medium text-blue-600">
                        {request.student_code}
                      </TableCell>
                      <TableCell className="font-medium">{request.student_name}</TableCell>
                      <TableCell className="text-sm">{request.mentor_name}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ${request.net_deposit_usd?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(request.triggered_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowAssignDialog(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Assigned Students Tab */}
        {assignedRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Assigned to Draw Admin</h2>
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student Code</TableHead>
                    <TableHead className="font-semibold">Student Name</TableHead>
                    <TableHead className="font-semibold">Draw Admin</TableHead>
                    <TableHead className="font-semibold">Assigned Date</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedRequests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-mono text-sm font-medium text-blue-600">
                        {request.student_code}
                      </TableCell>
                      <TableCell className="font-medium">{request.student_name}</TableCell>
                      <TableCell className="text-sm font-medium text-purple-600">
                        {request.assigned_draw_admin_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(request.assigned_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Assigned
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Student to Draw Admin</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Student Details */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 space-y-2">
                  <div>
                    <p className="text-sm text-gray-600">Student Code</p>
                    <p className="font-semibold text-blue-600">{selectedRequest.student_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Student Name</p>
                    <p className="font-semibold">{selectedRequest.student_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Net Deposit</p>
                    <p className="font-semibold text-green-600">${selectedRequest.net_deposit_usd?.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Draw Admin Selection */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Select Draw Admin</label>
                <Select value={selectedDrawAdmin} onValueChange={setSelectedDrawAdmin}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose Draw Admin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drawAdmins.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Notes */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Notes (Optional)</label>
                <Textarea
                  placeholder="Add any relevant notes for the Draw Admin..."
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  className="h-24"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignDialog(false);
                    setSelectedRequest(null);
                    setSelectedDrawAdmin('');
                    setAssignmentNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssign}
                  disabled={assignmentMutation.isPending || !selectedDrawAdmin}
                  className="bg-blue-600 hover:bg-blue-700 flex-1"
                >
                  {assignmentMutation.isPending ? 'Assigning...' : 'Assign Student'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}