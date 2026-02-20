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
import StudentRequestForm from "../components/students/StudentRequestForm";
import BulkImportStudentsDialog from "../components/students/BulkImportStudentsDialog";
import { Plus, Search, Eye, Users, UserCheck, Upload, Download, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { 
  canSubmitStudentRequest, 
  canEditStudent,
  filterStudentsByRole, 
  applyStudentMasking,
  generateStudentCode
} from "../components/utils/StudentAccessControl";
import { createPageUrl } from "../utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAction } from "../components/utils/AuditLogger";

export default function Students() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('my');
  const [filterMentor, setFilterMentor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      // Set default tab based on user role
      if (['super_admin', 'broker_admin', 'academic_head'].includes(user.app_role)) {
        setActiveTab('all');
      }
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

  const { data: studentRequests = [] } = useQuery({
    queryKey: ['student-requests'],
    queryFn: () => base44.entities.StudentRequest.list('-created_date'),
    enabled: !!currentUser && currentUser.app_role === 'academic_admin'
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const studentCode = await generateStudentCode(base44);
      const newStudent = await base44.entities.Student.create({
        ...data,
        student_code: studentCode
      });
      await logAction('create_student', 'Student', newStudent.id, `Created student: ${data.full_name}`, null, data);
      return newStudent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowAddDialog(false);
      toast.success('Student created successfully');
    }
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const newRequest = await base44.entities.StudentRequest.create({
        ...data,
        requested_by_id: user.id,
        requested_by_name: user.full_name,
        requested_at: new Date().toISOString(),
        status: 'PENDING_ACADEMIC_APPROVAL'
      });
      await logAction('create_student_request', 'StudentRequest', newRequest.id, `Submitted student request: ${data.full_name}`, null, data);
      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['student-requests']);
      setShowAddDialog(false);
      toast.success('Student request submitted for approval');
    }
  });

  const requestOpenPoolStudentMutation = useMutation({
    mutationFn: async (student) => {
      const user = await base44.auth.me();
      const newRequest = await base44.entities.StudentRequest.create({
        request_type: 'OPEN_POOL_ASSIGNMENT',
        existing_student_id: student.id,
        full_name: student.full_name,
        email: student.email,
        phone: student.phone,
        country: student.country,
        requested_primary_mentor_id: user.id,
        requested_primary_mentor_name: user.full_name,
        requested_senior_mentor_id: user.app_role === 'junior_mentor' ? user.senior_mentor_id : '',
        requested_senior_mentor_name: user.app_role === 'junior_mentor' ? user.senior_mentor_name : '',
        requested_by_id: user.id,
        requested_by_name: user.full_name,
        requested_at: new Date().toISOString(),
        status: 'PENDING_ACADEMIC_APPROVAL',
        notes: `Request to assign open pool student to mentor`
      });
      await logAction('request_open_pool_student', 'StudentRequest', newRequest.id, `Requested assignment of open pool student: ${student.full_name}`, null, student);
      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['student-requests']);
      toast.success('Student assignment request submitted for approval');
    }
  });

  const handleSubmit = (formData) => {
    // For assistance users, auto-assign their mentor
    if (currentUser.app_role === 'assistance' && currentUser.assigned_mentor_id) {
      const mentorUser = users.find(u => u.id === currentUser.assigned_mentor_id);
      formData.primary_mentor_id = currentUser.assigned_mentor_id;
      formData.primary_mentor_name = currentUser.assigned_mentor_name;
      if (mentorUser?.senior_mentor_id) {
        formData.senior_mentor_id = mentorUser.senior_mentor_id;
        formData.senior_mentor_name = mentorUser.senior_mentor_name;
      }
    }
    
    if (isMentor || isAcademicAdmin) {
      createRequestMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!currentUser) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const canCreate = canSubmitStudentRequest(currentUser.app_role);
  const isMentor = ['junior_mentor', 'senior_mentor'].includes(currentUser.app_role);
  const isSeniorMentor = currentUser.app_role === 'senior_mentor';
  const isAssistance = currentUser.app_role === 'assistance';
  const isAdmin = ['super_admin', 'broker_admin', 'academic_head'].includes(currentUser.app_role);
  const isAcademicAdmin = currentUser.app_role === 'academic_admin';

  // Get mentor users for bulk import
  const mentorUsers = users.filter(u => 
    ['junior_mentor', 'senior_mentor'].includes(u.app_role)
  );

  // For mentors: filter students into My, Team, and Open Pool
  // For assistance: show only students of their assigned mentor
  // For academic_admin: show only students they created
  // For admins: show all students + open pool tab
  let myStudents = [];
  let teamStudents = [];
  let openPoolStudents = [];
  let allStudents = students;

  if (isAcademicAdmin) {
    // Academic admin sees students they requested (approved requests)
    const approvedRequestStudentIds = studentRequests
      .filter(r => r.requested_by_id === currentUser.id && r.created_student_id)
      .map(r => r.created_student_id);
    allStudents = students.filter(s => approvedRequestStudentIds.includes(s.id));
  } else if (isAssistance && currentUser.assigned_mentor_id) {
    // Assistance sees only students assigned to their mentor
    allStudents = students.filter(s => s.primary_mentor_id === currentUser.assigned_mentor_id);
  } else if (isMentor) {
    // Filter MY students - students where I am the primary mentor
    myStudents = students.filter(s => s.primary_mentor_id === currentUser.id);
    
    // Filter TEAM students - students where I am the senior mentor but NOT the primary mentor
    teamStudents = students.filter(s => 
      currentUser.app_role === 'senior_mentor' && 
      s.senior_mentor_id === currentUser.id &&
      s.primary_mentor_id !== currentUser.id
    );
    
    // Filter OPEN POOL students - students without assigned mentors
    openPoolStudents = students.filter(s => s.assignment_status === 'open_pool');
  } else if (isAdmin) {
    // Admins see open pool students in separate tab
    openPoolStudents = students.filter(s => s.assignment_status === 'open_pool');
  }

  // Get unique mentors for filter
  const uniqueMentors = [...new Set(students.map(s => s.primary_mentor_name))].filter(Boolean).sort();

  // Get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    if (filterDateRange === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { from: weekAgo, to: now };
    } else if (filterDateRange === 'monthly') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { from: monthAgo, to: now };
    } else if (filterDateRange === 'custom' && customDateFrom && customDateTo) {
      return { from: customDateFrom, to: customDateTo };
    }
    return null;
  };

  // Apply search filter
  let filteredStudents;
  if (isMentor) {
    const activeStudents = activeTab === 'my' ? myStudents : activeTab === 'team' ? teamStudents : openPoolStudents;
    filteredStudents = activeStudents;
    
    if (searchTerm) {
      filteredStudents = activeStudents.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  } else if (isAssistance || isAcademicAdmin) {
    // Assistance and academic_admin users see filtered students
    filteredStudents = allStudents;
    
    if (searchTerm) {
      filteredStudents = filteredStudents.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  } else if (isAdmin) {
    // Admins can switch between all students and open pool
    if (activeTab === 'open_pool') {
      filteredStudents = openPoolStudents;
    } else {
      filteredStudents = allStudents;
    }
    
    if (searchTerm) {
      filteredStudents = filteredStudents.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  } else {
    // Other roles see all students
    filteredStudents = allStudents;
    
    // Apply search filter
    if (searchTerm) {
      filteredStudents = filteredStudents.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply mentor filter
    if (filterMentor !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.primary_mentor_name === filterMentor);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.status === filterStatus);
    }

    // Apply date filter
    const dateRange = getDateRange();
    if (dateRange) {
      filteredStudents = filteredStudents.filter(s => {
        if (!s.created_date) return false;
        const createdDate = new Date(s.created_date);
        return createdDate >= dateRange.from && createdDate <= dateRange.to;
      });
    }
  }
  
  // Apply masking to displayed students
  const displayStudents = filteredStudents.map(s => applyStudentMasking(s, currentUser.app_role));
  
  const canEdit = canEditStudent(currentUser.app_role);
  
  const getStatusColor = (status) => {
    return status === 'ACTIVE' 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const handleExportStudents = () => {
    if (filteredStudents.length === 0) {
      toast.error('No students to export');
      return;
    }

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csvContent = [
      ['Student Code', 'Full Name', 'Email', 'Phone', 'Country', 'User ID', 'Primary Mentor', 'Senior Mentor', 'Status', 'Created Date', 'Notes'].join(','),
      ...filteredStudents.map(s => [
        escapeCSV(s.student_code || ''),
        escapeCSV(s.full_name || ''),
        escapeCSV(s.email || ''),
        escapeCSV(s.phone || ''),
        escapeCSV(s.country || ''),
        escapeCSV(s.user_id || ''),
        escapeCSV(s.primary_mentor_name || ''),
        escapeCSV(s.senior_mentor_name || ''),
        escapeCSV(s.status || ''),
        escapeCSV(s.created_date ? format(new Date(s.created_date), 'yyyy-MM-dd') : ''),
        escapeCSV(s.notes || '')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredStudents.length} students successfully`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Students</h1>
          <div className="flex gap-3">
            {['super_admin', 'broker_admin'].includes(currentUser.app_role) && (
              <Button onClick={handleExportStudents} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            {['super_admin', 'broker_admin'].includes(currentUser.app_role) && (
              <Button onClick={() => setShowBulkImportDialog(true)} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
            )}
            {canCreate && (isMentor ? activeTab === 'my' : true) && (
              <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                {isMentor ? 'Request Student' : isAssistance ? 'Add Student' : 'Add Student'}
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, code, email or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Admin Filters */}
              {['super_admin', 'broker_admin'].includes(currentUser.app_role) && (
                <>
                  {/* Mentor Filter */}
                  <Select value={filterMentor} onValueChange={setFilterMentor}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by Mentor" />
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

                  {/* Status Filter */}
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Date Filter */}
                  <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="weekly">Last 7 Days</SelectItem>
                      <SelectItem value="monthly">Last 30 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Custom Date Pickers */}
                  {filterDateRange === 'custom' && (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-36">
                            {customDateFrom ? format(customDateFrom, 'MMM d, yyyy') : 'From Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={customDateFrom}
                            onSelect={setCustomDateFrom}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-36">
                            {customDateTo ? format(customDateTo, 'MMM d, yyyy') : 'To Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={customDateTo}
                            onSelect={setCustomDateTo}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for mentors and admins, single table for assistance/others */}
        {isMentor || isAdmin ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-2xl" style={{ gridTemplateColumns: isMentor ? (isSeniorMentor ? '1fr 1fr 1fr' : '1fr 1fr') : '1fr 1fr' }}>
              {isMentor && <TabsTrigger value="my">My Students</TabsTrigger>}
              {isSeniorMentor && (
                <TabsTrigger value="team">Team Students</TabsTrigger>
              )}
              {isAdmin && <TabsTrigger value="all">All Students</TabsTrigger>}
              <TabsTrigger value="open_pool">Delta Open Students</TabsTrigger>
            </TabsList>

            {/* My Students Tab (Mentors Only) */}
            {isMentor && (
              <TabsContent value="my">
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                    <h3 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
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
                        <TableHead className="font-semibold">User ID</TableHead>
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
                          <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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
                            <TableCell className="text-sm font-mono">{student.user_id || '-'}</TableCell>
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
            )}

            {/* Team Students Tab (Senior Mentors Only) */}
            {isSeniorMentor && (
            <TabsContent value="team">
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                  <h3 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
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
                      <TableHead className="font-semibold">User ID</TableHead>
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
                       <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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
                         <TableCell className="text-sm font-mono">{student.user_id || '-'}</TableCell>
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

          {/* All Students Tab (Admins Only) */}
          {isAdmin && (
            <TabsContent value="all">
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
                  <h3 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
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
                      <TableHead className="font-semibold">User ID</TableHead>
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
                        <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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
                          <TableCell className="text-sm font-mono">{student.user_id || '-'}</TableCell>
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
          )}

          {/* Open Pool Students Tab */}
          <TabsContent value="open_pool">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
                <h3 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
                  <Users className="h-5 w-5 text-green-600" />
                  Delta Open Students ({displayStudents.length})
                </h3>
                <p className="text-sm text-gray-600 mt-1">Students available for mentor assignment</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student Code</TableHead>
                    <TableHead className="font-semibold">Full Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Phone</TableHead>
                    <TableHead className="font-semibold">Country</TableHead>
                    <TableHead className="font-semibold">User ID</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    {isMentor && <TableHead className="font-semibold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isMentor ? 9 : 8} className="text-center py-8 text-gray-500">
                        No open pool students available
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
                        <TableCell className="text-sm font-mono">{student.user_id || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(student.status)}>
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {student.created_date ? format(new Date(student.created_date), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        {isMentor && (
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              onClick={() => requestOpenPoolStudentMutation.mutate(student)}
                              disabled={requestOpenPoolStudentMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {requestOpenPoolStudentMutation.isPending ? 'Requesting...' : 'Request Student'}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          </Tabs>
        ) : (
          /* Admin view - all students in one table */
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
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
                  <TableHead className="font-semibold">User ID</TableHead>
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
                    <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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
                      <TableCell className="text-sm font-mono">{student.user_id || '-'}</TableCell>
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
              <DialogTitle>{isMentor || isAcademicAdmin ? 'Request New Student' : 'Add New Student'}</DialogTitle>
            </DialogHeader>
            {isMentor || isAcademicAdmin ? (
              <StudentRequestForm
                onSubmit={handleSubmit}
                onCancel={() => setShowAddDialog(false)}
                isSubmitting={createRequestMutation.isPending}
                users={users}
                currentUser={currentUser}
              />
            ) : (
              <StudentForm
                onSubmit={handleSubmit}
                onCancel={() => setShowAddDialog(false)}
                isSubmitting={createMutation.isPending}
                users={users}
                currentUser={currentUser}
              />
            )}
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