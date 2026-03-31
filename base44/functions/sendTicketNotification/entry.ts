import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticketNumber, ticketTitle, category, createdByName, ticketId, assignedToRole } = await req.json();

    // Use service role to list all users and find those with the assigned role
    const allUsers = await base44.asServiceRole.entities.User.list();
    const targetUsers = allUsers.filter(u => u.app_role === assignedToRole);

    await Promise.all(targetUsers.map(u =>
      base44.asServiceRole.entities.Notification.create({
        user_id: u.id,
        title: `New Support Ticket: ${ticketNumber}`,
        message: `A new ${category} ticket has been raised by ${createdByName}: ${ticketTitle}`,
        type: 'ticket_new',
        read: false,
        link: '/Tickets',
      })
    ));

    return Response.json({ success: true, notified: targetUsers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});