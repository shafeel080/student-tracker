import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Sparkles, Loader2, Users, DollarSign, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";

export default function SmartSearch({ students = [], transactions = [], tickets = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    try {
      const prompt = `You are a smart search assistant. The user is searching for: "${query}"

Available data:
- ${students.length} students
- ${transactions.length} transactions  
- ${tickets.length} tickets

Analyze the query and return matching results in this JSON format:
{
  "interpretation": "Brief explanation of what you understood",
  "students": [{"id": "student_id", "name": "name", "relevance": "why it matches"}],
  "transactions": [{"id": "transaction_id", "description": "description", "relevance": "why it matches"}],
  "tickets": [{"id": "ticket_id", "title": "title", "relevance": "why it matches"}]
}

Student data: ${JSON.stringify(students.map(s => ({ id: s.id, name: s.full_name, email: s.email, code: s.student_code, mentor: s.primary_mentor_name })).slice(0, 50))}

Transaction data: ${JSON.stringify(transactions.map(t => ({ id: t.id, student: t.student_name, type: t.type, amount: t.amount_usd, status: t.status })).slice(0, 50))}

Ticket data: ${JSON.stringify(tickets.map(tk => ({ id: tk.id, title: tk.title, category: tk.category, status: tk.status })).slice(0, 50))}

Return relevant matches based on the query. Include max 5 results per category.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            interpretation: { type: "string" },
            students: { type: "array" },
            transactions: { type: "array" },
            tickets: { type: "array" }
          }
        }
      });

      setResults(response);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="border-purple-200 text-purple-700 hover:bg-purple-50"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        AI Search
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Smart Search
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask anything... e.g., 'Show me inactive students' or 'Find pending high-priority tickets'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={searching}
              />
              <Button
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {results && (
              <div className="space-y-4">
                <Card className="bg-blue-50 border-blue-200 p-3">
                  <p className="text-sm text-blue-800">
                    <strong>AI understood:</strong> {results.interpretation}
                  </p>
                </Card>

                {/* Students */}
                {results.students?.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      Students ({results.students.length})
                    </h3>
                    <div className="space-y-2">
                      {results.students.map((student, idx) => {
                        const fullStudent = students.find(s => s.id === student.id);
                        return (
                          <Link
                            key={idx}
                            to={createPageUrl(`StudentDetail?id=${student.id}`)}
                            onClick={() => setOpen(false)}
                          >
                            <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-600">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{student.name || fullStudent?.full_name}</p>
                                  <p className="text-xs text-gray-500 mt-1">{student.relevance}</p>
                                </div>
                                {fullStudent?.student_code && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {fullStudent.student_code}
                                  </span>
                                )}
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Transactions */}
                {results.transactions?.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Transactions ({results.transactions.length})
                    </h3>
                    <div className="space-y-2">
                      {results.transactions.map((transaction, idx) => {
                        const fullTransaction = transactions.find(t => t.id === transaction.id);
                        return (
                          <Card key={idx} className="p-3 border-l-4 border-l-green-600">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{transaction.description || fullTransaction?.student_name}</p>
                                <p className="text-xs text-gray-500 mt-1">{transaction.relevance}</p>
                              </div>
                              {fullTransaction && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  fullTransaction.status === 'APPROVED' 
                                    ? 'bg-green-100 text-green-800' 
                                    : fullTransaction.status === 'PENDING'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {fullTransaction.status}
                                </span>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tickets */}
                {results.tickets?.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-purple-600" />
                      Tickets ({results.tickets.length})
                    </h3>
                    <div className="space-y-2">
                      {results.tickets.map((ticket, idx) => {
                        const fullTicket = tickets.find(tk => tk.id === ticket.id);
                        return (
                          <Card key={idx} className="p-3 border-l-4 border-l-purple-600">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{ticket.title || fullTicket?.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{ticket.relevance}</p>
                              </div>
                              {fullTicket && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  fullTicket.status === 'resolved' 
                                    ? 'bg-green-100 text-green-800' 
                                    : fullTicket.status === 'open'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {fullTicket.status}
                                </span>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {results.students?.length === 0 && 
                 results.transactions?.length === 0 && 
                 results.tickets?.length === 0 && (
                  <Card className="p-6 text-center text-gray-500">
                    <p>No results found for your query.</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}