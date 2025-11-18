// Utility functions for funding transaction access control

export const canCreateFundingTransaction = (role) => {
  return ['junior_mentor', 'senior_mentor'].includes(role);
};

export const canProcessFundingTransaction = (role) => {
  return ['broker_admin', 'super_admin'].includes(role);
};

export const canViewAllFundingTransactions = (role) => {
  return ['super_admin', 'broker_admin', 'academic_head', 'academic_admin'].includes(role);
};

export const filterFundingTransactionsByRole = (currentUser, allTransactions, allStudents, allUsers = []) => {
  if (!currentUser || !allTransactions) return [];
  
  const { role, id } = currentUser;
  
  // Super Admin and Broker Admin see all
  if (['super_admin', 'broker_admin'].includes(role)) {
    return allTransactions;
  }
  
  // Academic Head and Academic Admin see all
  if (['academic_head', 'academic_admin'].includes(role)) {
    return allTransactions;
  }
  
  // Junior Mentor sees only their students' transactions
  if (role === 'junior_mentor') {
    return allTransactions.filter(t => t.primary_mentor_id === id);
  }
  
  // Senior Mentor sees their students + their junior mentors' students
  if (role === 'senior_mentor') {
    // Get all junior mentors assigned to this senior mentor
    const myJuniorMentors = allUsers.filter(u => 
      u.role === 'junior_mentor' && u.senior_mentor_id === id
    );
    const juniorMentorIds = myJuniorMentors.map(jm => jm.id);
    
    return allTransactions.filter(t => 
      t.primary_mentor_id === id || // Their own students
      t.senior_mentor_id === id || // Students assigned to them as senior mentor
      juniorMentorIds.includes(t.primary_mentor_id) // Their junior mentors' students
    );
  }
  
  return [];
};

export const canEditFundingCoreFields = (record, currentUser) => {
  if (!currentUser) return false;
  return currentUser.role === 'super_admin';
};

export const canUpdateProcessingFields = (record, currentUser) => {
  if (!currentUser || !record) return false;
  
  const { role } = currentUser;
  
  // Super Admin can always update
  if (role === 'super_admin') return true;
  
  // Broker Admin can update while PENDING
  if (role === 'broker_admin' && record.status === 'PENDING') return true;
  
  return false;
};

export const canChangeFundingStatus = (record, currentUser) => {
  if (!currentUser || !record) return false;
  
  const { role } = currentUser;
  
  // Super Admin can always change status
  if (role === 'super_admin') return true;
  
  // Broker Admin can change status from PENDING to APPROVED/REJECTED
  if (role === 'broker_admin' && record.status === 'PENDING') return true;
  
  return false;
};