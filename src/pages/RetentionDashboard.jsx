import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, AlertCircle, CheckCircle2, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function RetentionDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('assigned');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [logAction, setLogAction] = useState('contact_made');
  const [logDescription, setLogDescription] = useState('');
  const [contactMethod, setContactMethod] = useState('phone');
  const [contactDate, setContactDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: assignedStudents = [] } = useQuery({
    queryKey: ['assigned-students', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const students = await base44.entities.Student.list('-created_date');
      return students.filter(s => s.assigned_draw_admin_id === currentUser.id);
    },
    enabled: !!currentUser
  });

  const { data: retentionLogs = [] } = useQuery({
    queryKey: ['retention-logs', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const logs = await base44.entities.RetentionLog.list('-logged_at');
      return logs.filter(l => l.draw_admin_id === currentUser.id);
    },
    enabled: !!currentUser
  });

  const addLogMutation = useMutation({
    mutationFn: async (data) => {
      const newLog = await base44.entities.RetentionLog.create({
        student_id: data.studentId,
        student_code: data.studentCode,
        student_name: data.studentName,
        draw_admin_id: currentUser.id,
        draw_admin_name: currentUser.full_name,
        action_type: logAction,
        description: logDescription,
        contact_date: logAction !== 'note_added' ? contactDate : null,
        contact_method: logAction === 'contact_made' ? contactMethod : null,
        logged_at: new Date().toISOString(),
        status: logAction === 'completed' ? 'completed' : 'in_progress'
      });

      // If status_updated, update the student's retention status
      if (logAction === 'completed') {
        await base44.entities.Student.update(data.studentId, {
          retention_status: 'completed'
        });
      }

      return newLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['retention-logs']);
      queryClient.invalidateQueries(['assigned-students']);
      toast.success('Retention log added successfully');
      setShowLogDialog(false);
      setSelectedStudent(null);
      setLogAction('contact_made');
      setLogDescription('');
      setContactMethod('phone');
      setContactDate(format(new Date(), 'yyyy-MM-dd'));
    },
    onError: (error) => {
      toast.error('Failed to add retention log');
      console.error(error);
    }
  });

  if (!currentUser) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (currentUser.app_role !== 'draw_admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 mt-2">Only Draw Admins can access the retention dashboard</p>
        </div>
      </div>
    );
  }

  const inProgressStudents = assignedStudents.filter(s => s.retention_status !== 'completed');
  const completedStudents = assignedStudents.filter(s => s.retention_status === 'completed');

  const filteredInProgress = inProgressStudents.filter(s =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCompleted = completedStudents.filter(s =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.student_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStudentLogs = (studentId) => {
    return retentionLogs.filter(l => l.student_id === studentId).sort((a, b) => 
      new Date(b.logged_at) - new Date(a.logged_at)
    );
  };

  const handleAddLog = () => {
    if (!logDescription.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (logAction === 'contact_made' && !contactDate) {
      toast.error('Please select a contact date');
      return;
    }
    addLogMutation.mutate({
      studentId: selectedStudent.id,
      studentCode: selectedStudent.student_code,
      studentName: selectedStudent.full_name
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Retention Dashboard</h1>
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-sm text-gray-600">Active Retention</p>
              <p className="text-2xl font-bold text-blue-600">{inProgressStudents.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedStudents.length}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by student name, code, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md">
            <TabsTrigger value="assigned">In Progress ({inProgressStudents.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedStudents.length})</TabsTrigger>
          </TabsList>

          {/* In Progress Tab */}
          <TabsContent value="assigned" className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student Code</TableHead>
                    <TableHead className="font-semibold">Full Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Phone</TableHead>
                    <TableHead className="font-semibold">Net Deposit (USD)</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInProgress.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No students in progress
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInProgress.map((student) => (
                      <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-mono text-sm font-medium text-blue-600">
                          {student.student_code}
                        </TableCell>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell className="text-sm">{student.email}</TableCell>
                        <TableCell className="text-sm font-mono">{student.phone}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          ${student.net_deposit_usd?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            In Progress
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowLogDialog(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Add Log
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student Code</TableHead>
                    <TableHead className="font-semibold">Full Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Net Deposit (USD)</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompleted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No completed retentions
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompleted.map((student) => (
                      <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-mono text-sm font-medium text-blue-600">
                          {student.student_code}
                        </TableCell>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell className="text-sm">{student.email}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          ${student.net_deposit_usd?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Log Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Retention Log Entry</DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6">
              {/* Student Info */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 space-y-2">
                  <div>
                    <p className="text-sm text-gray-600">Student Code</p>
                    <p className="font-semibold text-blue-600">{selectedStudent.student_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Student Name</p>
                    <p className="font-semibold">{selectedStudent.full_name}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Type */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Action Type</label>
                <Select value={logAction} onValueChange={setLogAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact_made">Contact Made</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="note_added">Note Added</SelectItem>
                    <SelectItem value="completed">Mark as Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Method (if contact_made) */}
              {logAction === 'contact_made' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Contact Method</label>
                  <Select value={contactMethod} onValueChange={setContactMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Contact Date (if contact_made) */}
              {logAction === 'contact_made' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Contact Date</label>
                  <Input
                    type="date"
                    value={contactDate}
                    onChange={(e) => setContactDate(e.target.value)}
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Description</label>
                <Textarea
                  placeholder="Enter details about the action taken..."
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                  className="h-24"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLogDialog(false);
                    setSelectedStudent(null);
                    setLogAction('contact_made');
                    setLogDescription('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLog}
                  disabled={addLogMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 flex-1"
                >
                  {addLogMutation.isPending ? 'Adding...' : 'Add Entry'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}