import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAction } from "../components/utils/AuditLogger";
import { generateStudentCode } from "../components/utils/StudentAccessControl";

export default function StudentRequestApprovals() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [duplicateStudent, setDuplicateStudent] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [userId, setUserId] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['student-requests'],
    queryFn: async () => {
      const data = await base44.entities.StudentRequest.list('-requested_at');
      console.log('Fetched student requests:', data);
      return data;
    },
    enabled: !!currentUser
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
    enabled: !!currentUser
  });

  if (!currentUser) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const isAcademicHead = currentUser.app_role === 'academic_head';
  const isBrokerAdmin = currentUser.app_role === 'broker_admin';
  const canApprove = isAcademicHead || isBrokerAdmin;

  if (!canApprove) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <AlertDescription>
              You don't have permission to access this page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Academic head sees PENDING_ACADEMIC_APPROVAL
  // Broker admin sees both PENDING_ACADEMIC_APPROVAL and PENDING_BROKER_APPROVAL
  const filteredRequests = requests
    .filter(r => {
      if (isAcademicHead) {
        const match = r.status === 'PENDING_ACADEMIC_APPROVAL';
        console.log('Academic head filter:', r.full_name, r.status, match);
        return match;
      } else if (isBrokerAdmin) {
        const match = r.status === 'PENDING_ACADEMIC_APPROVAL' || r.status === 'PENDING_BROKER_APPROVAL';
        console.log('Broker admin filter:', r.full_name, r.status, match);
        return match;
      }
      return false;
    })
    .filter(r => {
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      return r.full_name?.toLowerCase().includes(lowerSearch) ||
        r.email?.toLowerCase().includes(lowerSearch) ||
        r.requested_by_name?.toLowerCase().includes(lowerSearch);
    });
  
  console.log('Total requests:', requests.length);
  console.log('Filtered requests for', currentUser.app_role, ':', filteredRequests.length);
  console.log('Filtered requests:', filteredRequests);

  const checkDuplicate = (email) => {
    return students.find(s => s.email?.toLowerCase() === email?.toLowerCase());
  };

  const handleApprove = async (request) => {
    setSelectedRequest(request);
    
    // Check for duplicate
    const existing = checkDuplicate(request.email);
    setDuplicateStudent(existing); // Store existing student info for display
    
    if (existing && isBrokerAdmin) {
      setShowTransferDialog(true);
    } else {
      setShowApproveDialog(true);
    }
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const confirmApprove = async () => {
    setProcessing(true);
    try {
      if (isAcademicHead) {
        // Academic head approval - move to broker approval
        await base44.entities.StudentRequest.update(selectedRequest.id, {
          status: 'PENDING_BROKER_APPROVAL',
          academic_approved_by_id: currentUser.id,
          academic_approved_by_name: currentUser.full_name,
          academic_approved_at: new Date().toISOString()
        });
        await logAction('approve_student_request', 'StudentRequest', selectedRequest.id, 
          `Approved student request for ${selectedRequest.full_name} (Academic)`, null, selectedRequest);
        toast.success('Request approved - forwarded to Broker Admin');
      } else if (isBrokerAdmin) {
        // Check if this is an open pool assignment
        if (selectedRequest.request_type === 'OPEN_POOL_ASSIGNMENT' && selectedRequest.existing_student_id) {
          // Update existing open pool student with mentor assignment
          await base44.entities.Student.update(selectedRequest.existing_student_id, {
            primary_mentor_id: selectedRequest.requested_primary_mentor_id,
            primary_mentor_name: selectedRequest.requested_primary_mentor_name,
            senior_mentor_id: selectedRequest.requested_senior_mentor_id,
            senior_mentor_name: selectedRequest.requested_senior_mentor_name,
            assignment_status: 'assigned'
          });

          await base44.entities.StudentRequest.update(selectedRequest.id, {
            status: 'APPROVED',
            broker_approved_by_id: currentUser.id,
            broker_approved_by_name: currentUser.full_name,
            broker_approved_at: new Date().toISOString()
          });

          await logAction('assign_open_pool_student', 'Student', selectedRequest.existing_student_id, 
            `Assigned open pool student ${selectedRequest.full_name} to ${selectedRequest.requested_primary_mentor_name}`, 
            null, selectedRequest);
          toast.success('Open pool student assigned successfully');
        } else {
          // Regular new student creation (from academic_admin or mentor requests)
          const studentCode = await generateStudentCode(base44);
          const hasNoMentor = !selectedRequest.requested_primary_mentor_id;
          const newStudent = await base44.entities.Student.create({
            student_code: studentCode,
            full_name: selectedRequest.full_name,
            email: selectedRequest.email,
            phone: selectedRequest.phone,
            country: selectedRequest.country,
            notes: selectedRequest.notes,
            user_id: userId || selectedRequest.user_id || undefined,
            primary_mentor_id: selectedRequest.requested_primary_mentor_id || '',
            primary_mentor_name: selectedRequest.requested_primary_mentor_name || '',
            senior_mentor_id: selectedRequest.requested_senior_mentor_id || '',
            senior_mentor_name: selectedRequest.requested_senior_mentor_name || '',
            assignment_status: hasNoMentor ? 'open_pool' : 'assigned',
            status: 'ACTIVE'
          });

          await base44.entities.StudentRequest.update(selectedRequest.id, {
            status: 'APPROVED',
            broker_approved_by_id: currentUser.id,
            broker_approved_by_name: currentUser.full_name,
            broker_approved_at: new Date().toISOString(),
            created_student_id: newStudent.id
          });

          await logAction('create_student', 'Student', newStudent.id, 
            `Created student from request: ${selectedRequest.full_name}`, null, newStudent);
          toast.success('Student created successfully');
        }
      }

      queryClient.invalidateQueries(['student-requests']);
      queryClient.invalidateQueries(['students']);
      setShowApproveDialog(false);
      setSelectedRequest(null);
      setUserId('');
    } catch (error) {
      toast.error('Failed to approve request');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const updateData = {
        status: 'REJECTED'
      };

      if (isAcademicHead) {
        updateData.academic_approved_by_id = currentUser.id;
        updateData.academic_approved_by_name = currentUser.full_name;
        updateData.academic_approved_at = new Date().toISOString();
        updateData.academic_rejection_reason = rejectionReason;
      } else {
        updateData.broker_approved_by_id = currentUser.id;
        updateData.broker_approved_by_name = currentUser.full_name;
        updateData.broker_approved_at = new Date().toISOString();
        updateData.broker_rejection_reason = rejectionReason;
      }

      await base44.entities.StudentRequest.update(selectedRequest.id, updateData);
      await logAction('reject_student_request', 'StudentRequest', selectedRequest.id, 
        `Rejected student request for ${selectedRequest.full_name}: ${rejectionReason}`, null, updateData);

      queryClient.invalidateQueries(['student-requests']);
      toast.success('Request rejected');
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (error) {
      toast.error('Failed to reject request');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const confirmTransfer = async () => {
    setProcessing(true);
    try {
      // Update existing student with new mentor info
      await base44.entities.Student.update(duplicateStudent.id, {
        primary_mentor_id: selectedRequest.requested_primary_mentor_id,
        primary_mentor_name: selectedRequest.requested_primary_mentor_name,
        senior_mentor_id: selectedRequest.requested_senior_mentor_id,
        senior_mentor_name: selectedRequest.requested_senior_mentor_name,
        assignment_status: 'assigned'
      });

      // Mark request as transferred
      await base44.entities.StudentRequest.update(selectedRequest.id, {
        status: 'TRANSFERRED',
        broker_approved_by_id: currentUser.id,
        broker_approved_by_name: currentUser.full_name,
        broker_approved_at: new Date().toISOString(),
        is_transfer: true,
        existing_student_id: duplicateStudent.id,
        previous_mentor_id: duplicateStudent.primary_mentor_id,
        previous_mentor_name: duplicateStudent.primary_mentor_name
      });

      await logAction('transfer_student', 'Student', duplicateStudent.id, 
        `Transferred student ${duplicateStudent.full_name} from ${duplicateStudent.primary_mentor_name} to ${selectedRequest.requested_primary_mentor_name}`, 
        { old_mentor: duplicateStudent.primary_mentor_name }, 
        { new_mentor: selectedRequest.requested_primary_mentor_name });

      queryClient.invalidateQueries(['student-requests']);
      queryClient.invalidateQueries(['students']);
      toast.success('Student transferred successfully');
      setShowTransferDialog(false);
      setSelectedRequest(null);
      setDuplicateStudent(null);
    } catch (error) {
      toast.error('Failed to transfer student');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING_ACADEMIC_APPROVAL': return 'bg-yellow-100 text-yellow-800';
      case 'PENDING_BROKER_APPROVAL': return 'bg-blue-100 text-blue-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'TRANSFERRED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Student Request Approvals
          </h1>
          <p className="text-gray-600 mt-2">
            {isAcademicHead ? 'Review and approve student registration requests' : 'Final approval and student creation'}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or requester..."
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
              Pending Requests ({filteredRequests.length})
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
                    <TableHead className="font-semibold">Requested By</TableHead>
                    <TableHead className="font-semibold">Primary Mentor</TableHead>
                    <TableHead className="font-semibold">Senior Mentor</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        No pending requests
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
                        <TableCell className="text-sm">{request.requested_by_name}</TableCell>
                        <TableCell className="text-sm">
                          {request.request_type === 'OPEN_POOL_ASSIGNMENT' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Open Pool → {request.requested_primary_mentor_name}
                            </Badge>
                          ) : (
                            request.requested_primary_mentor_name
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{request.requested_senior_mentor_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(request.status)}>
                            {request.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(request)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReject(request)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
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

        {/* Approve Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Student Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Are you sure you want to approve this student {selectedRequest?.request_type === 'OPEN_POOL_ASSIGNMENT' ? 'assignment' : 'registration'} request?</p>
              {selectedRequest && (
                <div className="space-y-4">
                  {selectedRequest.request_type === 'OPEN_POOL_ASSIGNMENT' && (
                    <div className="bg-green-50 p-4 rounded-lg space-y-2 text-sm border border-green-200">
                      <p className="font-semibold text-green-900">Open Pool Assignment:</p>
                      <p><strong>Student:</strong> {selectedRequest.full_name}</p>
                      <p><strong>Email:</strong> {selectedRequest.email}</p>
                      <p><strong>Assign to:</strong> {selectedRequest.requested_primary_mentor_name}</p>
                      {selectedRequest.requested_senior_mentor_name && (
                        <p><strong>Senior Mentor:</strong> {selectedRequest.requested_senior_mentor_name}</p>
                      )}
                    </div>
                  )}
                  {selectedRequest.request_type !== 'OPEN_POOL_ASSIGNMENT' && (
                    <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm border border-blue-200">
                      <p className="font-semibold text-blue-900">New Request Details:</p>
                      <p><strong>Name:</strong> {selectedRequest.full_name}</p>
                      <p><strong>Email:</strong> {selectedRequest.email}</p>
                      <p><strong>Primary Mentor:</strong> {selectedRequest.requested_primary_mentor_name}</p>
                      {selectedRequest.requested_senior_mentor_name && (
                        <p><strong>Senior Mentor:</strong> {selectedRequest.requested_senior_mentor_name}</p>
                      )}
                    </div>
                  )}
                  
                  {duplicateStudent && (
                    <div className="bg-amber-50 p-4 rounded-lg space-y-2 text-sm border border-amber-200">
                      <p className="font-semibold text-amber-900">⚠️ Current Assignment (Info Only):</p>
                      <p><strong>Current Primary Mentor:</strong> {duplicateStudent.primary_mentor_name}</p>
                      {duplicateStudent.senior_mentor_name && (
                        <p><strong>Current Senior Mentor:</strong> {duplicateStudent.senior_mentor_name}</p>
                      )}
                      <p className="text-xs text-amber-700 mt-2">This student already exists in the system</p>
                    </div>
                  )}
                </div>
              )}
              
              {isBrokerAdmin && selectedRequest?.request_type !== 'OPEN_POOL_ASSIGNMENT' && (
                <div className="space-y-2">
                  <Label>User ID (from CRM)</Label>
                  <Input
                    placeholder="Enter user ID from CRM"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowApproveDialog(false); setUserId(''); }} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={confirmApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
                {processing ? 'Processing...' : 'Approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Student Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Please provide a reason for rejecting this request:</p>
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={confirmReject} disabled={processing} variant="destructive">
                {processing ? 'Processing...' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transfer Dialog */}
        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Duplicate Student Detected
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription>
                  A student with this email already exists. Do you want to transfer this student to the new mentor?
                </AlertDescription>
              </Alert>
              
              {duplicateStudent && selectedRequest && (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Existing Student:</p>
                    <p><strong>Name:</strong> {duplicateStudent.full_name}</p>
                    <p><strong>Email:</strong> {duplicateStudent.email}</p>
                    <p><strong>Current Primary Mentor:</strong> {duplicateStudent.primary_mentor_name}</p>
                    {duplicateStudent.senior_mentor_name && (
                      <p><strong>Current Senior Mentor:</strong> {duplicateStudent.senior_mentor_name}</p>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Transfer To:</p>
                    <p><strong>New Primary Mentor:</strong> {selectedRequest.requested_primary_mentor_name}</p>
                    {selectedRequest.requested_senior_mentor_name && (
                      <p><strong>New Senior Mentor:</strong> {selectedRequest.requested_senior_mentor_name}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowTransferDialog(false);
                setShowApproveDialog(true);
              }} disabled={processing}>
                Cancel Transfer
              </Button>
              <Button onClick={confirmTransfer} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
                {processing ? 'Processing...' : 'Transfer Student'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}