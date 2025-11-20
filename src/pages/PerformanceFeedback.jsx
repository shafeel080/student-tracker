import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, TrendingUp, Users, Target, Award, Loader2, Download } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { toast } from "sonner";

export default function PerformanceFeedback() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      if (user.app_role === 'junior_mentor' || user.app_role === 'senior_mentor') {
        setSelectedMentor(user.id);
      }
    };
    fetchUser();
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['funding-transactions'],
    queryFn: () => base44.entities.FundingTransaction.list('-requested_at'),
    enabled: !!currentUser
  });

  const { data: mentorPoints = [] } = useQuery({
    queryKey: ['mentor-points'],
    queryFn: () => base44.entities.MentorPoints.list(),
    enabled: !!currentUser
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
    enabled: !!currentUser
  });

  const generateFeedback = async () => {
    if (!selectedMentor) {
      toast.error('Please select a mentor');
      return;
    }

    setIsGenerating(true);
    setFeedback('');

    try {
      const mentor = users.find(u => u.id === selectedMentor);
      const mentorTransactions = transactions.filter(t => t.primary_mentor_id === selectedMentor);
      const mentorStudents = students.filter(s => s.primary_mentor_id === selectedMentor);
      const points = mentorPoints.find(mp => mp.mentor_id === selectedMentor);

      const approvedDeposits = mentorTransactions.filter(t => t.status === 'APPROVED' && t.type === 'DEPOSIT');
      const approvedWithdrawals = mentorTransactions.filter(t => t.status === 'APPROVED' && t.type === 'WITHDRAWAL');
      const pendingTransactions = mentorTransactions.filter(t => t.status === 'PENDING');
      
      const totalDeposits = approvedDeposits.reduce((sum, t) => sum + (t.amount_usd || 0), 0);
      const totalWithdrawals = approvedWithdrawals.reduce((sum, t) => sum + (t.amount_usd || 0), 0);
      const netDeposit = totalDeposits - totalWithdrawals;

      const prompt = `Generate a personalized performance feedback report for a junior mentor with the following data:

**Mentor Profile:**
- Name: ${mentor?.full_name}
- Role: ${mentor?.app_role}
- Commission Rate: ${mentor?.commission_rate || 4}%

**Performance Metrics:**
- Total Net Deposit: $${netDeposit.toFixed(2)}
- Total Deposits: $${totalDeposits.toFixed(2)} (${approvedDeposits.length} transactions)
- Total Withdrawals: $${totalWithdrawals.toFixed(2)} (${approvedWithdrawals.length} transactions)
- Pending Transactions: ${pendingTransactions.length}
- Total Students: ${mentorStudents.length}
- Active Students: ${mentorStudents.filter(s => s.status === 'ACTIVE').length}

**Gamification Stats:**
${points ? `- Total Points: ${points.total_points || 0}
- Deposit Points: ${points.deposit_points || 0}
- Student Points: ${points.student_points || 0}
- Current Streak: ${points.current_streak_weeks || 0} weeks
- Unique Depositing Students: ${points.unique_depositing_students || 0}
- Badges: ${(points.badges || []).join(', ') || 'None yet'}` : '- No gamification data available yet'}

Please provide:
1. **Performance Summary**: Overall assessment of their performance
2. **Strengths**: What they're doing well (be specific with numbers)
3. **Areas for Improvement**: Where they can improve with actionable advice
4. **Recommendations**: 3-5 specific action items to boost their performance
5. **Motivation**: Encouraging words and next milestones to aim for

Be professional, constructive, and motivating. Use specific metrics from the data provided.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });

      setFeedback(response);
      toast.success('Feedback generated successfully');
    } catch (error) {
      console.error('Error generating feedback:', error);
      toast.error('Failed to generate feedback');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const mentors = users.filter(u => ['junior_mentor', 'senior_mentor'].includes(u.app_role));
  const canSelectMentor = ['super_admin', 'academic_head', 'academic_admin', 'senior_mentor'].includes(currentUser.app_role);
  const selectedMentorData = users.find(u => u.id === selectedMentor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-600" />
              AI Performance Feedback
            </h1>
            <p className="text-gray-600 mt-1">Generate personalized performance insights and recommendations</p>
          </div>
        </div>

        {/* Selection Card */}
        <Card className="border-purple-200 bg-white">
          <CardHeader className="border-b">
            <CardTitle className="text-lg font-semibold">Generate Feedback</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Select Mentor
                </label>
                <Select
                  value={selectedMentor}
                  onValueChange={setSelectedMentor}
                  disabled={!canSelectMentor}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a mentor" />
                  </SelectTrigger>
                  <SelectContent>
                    {mentors.map((mentor) => (
                      <SelectItem key={mentor.id} value={mentor.id}>
                        {mentor.full_name} ({mentor.app_role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canSelectMentor && (
                  <p className="text-xs text-gray-500 mt-1">Viewing your own performance</p>
                )}
              </div>
              <Button
                onClick={generateFeedback}
                disabled={isGenerating || !selectedMentor}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Feedback
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Display */}
        {feedback && (
          <Card className="border-purple-200 bg-white">
            <CardHeader className="border-b bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Performance Feedback for {selectedMentorData?.full_name}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={() => {
                    navigator.clipboard.writeText(feedback);
                    toast.success('Feedback copied to clipboard');
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ReactMarkdown
                className="prose prose-sm prose-purple max-w-none"
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold text-purple-900 mt-6 mb-3">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold text-purple-800 mt-5 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold text-purple-700 mt-4 mb-2">{children}</h3>,
                  p: ({ children }) => <p className="text-gray-700 leading-relaxed mb-3">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc ml-6 mb-3 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-6 mb-3 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-gray-700">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-purple-900">{children}</strong>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-purple-400 pl-4 italic text-gray-600 my-4">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {feedback}
              </ReactMarkdown>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!feedback && !isGenerating && (
          <Card className="border-gray-200 bg-white">
            <CardContent className="p-12 text-center">
              <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No feedback generated yet</p>
              <p className="text-sm text-gray-500">Select a mentor and click "Generate Feedback" to get AI-powered insights</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}