import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StudentTable from "../components/students/StudentTable";
import { Plus, Search } from "lucide-react";
import { canViewAllStudents, isMentorRole, canEditData } from "../components/utils/DataMasking";
import { toast } from "sonner";

export default function Students() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    mentor_id: '',
    mt5_id: '',
    user_id: '',
    status: 'active',
    join_date: new Date().toISOString().split('T')[0]
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      if (isMentorRole(user.role)) {
        setFormData(prev => ({ ...prev, mentor_id: user.id }));
      }
    };
    fetchUser();
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date'),
    enabled: !!currentUser
  });

  const { data: mentors = [] } = useQuery({
    queryKey: ['mentors'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.filter(u => u.role === 'senior_mentor' || u.role === 'junior_mentor');
    },
    enabled: !!currentUser
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Student.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowAddDialog(false);
      toast.success('Student added successfully');
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Student.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      setShowEditDialog(false);
      toast.success('Student updated successfully');
      setSelectedStudent(null);
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      mentor_id: currentUser && isMentorRole(currentUser.role) ? currentUser.id : '',
      mt5_id: '',
      user_id: '',
      status: 'active',
      join_date: new Date().toISOString().split('T')[0]
    });
  };

  const handleSubmit = () => {
    const mentor = mentors.find(m => m.id === formData.mentor_id);
    const dataToSave = {
      ...formData,
      mentor_name: mentor?.full_name || ''
    };
    createMutation.mutate(dataToSave);
  };

  const handleEdit = (student) => {
    if (!canEditData(currentUser?.role)) {
      toast.error('You do not have permission to edit students');
      return;
    }
    setSelectedStudent(student);
    setFormData(student);
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    const mentor = mentors.find(m => m.id === formData.mentor_id);
    const dataToUpdate = {
      ...formData,
      mentor_name: mentor?.full_name || ''
    };
    updateMutation.mutate({ id: selectedStudent.id, data: dataToUpdate });
  };

  if (!currentUser) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  // Filter students based on role and search
  let filteredStudents = canViewAllStudents(currentUser.role)
    ? students
    : isMentorRole(currentUser.role)
    ? students.filter(s => s.mentor_id === currentUser.id)
    : [];

  if (searchTerm) {
    filteredStudents = filteredStudents.filter(s =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Students</h1>
          <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
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

        {/* Table */}
        <StudentTable
          students={filteredStudents}
          currentUser={currentUser}
          onView={(student) => setSelectedStudent(student)}
          onEdit={handleEdit}
        />

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mentor *</Label>
                <Select
                  value={formData.mentor_id}
                  onValueChange={(value) => setFormData({ ...formData, mentor_id: value })}
                  disabled={isMentorRole(currentUser?.role)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mentor" />
                  </SelectTrigger>
                  <SelectContent>
                    {mentors.map((mentor) => (
                      <SelectItem key={mentor.id} value={mentor.id}>
                        {mentor.full_name} ({mentor.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>MT5 ID</Label>
                <Input
                  value={formData.mt5_id}
                  onChange={(e) => setFormData({ ...formData, mt5_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Join Date</Label>
                <Input
                  type="date"
                  value={formData.join_date}
                  onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Student'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog (Super Admin only) */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Student'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}