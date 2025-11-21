import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import TicketForm from "../components/tickets/TicketForm";
import { canCreateTicket, canReviewTicket, filterTicketsByRole } from "../components/utils/TicketAccessControl";

export default function Tickets() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStudent, setFilterStudent] = useState('all');
  const [filterMentor, setFilterMentor] = useState('all');
  const [reviewData, setReviewData] = useState({
    status: '',
    assigned_to: '',
    resolution: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.Ticket.list('-created_date'),
    enabled: !!currentUser
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
    enabled: !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        return await base44.entities.User.list();
      } catch (error) {
        return [];
      }
    },
    enabled: !!currentUser,
    retry: false
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Ticket.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
      setShowCreateDialog(false);
      toast.success('Ticket created successfully');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ticket.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
      setShowReviewDialog(false);
      setSelectedTicket(null);
      toast.success('Ticket updated successfully');
    }
  });

  const handleCreateSubmit = (formData) => {
    createMutation.mutate(formData);
  };

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    
    const assignedUser = users.find(u => u.id === reviewData.assigned_to);
    
    const dataToUpdate = {
      ...selectedTicket,
      status: reviewData.status,
      assigned_to: reviewData.assigned_to,
      assigned_to_name: assignedUser?.full_name || '',
      resolution: reviewData.resolution,
      resolved_date: reviewData.status === 'resolved' || reviewData.status === 'closed' 
        ? new Date().toISOString() 
        : selectedTicket.resolved_date
    };
    
    updateMutation.mutate({ id: selectedTicket.id, data: dataToUpdate });
  };

  const openReviewDialog = (ticket) => {
    setSelectedTicket(ticket);
    setReviewData({
      status: ticket.status,
      assigned_to: ticket.assigned_to || '',
      resolution: ticket.resolution || ''
    });
    setShowReviewDialog(true);
  };

  if (!currentUser) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const canCreate = canCreateTicket(currentUser.app_role);
  const canReview = canReviewTicket(currentUser.app_role);

  // Filter tickets
  let filteredTickets = filterTicketsByRole(currentUser, tickets);

  if (filterStatus !== 'all') {
    filteredTickets = filteredTickets.filter(t => t.status === filterStatus);
  }
  if (filterPriority !== 'all') {
    filteredTickets = filteredTickets.filter(t => t.priority === filterPriority);
  }
  if (filterCategory !== 'all') {
    filteredTickets = filteredTickets.filter(t => t.category === filterCategory);
  }
  if (filterStudent !== 'all') {
    filteredTickets = filteredTickets.filter(t => t.student_id === filterStudent);
  }
  if (filterMentor !== 'all') {
    filteredTickets = filteredTickets.filter(t => t.assigned_to === filterMentor);
  }
  if (searchTerm) {
    filteredTickets = filteredTickets.filter(t =>
      t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  const getStatusBadge = (status) => {
    const config = {
      open: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
      in_progress: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle },
      resolved: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
      closed: { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: XCircle }
    };
    const { color, icon: Icon } = config[status] || config.open;
    return (
      <Badge variant="outline" className={color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800 border-gray-200',
      medium: 'bg-blue-100 text-blue-800 border-blue-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      urgent: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <Badge variant="outline" className={colors[priority]}>
        {priority}
      </Badge>
    );
  };

  const mentorsInTickets = [...new Set(tickets.map(t => t.assigned_to).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
          {canCreate && (
            <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Priority</Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Student</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.student_code} - {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Assigned To</Label>
              <Select value={filterMentor} onValueChange={setFilterMentor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mentors</SelectItem>
                  {users.filter(u => mentorsInTickets.includes(u.id)).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Title</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Priority</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Student</TableHead>
                <TableHead className="font-semibold">Created By</TableHead>
                <TableHead className="font-semibold">Assigned To</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No tickets found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium max-w-xs truncate">
                      {ticket.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {ticket.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell className="text-sm">
                      {ticket.student_name || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ticket.created_by || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ticket.assigned_to_name || 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ticket.created_date ? format(new Date(ticket.created_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => openReviewDialog(ticket)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create Ticket Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
            </DialogHeader>
            <TicketForm
              onSubmit={handleCreateSubmit}
              onCancel={() => setShowCreateDialog(false)}
              isSubmitting={createMutation.isPending}
              students={students}
              users={users}
            />
          </DialogContent>
        </Dialog>

        {/* Review/Edit Ticket Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
            </DialogHeader>
            
            {selectedTicket && (
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <Label className="text-xs text-gray-600">Title</Label>
                    <p className="font-medium">{selectedTicket.title}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Description</Label>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-600">Category</Label>
                      <p className="text-sm capitalize">{selectedTicket.category}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Priority</Label>
                      <p className="text-sm capitalize">{selectedTicket.priority}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Student</Label>
                      <p className="text-sm">{selectedTicket.student_name || 'None'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Created By</Label>
                      <p className="text-sm">{selectedTicket.created_by}</p>
                    </div>
                  </div>
                  {selectedTicket.screenshot_url && (
                    <div>
                      <Label className="text-xs text-gray-600">Screenshot</Label>
                      <img 
                        src={selectedTicket.screenshot_url} 
                        alt="Ticket screenshot" 
                        className="mt-2 max-w-full h-auto rounded border"
                      />
                    </div>
                  )}
                </div>

                {canReview && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold">Update Ticket</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={reviewData.status}
                          onValueChange={(value) => setReviewData({ ...reviewData, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select
                          value={reviewData.assigned_to}
                          onValueChange={(value) => setReviewData({ ...reviewData, assigned_to: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>Unassigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.full_name} ({user.app_role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Resolution Notes</Label>
                      <Textarea
                        value={reviewData.resolution}
                        onChange={(e) => setReviewData({ ...reviewData, resolution: e.target.value })}
                        rows={4}
                        placeholder="Add resolution notes..."
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowReviewDialog(false)}
                  >
                    Close
                  </Button>
                  {canReview && (
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updateMutation.isPending ? 'Updating...' : 'Update Ticket'}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}