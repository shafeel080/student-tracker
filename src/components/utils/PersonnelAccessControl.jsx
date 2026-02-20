// Utility functions for personnel/user management access control

export const canViewPersonnel = (userRole) => {
  return ['super_admin', 'admin', 'academic_head', 'academic_admin'].includes(userRole);
};

export const canEditPersonnel = (userRole) => {
  return ['super_admin', 'admin'].includes(userRole);
};

export const canAssignRoles = (userRole) => {
  return ['super_admin', 'admin'].includes(userRole);
};

export const filterPersonnelByRole = (currentUser, allUsers) => {
  if (!currentUser || !allUsers) return [];
  
  const { app_role: role } = currentUser;
  
  // Super Admin and Admin see all users
  if (['super_admin', 'admin'].includes(role)) {
    return allUsers;
  }
  
  // Academic Head and Academic Admin see academic staff and mentors
  if (['academic_head', 'academic_admin'].includes(role)) {
    return allUsers.filter(u => 
      ['academic_head', 'academic_admin', 'senior_mentor', 'junior_mentor', 'subjunior_mentor', 'assistance'].includes(u.app_role)
    );
  }
  
  return [];
};