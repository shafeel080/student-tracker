// Utility functions for target access control

export const canCreateTarget = (role) => {
  return ['super_admin', 'academic_head'].includes(role);
};

export const canEditTarget = (record, currentUser) => {
  if (!currentUser) return false;
  return currentUser.role === 'super_admin';
};

export const canDeleteTarget = (currentUser) => {
  if (!currentUser) return false;
  return currentUser.role === 'super_admin';
};

export const filterTargetsByRole = (currentUser, allTargets) => {
  if (!currentUser || !allTargets) return [];
  
  const { role, id } = currentUser;
  
  // Super Admin, Broker Admin, Academic Head/Admin see all
  if (['super_admin', 'broker_admin', 'academic_head', 'academic_admin'].includes(role)) {
    return allTargets;
  }
  
  // Mentors see only their own targets
  if (['senior_mentor', 'junior_mentor'].includes(role)) {
    return allTargets.filter(t => t.mentor_id === id);
  }
  
  return [];
};