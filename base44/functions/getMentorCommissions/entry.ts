import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const allowedRoles = ['super_admin', 'broker_admin', 'academic_head', 'finance_admin', 'junior_mentor', 'senior_mentor'];
        if (!allowedRoles.includes(user.app_role)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const isMentor = ['junior_mentor', 'senior_mentor'].includes(user.app_role);

        const body = await req.json();
        const { startDate, endDate } = body;

        const BATCH = 100;
        const MAX_CAP = 25000;

        // Fetch all users to get real mentor names
        const allUsers = await base44.asServiceRole.entities.User.list();
        const userMap = {};
        for (const u of allUsers) {
            if (['junior_mentor', 'senior_mentor'].includes(u.app_role)) {
                userMap[u.id] = u.full_name;
            }
        }

        // Fetch all approved transactions
        let allTxs = [];
        let skip = 0;
        while (true) {
            const batch = await base44.asServiceRole.entities.FundingTransaction.filter(
                { status: 'APPROVED' }, 'requested_at', BATCH, skip
            );
            if (!Array.isArray(batch) || !batch.length) break;
            allTxs = allTxs.concat(batch);
            if (batch.length < BATCH) break;
            skip += BATCH;
        }

        // Fetch all manual adjustments
        let allAdjustments = [];
        skip = 0;
        while (true) {
            const batch = await base44.asServiceRole.entities.ManualCommissionAdjustment.list('-created_date', BATCH, skip);
            if (!Array.isArray(batch) || !batch.length) break;
            allAdjustments = allAdjustments.concat(batch);
            if (batch.length < BATCH) break;
            skip += BATCH;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Filter transactions by date range
        let filtered = allTxs.filter(t => {
            const d = new Date(t.requested_at || t.created_date);
            return d >= start && d <= end;
        });

        // Filter adjustments by date range
        let filteredAdj = allAdjustments.filter(a => {
            const d = new Date(a.created_date);
            return d >= start && d <= end;
        });

        // If mentor, restrict to own data only
        if (isMentor) {
            filtered = filtered.filter(t =>
                (t.initiating_mentor_id || t.primary_mentor_id) === user.id
            );
            filteredAdj = filteredAdj.filter(a => a.mentor_id === user.id);
        }

        // Group transactions by mentor (initiating_mentor_id or primary_mentor_id)
        const mentorMap = {};

        for (const tx of filtered) {
            const mentorId = tx.initiating_mentor_id || tx.primary_mentor_id;
            // Use real user name from User entity; fall back to stored name
            const mentorName = userMap[mentorId] || tx.initiating_mentor_name || tx.primary_mentor_name || 'Unknown';
            // Skip if not a real mentor
            if (!userMap[mentorId]) continue;

            if (!mentorMap[mentorId]) {
                mentorMap[mentorId] = {
                    mentor_id: mentorId,
                    mentor_name: mentorName,
                    transactions: [],
                    adjustments: [],
                };
            }
            mentorMap[mentorId].transactions.push(tx);
        }

        // Attach adjustments to mentors
        for (const adj of filteredAdj) {
            if (!mentorMap[adj.mentor_id]) {
                mentorMap[adj.mentor_id] = {
                    mentor_id: adj.mentor_id,
                    mentor_name: adj.mentor_name || 'Unknown',
                    transactions: [],
                    adjustments: [],
                };
            }
            mentorMap[adj.mentor_id].adjustments.push(adj);
        }

        // For each mentor, calculate commission with $25K cap per student
        const result = [];

        for (const mentorId in mentorMap) {
            const mentor = mentorMap[mentorId];
            const txs = mentor.transactions;
            const adjs = mentor.adjustments;

            // Per-student net deposit tracking
            const studentNetDeposits = {};
            let totalDeposit = 0;
            let totalWithdrawal = 0;

            for (const tx of txs) {
                const sid = tx.student_id;
                if (!studentNetDeposits[sid]) studentNetDeposits[sid] = 0;
                if (tx.type === 'DEPOSIT') {
                    studentNetDeposits[sid] += tx.amount_usd || 0;
                    totalDeposit += tx.amount_usd || 0;
                } else if (tx.type === 'WITHDRAWAL') {
                    studentNetDeposits[sid] -= tx.amount_usd || 0;
                    totalWithdrawal += tx.amount_usd || 0;
                }
            }

            // Apply $25K cap per student, floor at 0
            let commissionableNet = 0;
            for (const sid in studentNetDeposits) {
                const capped = Math.min(studentNetDeposits[sid], MAX_CAP);
                commissionableNet += Math.max(capped, 0);
            }

            const grossCommission = commissionableNet * 0.04;

            // Manual adjustments total
            const manualAdjTotal = adjs.reduce((sum, a) => sum + (a.amount_usd || 0), 0);

            const adjustedGross = grossCommission + manualAdjTotal;
            const release75 = adjustedGross * 0.75;
            const buffer25 = adjustedGross * 0.25;

            result.push({
                mentor_id: mentorId,
                mentor_name: mentor.mentor_name,
                total_deposit: totalDeposit,
                total_withdrawal: totalWithdrawal,
                net_deposit: totalDeposit - totalWithdrawal,
                commissionable_net: commissionableNet,
                gross_commission: grossCommission,
                manual_adjustment: manualAdjTotal,
                adjusted_gross: adjustedGross,
                release_75: release75,
                buffer_25: buffer25,
                transaction_count: txs.length,
                adjustment_count: adjs.length,
            });
        }

        result.sort((a, b) => b.commissionable_net - a.commissionable_net);

        return Response.json({ rows: result });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});