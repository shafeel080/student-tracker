import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { canResolveTicket, canCloseTicket } from '../utils/TicketAccessControl';

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200',
};

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function TicketChat({ ticket, messages = [], currentUser, onSendMessage, onResolve, onClose, isSending }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  const isClosed = ticket.status === 'closed';
  const isResolved = ticket.status === 'resolved';
  const userCanResolve = canResolveTicket(currentUser.app_role) && ticket.status === 'in_progress';
  const userCanClose = canCloseTicket(currentUser.app_role, currentUser.id, ticket) && isResolved;
  const isCreator = currentUser.id === ticket.created_by_id;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-gray-800 text-sm bg-white border border-gray-200 rounded px-2 py-0.5">{ticket.ticket_number || 'TKT-?????'}</span>
          <Badge variant="outline" className={STATUS_COLORS[ticket.status]}>{ticket.status?.replace('_', ' ')}</Badge>
          <Badge variant="outline" className="capitalize">{ticket.category}</Badge>
          <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
        </div>
        <h2 className="font-semibold text-gray-900 text-base">{ticket.title}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>By: <strong>{ticket.created_by_name}</strong></span>
          <span>Assigned to: <strong className="capitalize">{ticket.assigned_to_name || ticket.assigned_to_role?.replace(/_/g, ' ')}</strong></span>
          {ticket.student_name && <span>Student: <strong>{ticket.student_name}</strong></span>}
          <span>Created: {ticket.created_date ? format(new Date(ticket.created_date), 'MMM d, yyyy') : '-'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0" style={{ maxHeight: '420px' }}>
        {/* Original description as first system message */}
        {ticket.description && messages.length === 0 && (
          <div className="flex justify-center">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-lg text-xs text-gray-500 italic text-center">
              Original Description: {ticket.description}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isSystem = ['system_message', 'auto_close_warning', 'auto_closed'].includes(msg.message_type);
          const isMe = msg.sender_id === currentUser.id;

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="bg-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-600 italic max-w-sm text-center">
                  {msg.message}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs md:max-w-md lg:max-w-lg space-y-1`}>
                {!isMe && (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-xs font-semibold text-gray-700">{msg.sender_name}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{msg.sender_role?.replace(/_/g, ' ')}</Badge>
                  </div>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.message}
                </div>
                <p className={`text-xs text-gray-400 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                  {msg.created_date ? format(new Date(msg.created_date), 'MMM d, yyyy h:mm a') : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Action buttons */}
      {(userCanResolve || (isResolved && isCreator)) && (
        <div className="px-4 py-2 border-t border-gray-100 bg-white flex items-center gap-3">
          {userCanResolve && (
            <Button size="sm" onClick={onResolve} className="bg-green-600 hover:bg-green-700 gap-1">
              <CheckCircle2 className="h-4 w-4" /> Mark as Resolved
            </Button>
          )}
          {isResolved && isCreator && (
            <Button size="sm" onClick={onClose} variant="outline" className="gap-1 border-gray-300">
              <XCircle className="h-4 w-4" /> Confirm: Close this ticket
            </Button>
          )}
          {isResolved && !isCreator && (
            <p className="text-xs text-gray-500 italic">Waiting for <strong>{ticket.created_by_name}</strong> to confirm closure.</p>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white">
        {isClosed ? (
          <p className="text-center text-sm text-gray-400 italic py-1">This ticket has been closed.</p>
        ) : (
          <div className="flex gap-2 items-end">
            <Textarea
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message... (Enter to send)"
              className="flex-1 resize-none text-sm"
            />
            <Button size="icon" onClick={handleSend} disabled={isSending || !text.trim()} className="bg-blue-600 hover:bg-blue-700 h-10 w-10 flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}