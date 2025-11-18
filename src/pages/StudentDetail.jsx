import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Edit } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import StudentForm from "../components/students/StudentForm";
import MT5AccountSection from "../components/students/MT5AccountSection";
import { 
  canEditStudent, 
  applyStudentMasking,
  filterStudentsByRole 
} from "../components/utils/StudentAccessControl";
import { toast } from "sonner";
import { format } from "date-fns";

export default function StudentDetail() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get('id');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const students = await base44.entities.Student.list();
      return students.find(s => s.id === studentId);
    },
    enabled: !!studentId && !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Student.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['student', studentId]);
      queryClient.invalidateQueries(['students']);
      setShowEditDialog(false);
      toast.success('Student updated successfully');
    }
  });

  const handleUpdate = (formData) => {
    updateMutation.mutate({ id: studentId, data: formData });
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">Student not found</p>
              <Link to={createPageUrl('Students')}>
                <Button className="mt-4">Back to Students</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if current user has access to this student
  const accessibleStudents = filterStudentsByRole([student], currentUser, users);
  if (accessibleStudents.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">You do not have access to view this student</p>
              <Link to={createPageUrl('Students')}>
                <Button className="mt-4">Back to Students</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const displayStudent = applyStudentMasking(student, currentUser.role);
  const canEdit = canEditStudent(currentUser.role);

  const getStatusColor = (status) => {
    return status === 'ACTIVE' 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('Students')}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Student Details</h1>
              <p className="text-gray-600 mt-1">
                <span className="font-mono font-semibold text-blue-600">
                  {displayStudent.student_code}
                </span>
              </p>
            </div>
          </div>
          {canEdit && (
            <Button onClick={() => setShowEditDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Edit className="h-4 w-4 mr-2" />
              Edit Student
            </Button>
          )}
        </div>

        {/* Student Information Card */}
        <Card className="border-gray-200">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">Student Information</CardTitle>
              <Badge variant="outline" className={getStatusColor(displayStudent.status)}>
                {displayStudent.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {displayStudent.full_name}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-base text-gray-900">
                  {displayStudent.email}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-base font-mono text-gray-900">
                  {displayStudent.phone}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Country</label>
                <p className="mt-1 text-base text-gray-900">
                  {displayStudent.country || '-'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Primary Mentor (Junior)</label>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {displayStudent.primary_mentor_name}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Senior Mentor</label>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {displayStudent.senior_mentor_name || '-'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <p className="mt-1 text-base text-gray-900">
                  {displayStudent.created_date 
                    ? format(new Date(displayStudent.created_date), 'MMMM d, yyyy')
                    : '-'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Created By</label>
                <p className="mt-1 text-base text-gray-900">
                  {displayStudent.created_by || '-'}
                </p>
              </div>
              
              {displayStudent.notes && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="mt-1 text-base text-gray-700 whitespace-pre-wrap">
                    {displayStudent.notes}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MT5 Accounts Section */}
        <MT5AccountSection student={student} currentUser={currentUser} />

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
            </DialogHeader>
            <StudentForm
              student={student}
              onSubmit={handleUpdate}
              onCancel={() => setShowEditDialog(false)}
              isSubmitting={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}