import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['super_admin', 'broker_admin', 'academic_head'].includes(user.app_role)) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { student_id, withdrawal_amount } = await req.json();

    if (!student_id || !withdrawal_amount) {
      return Response.json({ error: 'Missing student_id or withdrawal_amount' }, { status: 400 });
    }

    const students = await base44.asServiceRole.entities.Student.filter({ id: student_id });
    if (!students.length) return Response.json({ error: 'Student not found' }, { status: 404 });

    const student = students[0];

    // For non-co-managed clients, LedgerUtils already handles net deposit deduction
    // via the WITHDRAWAL FundingTransaction — nothing extra needed
    if (!student.co_mentors_details) {
      return Response.json({ success: true, message: 'Non-co-managed withdrawal — handled via FundingTransaction.' });
    }

    let coMentors = [];
    try {
      coMentors = typeof student.co_mentors_details === 'string'
        ? JSON.parse(student.co_mentors_details)
        : student.co_mentors_details;
    } catch (_) {
      return Response.json({ error: 'Invalid co_mentors_details format' }, { status: 400 });
    }

    if (!Array.isArray(coMentors) || coMentors.length === 0) {
      return Response.json({ success: true, message: 'No co-mentors — handled via FundingTransaction.' });
    }

    const amount = parseFloat(withdrawal_amount);
    const totalCombined = student.net_deposit_usd || 0;

    if (totalCombined <= 0) {
      return Response.json({ error: 'No net deposits to apply withdrawal against' }, { status: 400 });
    }

    if (amount > totalCombined) {
      return Response.json({ error: 'Withdrawal amount exceeds total net deposits' }, { status: 400 });
    }

    // Co-mentors' total contribution
    const coMentorTotal = coMentors.reduce((sum, m) => sum + (m.net_deposit_contribution_usd || 0), 0);
    // Primary mentor's implied net
    const primaryMentorNet = Math.max(0, totalCombined - coMentorTotal);

    const calculationDetails = [];

    // Calculate and update each co-mentor's share
    const updatedCoMentors = coMentors.map(mentor => {
      const mentorNet = mentor.net_deposit_contribution_usd || 0;
      const share = totalCombined > 0 ? amount * (mentorNet / totalCombined) : 0;
      const newNet = Math.max(0, mentorNet - share);
      calculationDetails.push({
        mentor_id: mentor.mentor_id,
        mentor_name: mentor.mentor_name,
        role: 'co_mentor',
        original_net_usd: mentorNet,
        withdrawal_share_usd: share,
        new_net_usd: newNet
      });
      return { ...mentor, net_deposit_contribution_usd: newNet };
    });

    // Primary mentor share (for logging — their net is implicit from student.net_deposit_usd)
    const primaryShare = totalCombined > 0 ? amount * (primaryMentorNet / totalCombined) : 0;
    calculationDetails.push({
      mentor_id: student.primary_mentor_id,
      mentor_name: student.primary_mentor_name,
      role: 'primary_mentor',
      original_net_usd: primaryMentorNet,
      withdrawal_share_usd: primaryShare,
      new_net_usd: Math.max(0, primaryMentorNet - primaryShare)
    });

    // Update student with recalculated co-mentor contributions
    await base44.asServiceRole.entities.Student.update(student_id, {
      co_mentors_details: JSON.stringify(updatedCoMentors)
    });

    await base44.asServiceRole.entities.Log.create({
      timestamp: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      user_role: user.app_role,
      action_type: 'other',
      entity_type: 'Student',
      entity_id: student_id,
      details: JSON.stringify({
        message: `Pro-rata withdrawal split calculated for co-managed student ${student.full_name}`,
        withdrawal_amount: amount,
        total_combined_net_usd: totalCombined,
        split_calculation: calculationDetails
      }),
      success: true
    });

    return Response.json({ success: true, calculation: calculationDetails });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});