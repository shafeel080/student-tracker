import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

const PAYMENT_METHODS = [
  'AED TRANSFER',
  'UPI',
  'CARD PAYMENT',
  'USDT',
  'INR TRANSFER',
  'Cash deposit',
  'Other'
];

export default function ProcessFundingDialog({ transaction, open, onClose, onProcess }) {
  const [formData, setFormData] = useState({
    payment_method: '',
    mt5_account_id: '',
    mt5_login: '',
    user_id: '',
    transaction_id: '',
    notes: ''
  });

  const { data: mt5Accounts = [] } = useQuery({
    queryKey: ['mt5accounts', transaction?.student_id],
    queryFn: async () => {
      if (!transaction?.student_id) return [];
      const accounts = await base44.entities.MT5Account.list();
      return accounts.filter(acc => acc.student_id === transaction.student_id);
    },
    enabled: !!transaction?.student_id && open
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        payment_method: transaction.payment_method || '',
        mt5_account_id: transaction.mt5_account_id || '',
        mt5_login: transaction.mt5_login || '',
        user_id: transaction.user_id || '',
        transaction_id: transaction.transaction_id || '',
        notes: transaction.notes || ''
      });
    }
  }, [transaction]);

  const handleApprove = () => {
    const selectedMT5Account = mt5Accounts.find(acc => acc.id === formData.mt5_account_id);
    
    const updatedData = {
      ...formData,
      mt5_login: formData.mt5_account_id ? (selectedMT5Account?.mt5_login || formData.mt5_login) : formData.mt5_login,
      status: 'APPROVED'
    };
    
    onProcess(updatedData);
  };

  const handleReject = () => {
    const updatedData = {
      ...formData,
      status: 'REJECTED'
    };
    
    onProcess(updatedData);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Funding Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Type:</span>
                <span className="ml-2 font-semibold">{transaction.type}</span>
              </div>
              <div>
                <span className="text-gray-600">Amount:</span>
                <span className="ml-2 font-semibold">${transaction.amount_usd?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Student:</span>
                <span className="ml-2 font-semibold">{transaction.student_name}</span>
              </div>
              <div>
                <span className="text-gray-600">Code:</span>
                <span className="ml-2 font-mono font-semibold">{transaction.student_code}</span>
              </div>
            </div>
          </div>

          {/* Processing Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mt5_account">MT5 Account</Label>
              <Select
                value={formData.mt5_account_id}
                onValueChange={(value) => setFormData({ ...formData, mt5_account_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select MT5 account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {mt5Accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.mt5_login} ({account.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mt5_login">MT5 Login (Manual)</Label>
              <Input
                id="mt5_login"
                value={formData.mt5_login}
                onChange={(e) => setFormData({ ...formData, mt5_login: e.target.value })}
                placeholder="Or enter manually"
                disabled={!!formData.mt5_account_id}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_id">CRM User ID</Label>
              <Input
                id="user_id"
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                placeholder="Enter user ID"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="transaction_id">Transaction ID</Label>
              <Input
                id="transaction_id"
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                placeholder="Enter transaction ID"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes..."
                rows={3}
              />
            </div>
          </div>

          {transaction.screenshot_url && (
            <div className="space-y-2">
              <Label>Screenshot</Label>
              <a
                href={transaction.screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                View Screenshot
              </a>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            className="flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}