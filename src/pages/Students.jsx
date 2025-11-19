import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudentForm from "../components/students/StudentForm";
import { Plus, Search, Eye, Users } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('my-students');

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
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser
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

  // Filter students based on app_role
  let myStudents = filterStudentsByRole(students, currentUser, users);
  
  // Get team students for senior mentors
  let teamStudents = [];
  if (currentUser.app_role === 'senior_mentor') {
    const juniorMentors = users.filter(u => 
      u.app_role === 'junior_mentor' && u.senior_mentor_id === currentUser.id
    );
    
    teamStudents = students.filter(s => 
      juniorMentors.some(jm => jm.id === s.primary_mentor_id)
    );
  }
  
  // Apply search filter
  const applySearch = (studentsList) => {
    if (!searchTerm) return studentsList;
    return studentsList.filter(s =>
      s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  
  const filteredMyStudents = applySearch(myStudents);
  const filteredTeamStudents = applySearch(teamStudents);
  
  // Apply masking
  const displayMyStudents = filteredMyStudents.map(s => applyStudentMasking(s, currentUser.app_role));
  const displayTeamStudents = filteredTeamStudents.map(s => applyStudentMasking(s, currentUser.app_role));

  const canCreate = canCreateStudent(currentUser.app_role);
  
  const getStatusColor = (status) => {
    return status === 'ACTIVE' 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const StudentTable = ({ students }) => (
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
        {students.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} className="text-center py-8 text-gray-500">
              No students found
            </TableCell>
          </TableRow>
        ) : (
          students.map((student) => (
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
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Students</h1>
          {canCreate && (
            <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="my-students">My Students</TabsTrigger>
            {currentUser.app_role === 'senior_mentor' && (
              <TabsTrigger value="team-students">Team Students</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-students">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <StudentTable students={displayMyStudents} />
            </div>
          </TabsContent>

          {currentUser.app_role === 'senior_mentor' && (
            <TabsContent value="team-students">
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <StudentTable students={displayTeamStudents} />
              </div>
            </TabsContent>
          )}
        </Tabs>

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
      </div>
    </div>
  );
}