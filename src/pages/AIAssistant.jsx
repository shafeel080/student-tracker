import React, { useState, useEffect, useRef } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Plus, MessageCircle, Loader2, Sparkles } from "lucide-react";
import MessageBubble from "../components/ai/MessageBubble";
import { toast } from "sonner";

export default function AIAssistant() {
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      loadConversations();
    };
    fetchUser();
  }, []);

  const loadConversations = async () => {
    try {
      const convos = await base44.agents.listConversations({
        agent_name: 'support_assistant'
      });
      setConversations(convos);
      
      if (convos.length > 0) {
        loadConversation(convos[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const conversation = await base44.agents.getConversation(conversationId);
      setActiveConversation(conversation);
      setMessages(conversation.messages || []);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
    }
  };

  const createNewConversation = async () => {
    try {
      const conversation = await base44.agents.createConversation({
        agent_name: 'support_assistant',
        metadata: {
          name: `Support Chat - ${new Date().toLocaleDateString()}`,
          description: 'Commission portal support conversation'
        }
      });
      setActiveConversation(conversation);
      setMessages([]);
      setConversations([conversation, ...conversations]);
      toast.success('New conversation started');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeConversation || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      await base44.agents.addMessage(activeConversation, {
        role: 'user',
        content: userMessage
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setInputMessage(userMessage);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (activeConversation) {
      const unsubscribe = base44.agents.subscribeToConversation(
        activeConversation.id,
        (data) => {
          setMessages(data.messages || []);
        }
      );

      return () => unsubscribe();
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bot className="h-8 w-8 text-blue-600" />
            AI Support Assistant
          </h1>
          <p className="text-gray-600 mt-1">Ask questions about commissions, transactions, and leaderboard</p>
        </div>

        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Conversations Sidebar */}
          <div className="col-span-3">
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Conversations</CardTitle>
                  <Button size="sm" onClick={createNewConversation} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors ${
                        activeConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conv.metadata?.name || 'Support Chat'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(conv.created_date).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="col-span-9">
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Support Assistant</CardTitle>
                    <p className="text-sm text-blue-100">Ask me anything about the commission portal</p>
                  </div>
                </div>
              </CardHeader>

              {!activeConversation ? (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Start a new conversation to get help</p>
                    <Button onClick={createNewConversation} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      New Conversation
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <>
                  <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <Bot className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">Hi! I'm your AI assistant.</p>
                        <p className="text-sm text-gray-500">Ask me about commissions, transactions, or leaderboard rules.</p>
                      </div>
                    ) : (
                      messages.map((message, idx) => (
                        <MessageBubble key={idx} message={message} />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </CardContent>

                  <div className="border-t p-4 bg-gray-50">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Ask a question..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        disabled={isSending}
                        className="flex-1"
                      />
                      <Button 
                        onClick={sendMessage} 
                        disabled={isSending || !inputMessage.trim()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}