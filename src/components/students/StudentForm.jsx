import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function StudentForm({ student, onSubmit, onCancel, isSubmitting, users: propUsers }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    country: '',
    primary_mentor_id: '',
    senior_mentor_id: '',
    status: 'ACTIVE',
    notes: ''
  });

  const { data: fetchedUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !propUsers
  });

  const users = propUsers || fetchedUsers;

  useEffect(() => {
    if (student) {
      setFormData(student);
    }
  }, [student]);

  const juniorMentors = users.filter(u => u.app_role === 'junior_mentor');
  const seniorMentors = users.filter(u => u.app_role === 'senior_mentor');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const primaryMentor = users.find(u => u.id === formData.primary_mentor_id);
    const seniorMentor = users.find(u => u.id === formData.senior_mentor_id);
    
    const dataToSubmit = {
      ...formData,
      primary_mentor_name: primaryMentor?.full_name || '',
      senior_mentor_name: seniorMentor?.full_name || ''
    };
    
    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primary_mentor">Primary Mentor (Junior)</Label>
          <Select
            value={formData.primary_mentor_id}
            onValueChange={(value) => setFormData({ ...formData, primary_mentor_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Junior Mentor" />
            </SelectTrigger>
            <SelectContent>
              {juniorMentors.map((mentor) => (
                <SelectItem key={mentor.id} value={mentor.id}>
                  {mentor.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="senior_mentor">Senior Mentor</Label>
          <Select
            value={formData.senior_mentor_id}
            onValueChange={(value) => setFormData({ ...formData, senior_mentor_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Senior Mentor (Optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None</SelectItem>
              {seniorMentors.map((mentor) => (
                <SelectItem key={mentor.id} value={mentor.id}>
                  {mentor.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Additional notes about the student..."
        />
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            student ? 'Update Student' : 'Create Student'
          )}
        </Button>
      </div>
    </form>
  );
}