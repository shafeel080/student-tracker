// Utility functions for ticket access control

export const canCreateTicket = (role) => {
  return ['junior_mentor', 'senior_mentor', 'academic_head', 'academic_admin'].includes(role);
};

export const canReviewTicket = (role) => {
  return ['super_admin', 'broker_admin'].includes(role);
};

export const canViewAllTickets = (role) => {
  return ['super_admin', 'broker_admin', 'academic_head', 'academic_admin'].includes(role);
};

export const filterTicketsByRole = (currentUser, allTickets) => {
  if (!currentUser || !allTickets) return [];
  
  const { app_role: role, id } = currentUser;
  
  // Super Admin, Broker Admin, Academic Head and Academic Admin see all
  if (canViewAllTickets(role)) {
    return allTickets;
  }
  
  // Mentors see tickets they created or are assigned to
  if (['junior_mentor', 'senior_mentor'].includes(role)) {
    return allTickets.filter(t => 
      t.created_by === currentUser.email || 
      t.assigned_to === id
    );
  }
  
  return [];
};