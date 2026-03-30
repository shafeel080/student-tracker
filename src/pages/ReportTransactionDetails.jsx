import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function ReportTransactionDetails() {
    const navigate = useNavigate();
    const params = new URLSearchParams(window.location.search);
    const filterType = params.get('filterType'); // 'mentor', 'student', 'added_by'
    const filterId = params.get('filterId');
    const filterName = params.get('filterName');
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');
    const dateLabel = params.get('dateLabel');

    const { data: allTransactions = [], isLoading } = useQuery({
        queryKey: ['funding-transactions-approved-detail'],
        queryFn: () => base44.entities.FundingTransaction.filter({ status: 'APPROVED' }),
    });

    const transactions = useMemo(() => {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;

        return allTransactions.filter(t => {
            const txDate = new Date(t.requested_at || t.created_date);
            if (start && txDate < start) return false;
            if (end && txDate > end) return false;

            if (filterType === 'mentor') return t.primary_mentor_id === filterId;
            if (filterType === 'student') return t.student_id === filterId;
            if (filterType === 'added_by') return (t.initiating_mentor_id || t.requested_by_id) === filterId;
            return true;
        });
    }, [allTransactions, filterType, filterId, startDate, endDate]);

    const totals = useMemo(() => transactions.reduce((acc, t) => {
        if (t.type === 'DEPOSIT') acc.deposit += t.amount_usd || 0;
        else if (t.type === 'WITHDRAWAL') acc.withdrawal += t.amount_usd || 0;
        return acc;
    }, { deposit: 0, withdrawal: 0 }), [transactions]);

    const handleExport = () => {
        const headers = ['Date', 'Student Code', 'Student', 'Primary Mentor', 'Senior Mentor', 'Added By', 'Type', 'Amount (USD)', 'Payment Method', 'Transaction ID'];
        const rows = transactions.map(t => [
            t.requested_at ? format(new Date(t.requested_at), 'dd MMM yyyy HH:mm') : '',
            t.student_code || '',
            `"${t.student_name || ''}"`,
            `"${t.primary_mentor_name || ''}"`,
            `"${t.senior_mentor_name || ''}"`,
            `"${t.initiating_mentor_name || t.requested_by_name || ''}"`,
            t.type,
            (t.amount_usd || 0).toFixed(2),
            `"${t.payment_method || ''}"`,
            t.transaction_id || ''
        ].join(','));
        const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `transactions_${filterName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
    };

    return (
        <div className="p-6 max-w-full">
            <div className="flex items-center gap-3 mb-6">
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Transaction Details</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {filterName} · {dateLabel}
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    <p className="ml-3 text-gray-500">Loading transactions...</p>
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-5">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-xs text-green-600 font-medium uppercase">Total Deposits</p>
                            <p className="text-2xl font-bold text-green-700 mt-1">${totals.deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-xs text-red-600 font-medium uppercase">Total Withdrawals</p>
                            <p className="text-2xl font-bold text-red-700 mt-1">${totals.withdrawal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className={`border rounded-xl p-4 ${(totals.deposit - totals.withdrawal) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                            <p className={`text-xs font-medium uppercase ${(totals.deposit - totals.withdrawal) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net</p>
                            <p className={`text-2xl font-bold mt-1 ${(totals.deposit - totals.withdrawal) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                ${(totals.deposit - totals.withdrawal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-500">{transactions.length} transactions</p>
                        <Button variant="outline" size="sm" onClick={handleExport} disabled={!transactions.length}>
                            <Download className="h-4 w-4 mr-1" /> Export CSV
                        </Button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Student</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Primary Mentor</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Senior Mentor</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Added By</th>
                                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Type</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount (USD)</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Commission (4%)</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment Method</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Txn ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.length === 0 ? (
                                        <tr><td colSpan={10} className="text-center py-12 text-gray-400">No transactions found.</td></tr>
                                    ) : transactions.map((t, idx) => (
                                        <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 ${idx % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                                {t.requested_at ? format(new Date(t.requested_at), 'dd MMM yyyy') : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.student_code || '—'}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">{t.student_name}</td>
                                            <td className="px-4 py-3 text-gray-600">{t.primary_mentor_name || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">{t.senior_mentor_name || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">{t.initiating_mentor_name || t.requested_by_name || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge variant={t.type === 'DEPOSIT' ? 'default' : 'destructive'} className="text-xs">
                                                    {t.type}
                                                </Badge>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${t.type === 'DEPOSIT' ? 'text-green-700' : 'text-red-600'}`}>
                                                ${(t.amount_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-purple-700">
                                                {t.type === 'DEPOSIT' ? `$${((t.amount_usd || 0) * 0.04).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">{t.payment_method || '—'}</td>
                                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.transaction_id || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}