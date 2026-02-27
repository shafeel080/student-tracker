import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const allowedRoles = ['super_admin', 'broker_admin', 'academic_head'];
        if (!allowedRoles.includes(user.app_role)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { startDate, endDate } = body;

        // Fetch all approved funding transactions
        const allTransactions = await base44.asServiceRole.entities.FundingTransaction.list();

        // Filter by date range
        const filtered = allTransactions.filter(t => {
            const txDate = new Date(t.requested_at || t.created_date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return txDate >= start && txDate <= end && t.status === 'APPROVED';
        });

        // Aggregate by student
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

            if (tx.type === 'DEPOSIT') {
                studentMap[key].total_deposit += tx.amount_usd || 0;
            } else if (tx.type === 'WITHDRAWAL') {
                studentMap[key].total_withdrawal += tx.amount_usd || 0;
            }
            studentMap[key].transaction_count += 1;
        }

        // Calculate net for each student
        for (const key in studentMap) {
            studentMap[key].net = studentMap[key].total_deposit - studentMap[key].total_withdrawal;
        }

        const rows = Object.values(studentMap).sort((a, b) => b.total_deposit - a.total_deposit);

        // Totals
        const totals = rows.reduce((acc, r) => {
            acc.total_deposit += r.total_deposit;
            acc.total_withdrawal += r.total_withdrawal;
            acc.net += r.net;
            return acc;
        }, { total_deposit: 0, total_withdrawal: 0, net: 0 });

        return Response.json({ rows, totals });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});