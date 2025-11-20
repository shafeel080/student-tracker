// Utility functions for commission ledger calculations

export const getQuarterDates = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const quarter_number = Math.floor(month / 3) + 1;
  
  const start_date = new Date(year, (quarter_number - 1) * 3, 1);
  const end_date = new Date(year, quarter_number * 3, 0);
  
  return {
    start_date: start_date.toISOString().split('T')[0],
    end_date: end_date.toISOString().split('T')[0],
    quarter_number,
    year
  };
};

export const getQuarterLabel = (year, quarter_number) => {
  return `${year}-Q${quarter_number}`;
};

export const calculateQuarterNetDeposit = (mentorId, startDate, endDate, transactions) => {
  if (!transactions || !mentorId || !startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  const relevantTransactions = transactions.filter(t => {
    if (t.status !== 'APPROVED') return false;
    if (t.primary_mentor_id !== mentorId) return false;
    
    const requestedDate = new Date(t.requested_at);
    return requestedDate >= start && requestedDate <= end;
  });
  
  const totalDeposits = relevantTransactions
    .filter(t => t.type === 'DEPOSIT')
    .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
  
  const totalWithdrawals = relevantTransactions
    .filter(t => t.type === 'WITHDRAWAL')
    .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
  
  return totalDeposits - totalWithdrawals;
};

export const calculateQuarterCommission = (netDeposit, bufferCarriedIn = 0) => {
  const grossFromNetDeposit = netDeposit * 0.04;
  const totalGrossForCalculation = grossFromNetDeposit + bufferCarriedIn;
  
  const commission_release_usd = totalGrossForCalculation * 0.75;
  const commission_buffer_usd = totalGrossForCalculation * 0.25;
  
  return {
    gross_commission_usd: grossFromNetDeposit,
    commission_release_usd,
    commission_buffer_usd
  };
};

export const calculateReleaseDate = (endDate) => {
  const end = new Date(endDate);
  // Next month, 15th day
  const releaseDate = new Date(end.getFullYear(), end.getMonth() + 1, 15);
  return releaseDate.toISOString().split('T')[0];
};

export const canEditLedger = (currentUser) => {
  return ['super_admin', 'admin'].includes(currentUser?.app_role);
};

export const canCloseLedger = (currentUser) => {
  return ['super_admin', 'admin', 'broker_admin'].includes(currentUser?.app_role);
};

export const canMarkReleased = (currentUser) => {
  return ['super_admin', 'admin', 'broker_admin', 'finance_admin'].includes(currentUser?.app_role);
};

export const filterLedgersByRole = (currentUser, allLedgers) => {
  if (!currentUser || !allLedgers) return [];
  
  const { app_role: role, id } = currentUser;
  
  // Admins see all
  if (['super_admin', 'admin', 'broker_admin', 'academic_head', 'academic_admin'].includes(role)) {
    return allLedgers;
  }
  
  // Mentors see only their own
  if (['senior_mentor', 'junior_mentor'].includes(role)) {
    return allLedgers.filter(l => l.mentor_id === id);
  }
  
  return [];
};