import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PersonnelForm({ user, onSubmit, onClose, allUsers }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    app_role: 'junior_mentor',
    senior_mentor_id: '',
    senior_mentor_name: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        app_role: user.app_role || 'junior_mentor',
        senior_mentor_id: user.senior_mentor_id || '',
        senior_mentor_name: user.senior_mentor_name || ''
      });
    }
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const seniorMentors = allUsers?.filter(u => u.app_role === 'senior_mentor') || [];

  const handleSeniorMentorChange = (mentorId) => {
    const mentor = seniorMentors.find(m => m.id === mentorId);
    setFormData({
      ...formData,
      senior_mentor_id: mentorId,
      senior_mentor_name: mentor?.full_name || ''
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={!!user}
            />
            {user && <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>}
          </div>

          <div>
            <Label htmlFor="app_role">Role *</Label>
            <Select
              value={formData.app_role}
              onValueChange={(value) => setFormData({ ...formData, app_role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="broker_admin">Broker Admin</SelectItem>
                <SelectItem value="academic_head">Academic Head</SelectItem>
                <SelectItem value="academic_admin">Academic Admin</SelectItem>
                <SelectItem value="senior_mentor">Senior Mentor</SelectItem>
                <SelectItem value="junior_mentor">Junior Mentor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.app_role === 'junior_mentor' && (
            <div>
              <Label htmlFor="senior_mentor">Senior Mentor</Label>
              <Select
                value={formData.senior_mentor_id}
                onValueChange={handleSeniorMentorChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select senior mentor" />
                </SelectTrigger>
                <SelectContent>
                  {seniorMentors.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      {mentor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {user ? 'Update' : 'Add User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}