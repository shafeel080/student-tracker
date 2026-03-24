import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { student_id, mentor_id, amount_usd } = await req.json();
    console.log('updateCoMentorContribution called with:', { student_id, mentor_id, amount_usd, caller_role: user?.app_role, caller_email: user?.email });

    if (!student_id || !mentor_id || typeof amount_usd === 'undefined') {
      return Response.json({ error: 'Missing student_id, mentor_id, or amount_usd' }, { status: 400 });
    }

    const student = await base44.asServiceRole.entities.Student.get(student_id);

    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    if (!student.co_mentors_details) {
      return Response.json({ success: true, message: 'No co_mentors_details on student' });
    }

    let coMentors = [];
    try {
      coMentors = typeof student.co_mentors_details === 'string'
        ? JSON.parse(student.co_mentors_details)
        : student.co_mentors_details;
    } catch (e) {
      return Response.json({ error: 'Invalid co_mentors_details format' }, { status: 500 });
    }

    const match = coMentors.find(cm => cm.mentor_id === mentor_id);
    if (!match) {
      return Response.json({ success: true, message: 'Co-mentor not found — no update needed' });
    }

    const updatedCoMentors = coMentors.map(cm =>
      cm.mentor_id === mentor_id
        ? { ...cm, net_deposit_contribution_usd: (cm.net_deposit_contribution_usd || 0) + amount_usd }
        : cm
    );

    await base44.asServiceRole.entities.Student.update(student_id, {
      co_mentors_details: JSON.stringify(updatedCoMentors)
    });

    return Response.json({ success: true, updatedCoMentors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});