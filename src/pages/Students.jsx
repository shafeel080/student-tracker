import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StudentForm from "../components/students/StudentForm";
import BulkImportStudentsDialog from "../components/students/BulkImportStudentsDialog";
import { Plus, Search, Eye, Users, UserCheck, Upload } from "lucide-react";
import { 
  canCreateStudent, 
  filterStudentsByRole, 
  applyStudentMasking,
  generateStudentCode
} from "../components/utils/StudentAccessControl";
import { createPageUrl } from "../utils";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Students() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('my');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date'),
    enabled: !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        return await base44.entities.User.list();
      } catch (error) {
        console.warn('Unable to fetch users, using limited data:', error);
        return [];
      }
    },
    enabled: !!currentUser,
    retry: false
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const studentCode = await generateStudentCode(base44);
      return base44.entities.Student.create({
        ...data,
        student_code: studentCode
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowAddDialog(false);
      toast.success('Student created successfully');
    }
  });

  const handleSubmit = (formData) => {
    createMutation.mutate(formData);
  };

  if (!currentUser) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const canCreate = canCreateStudent(currentUser.app_role);
  const isMentor = ['junior_mentor', 'senior_mentor'].includes(currentUser.app_role);
  const isSeniorMentor = currentUser.app_role === 'senior_mentor';

  // Get mentor users for bulk import
  const mentorUsers = users.filter(u => 
    ['junior_mentor', 'senior_mentor'].includes(u.app_role)
  );

  // For mentors: filter students into My and Team
  // For admins: show all students
  let myStudents = [];
  let teamStudents = [];
  let allStudents = students;

  if (isMentor) {
    // Filter MY students - students where I am the primary mentor
    myStudents = students.filter(s => s.primary_mentor_id === currentUser.id);
    
    // Filter TEAM students - students where I am the senior mentor but NOT the primary mentor
    teamStudents = students.filter(s => 
      currentUser.app_role === 'senior_mentor' && 
      s.senior_mentor_id === currentUser.id &&
      s.primary_mentor_id !== currentUser.id
    );
  }

  // Apply search filter
  let filteredStudents;
  if (isMentor) {
    const activeStudents = activeTab === 'my' ? myStudents : teamStudents;
    filteredStudents = activeStudents;
    
    if (searchTerm) {
      filteredStudents = activeStudents.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  } else {
    // Admins see all students
    filteredStudents = allStudents;
    if (searchTerm) {
      filteredStudents = allStudents.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  }
  
  // Apply masking to displayed students
  const displayStudents = filteredStudents.map(s => applyStudentMasking(s, currentUser.app_role));
  
  const getStatusColor = (status) => {
    return status === 'ACTIVE' 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Students</h1>
          {canCreate && (isMentor ? activeTab === 'my' : true) && (
            <div className="flex gap-3">
              <Button onClick={() => setShowBulkImportDialog(true)} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
              <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs (only for mentors) */}
        {isMentor ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md" style={{ gridTemplateColumns: isSeniorMentor ? '1fr 1fr' : '1fr' }}>
              <TabsTrigger value="my">My Students</TabsTrigger>
              {isSeniorMentor && (
                <TabsTrigger value="team">Team Students</TabsTrigger>
              )}
            </TabsList>

            {/* My Students Tab */}
            <TabsContent value="my">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  My Students ({displayStudents.length})
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student Code</TableHead>
                    <TableHead className="font-semibold">Full Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Phone</TableHead>
                    <TableHead className="font-semibold">Country</TableHead>
                    <TableHead className="font-semibold">Primary Mentor</TableHead>
                    <TableHead className="font-semibold">Senior Mentor</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        No students found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayStudents.map((student) => (
                      <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-mono text-sm font-medium text-blue-600">
                          {student.student_code}
                        </TableCell>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell className="text-sm">{student.email}</TableCell>
                        <TableCell className="text-sm font-mono">{student.phone}</TableCell>
                        <TableCell className="text-sm">{student.country || '-'}</TableCell>
                        <TableCell className="text-sm">{student.primary_mentor_name}</TableCell>
                        <TableCell className="text-sm">{student.senior_mentor_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(student.status)}>
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {student.created_date ? format(new Date(student.created_date), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={createPageUrl('StudentDetail') + '?id=' + student.id}>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Team Students Tab */}
          {isSeniorMentor && (
            <TabsContent value="team">
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="p-4 bg-purple-50 border-b border-purple-200">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Team Students ({displayStudents.length})
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Student Code</TableHead>
                      <TableHead className="font-semibold">Full Name</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Phone</TableHead>
                      <TableHead className="font-semibold">Country</TableHead>
                      <TableHead className="font-semibold">Primary Mentor</TableHead>
                      <TableHead className="font-semibold">Senior Mentor</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                          No team students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayStudents.map((student) => (
                        <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-mono text-sm font-medium text-blue-600">
                            {student.student_code}
                          </TableCell>
                          <TableCell className="font-medium">{student.full_name}</TableCell>
                          <TableCell className="text-sm">{student.email}</TableCell>
                          <TableCell className="text-sm font-mono">{student.phone}</TableCell>
                          <TableCell className="text-sm">{student.country || '-'}</TableCell>
                          <TableCell className="text-sm text-purple-600 font-medium">{student.primary_mentor_name}</TableCell>
                          <TableCell className="text-sm">{student.senior_mentor_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(student.status)}>
                              {student.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {student.created_date ? format(new Date(student.created_date), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={createPageUrl('StudentDetail') + '?id=' + student.id}>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
          </Tabs>
        ) : (
          /* Admin view - all students in one table */
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                All Students ({displayStudents.length})
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Student Code</TableHead>
                  <TableHead className="font-semibold">Full Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Country</TableHead>
                  <TableHead className="font-semibold">Primary Mentor</TableHead>
                  <TableHead className="font-semibold">Senior Mentor</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      No students found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayStudents.map((student) => (
                    <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-mono text-sm font-medium text-blue-600">
                        {student.student_code}
                      </TableCell>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="text-sm">{student.email}</TableCell>
                      <TableCell className="text-sm font-mono">{student.phone}</TableCell>
                      <TableCell className="text-sm">{student.country || '-'}</TableCell>
                      <TableCell className="text-sm">{student.primary_mentor_name}</TableCell>
                      <TableCell className="text-sm">{student.senior_mentor_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(student.status)}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {student.created_date ? format(new Date(student.created_date), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={createPageUrl('StudentDetail') + '?id=' + student.id}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <StudentForm
              onSubmit={handleSubmit}
              onCancel={() => setShowAddDialog(false)}
              isSubmitting={createMutation.isPending}
              users={users}
            />
          </DialogContent>
        </Dialog>

        {/* Bulk Import Dialog */}
        <BulkImportStudentsDialog
          open={showBulkImportDialog}
          onOpenChange={setShowBulkImportDialog}
          onImportComplete={() => {
            queryClient.invalidateQueries(['students']);
            setShowBulkImportDialog(false);
          }}
          mentors={mentorUsers}
        />
      </div>
    </div>
  );
}