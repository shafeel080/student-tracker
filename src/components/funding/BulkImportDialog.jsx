import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Download, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function BulkImportDialog({ open, onClose, onImport, students, users }) {
  const [importType, setImportType] = useState('mentor');
  const [selectedMentor, setSelectedMentor] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const mentors = users.filter(u => u.app_role === 'junior_mentor' || u.app_role === 'senior_mentor');

  const generateCSVTemplate = () => {
    let csvContent = '';
    let filename = '';

    if (importType === 'mentor') {
      if (!selectedMentor) {
        toast.error('Please select a mentor');
        return;
      }
      const mentor = mentors.find(m => m.id === selectedMentor);
      const mentorStudents = students.filter(s => s.primary_mentor_id === selectedMentor);
      
      csvContent = 'student_code,student_name,type,amount_usd,payment_method,mt5_login,user_id,transaction_id,notes\n';
      mentorStudents.forEach(student => {
        csvContent += `${student.student_code},${student.full_name},DEPOSIT,0.00,,,,,\n`;
      });
      
      filename = `bulk_funding_${mentor.full_name.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    } else {
      if (!selectedStudent) {
        toast.error('Please select a student');
        return;
      }
      const student = students.find(s => s.id === selectedStudent);
      
      csvContent = 'student_code,student_name,type,amount_usd,payment_method,mt5_login,user_id,transaction_id,notes\n';
      csvContent += `${student.student_code},${student.full_name},DEPOSIT,0.00,,,,,\n`;
      
      filename = `bulk_funding_${student.student_code}_${Date.now()}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Template downloaded successfully');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      setFile(selectedFile);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
    return data;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      const transactions = rows.map(row => {
        const student = students.find(s => s.student_code === row.student_code);
        if (!student) {
          throw new Error(`Student not found: ${row.student_code}`);
        }

        return {
          type: row.type?.toUpperCase() || 'DEPOSIT',
          status: 'PENDING',
          student_id: student.id,
          student_name: student.full_name,
          student_code: student.student_code,
          primary_mentor_id: student.primary_mentor_id,
          primary_mentor_name: student.primary_mentor_name,
          senior_mentor_id: student.senior_mentor_id,
          senior_mentor_name: student.senior_mentor_name,
          amount_usd: parseFloat(row.amount_usd) || 0,
          payment_method: row.payment_method || '',
          mt5_login: row.mt5_login || '',
          user_id: row.user_id || '',
          transaction_id: row.transaction_id || '',
          notes: row.notes || ''
        };
      });

      await onImport(transactions);
      
      setFile(null);
      onClose();
      toast.success(`Successfully imported ${transactions.length} transactions`);
    } catch (error) {
      toast.error(error.message || 'Failed to import transactions');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Funding Transactions</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Import Type Selection */}
          <div className="space-y-2">
            <Label>Import Type</Label>
            <Select value={importType} onValueChange={setImportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mentor">By Mentor (All Students)</SelectItem>
                <SelectItem value="student">By Student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mentor/Student Selection */}
          {importType === 'mentor' ? (
            <div className="space-y-2">
              <Label>Select Mentor</Label>
              <Select value={selectedMentor} onValueChange={setSelectedMentor}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentors.map(mentor => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      {mentor.full_name} ({mentor.app_role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.student_code} - {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Download Template */}
          <div className="border-t pt-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <p className="text-sm text-gray-600">
                Download the CSV template, fill in the transaction details, and upload it back.
              </p>
            </div>
            <Button onClick={generateCSVTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </div>

          {/* Upload File */}
          <div className="border-t pt-4">
            <Label>Upload Filled CSV</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="mt-2"
            />
            {file && (
              <p className="text-sm text-green-600 mt-2">✓ {file.name}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={uploading || !file}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Transactions
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}