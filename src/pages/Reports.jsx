import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, Download, RefreshCw, Search } from 'lucide-react';

const DATE_TABS = ['Daily', 'Weekly', 'Monthly', 'Custom'];

function getDateRange(tab) {
    const now = new Date();
    switch (tab) {
        case 'Daily':
            return { start: startOfDay(now), end: endOfDay(now) };
        case 'Weekly':
            return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'Monthly':
            return { start: startOfMonth(now), end: endOfMonth(now) };
        default:
            return { start: startOfDay(now), end: endOfDay(now) };
    }
}

export default function Reports() {
    const [activeTab, setActiveTab] = useState('Daily');
    const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [search, setSearch] = useState('');

    const dateRange = activeTab === 'Custom'
        ? { start: new Date(customStart), end: new Date(customEnd) }
        : getDateRange(activeTab);

    const { data: allTransactions = [], isLoading, refetch } = useQuery({
        queryKey: ['funding-transactions-approved'],
        queryFn: () => base44.entities.FundingTransaction.filter({ status: 'APPROVED' }),
    });

    const { rows, totals } = useMemo(() => {
        const start = dateRange.start;
        const end = dateRange.end;

        const filtered = allTransactions.filter(t => {
            const txDate = new Date(t.requested_at || t.created_date);
            return txDate >= start && txDate <= end;
        });

        const studentMap = {};
        for (const tx of filtered) {
            const key = tx.student_id;
            if (!studentMap[key]) {
                studentMap[key] = {
                    student_id: tx.student_id,
                    student_name: tx.student_name,
                    student_code: tx.student_code || '',
                    primary_mentor_name: tx.primary_mentor_name || '',
                    senior_mentor_name: tx.senior_mentor_name || '',
                    total_deposit: 0,
                    total_withdrawal: 0,
                    net: 0,
                    transaction_count: 0,
                };
            }
            if (tx.type === 'DEPOSIT') studentMap[key].total_deposit += tx.amount_usd || 0;
            else if (tx.type === 'WITHDRAWAL') studentMap[key].total_withdrawal += tx.amount_usd || 0;
            studentMap[key].transaction_count += 1;
        }

        for (const key in studentMap) {
            studentMap[key].net = studentMap[key].total_deposit - studentMap[key].total_withdrawal;
        }

        let rows = Object.values(studentMap).sort((a, b) => b.total_deposit - a.total_deposit);

        if (search) {
            const s = search.toLowerCase();
            rows = rows.filter(r =>
                r.student_name?.toLowerCase().includes(s) ||
                r.primary_mentor_name?.toLowerCase().includes(s) ||
                r.senior_mentor_name?.toLowerCase().includes(s) ||
                r.student_code?.toLowerCase().includes(s)
            );
        }

        const totals = rows.reduce((acc, r) => {
            acc.total_deposit += r.total_deposit;
            acc.total_withdrawal += r.total_withdrawal;
            acc.net += r.net;
            return acc;
        }, { total_deposit: 0, total_withdrawal: 0, net: 0 });

        return { rows, totals };
    }, [allTransactions, dateRange, search]);

    const handleExportCSV = () => {
        const headers = ['Student Code', 'Student Name', 'Primary Mentor', 'Senior Mentor', 'Deposits (USD)', 'Withdrawals (USD)', 'Net (USD)', 'Transactions'];
        const csvRows = [
            headers.join(','),
            ...rows.map(r => [
                r.student_code,
                `"${r.student_name}"`,
                `"${r.primary_mentor_name}"`,
                `"${r.senior_mentor_name}"`,
                r.total_deposit.toFixed(2),
                r.total_withdrawal.toFixed(2),
                r.net.toFixed(2),
                r.transaction_count,
            ].join(','))
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${activeTab}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {dateRange.start instanceof Date && !isNaN(dateRange.start) ? format(dateRange.start, 'dd MMM yyyy') : '—'} – {dateRange.end instanceof Date && !isNaN(dateRange.end) ? format(dateRange.end, 'dd MMM yyyy') : '—'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!rows.length}>
                        <Download className="h-4 w-4 mr-1" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Date Tabs + Custom Range */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {DATE_TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'Custom' && (
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <Input
                            type="date"
                            value={customStart}
                            onChange={e => setCustomStart(e.target.value)}
                            className="w-40 h-9 text-sm"
                        />
                        <span className="text-gray-400 text-sm">to</span>
                        <Input
                            type="date"
                            value={customEnd}
                            onChange={e => setCustomEnd(e.target.value)}
                            className="w-40 h-9 text-sm"
                        />
                    </div>
                )}

                {/* Search */}
                <div className="relative ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search student or mentor..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 w-64 h-9 text-sm"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Total Deposits</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">${totals.total_deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Total Withdrawals</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">${totals.total_withdrawal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`border rounded-xl p-4 ${totals.net >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                    <p className={`text-xs font-medium uppercase tracking-wide ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net</p>
                    <p className={`text-2xl font-bold mt-1 ${totals.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        ${totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <p className="ml-3 text-gray-500">Loading report data...</p>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-lg font-medium">No approved transactions found</p>
                        <p className="text-sm mt-1">Try adjusting the date range or search filter.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Student Name</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Primary Mentor</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Senior Mentor</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Deposit (USD)</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Withdrawal (USD)</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Net (USD)</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Txns</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={row.student_id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.student_code || '—'}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{row.student_name}</td>
                                        <td className="px-4 py-3 text-gray-600">{row.primary_mentor_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600">{row.senior_mentor_name || '—'}</td>
                                        <td className="px-4 py-3 text-right font-medium text-green-700">
                                            {row.total_deposit > 0 ? `$${row.total_deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-red-600">
                                            {row.total_withdrawal > 0 ? `$${row.total_withdrawal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${row.net >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                                            ${row.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant="secondary">{row.transaction_count}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                                    <td colSpan={4} className="px-4 py-3 text-gray-700">Total ({rows.length} students)</td>
                                    <td className="px-4 py-3 text-right text-green-700">${totals.total_deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-right text-red-600">${totals.total_withdrawal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td className={`px-4 py-3 text-right ${totals.net >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>${totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}