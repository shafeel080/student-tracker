// Utility functions for commission ledger calculations

export const getQuarterDates = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const quarter_number = Math.floor(month / 3) + 1;
  
  // Construct start date directly in UTC
  const startMonth = (quarter_number - 1) * 3;
  const start_date_obj = new Date(Date.UTC(year, startMonth, 1));
  
  // Construct end date directly in UTC
  const endMonth = quarter_number * 3;
  const end_date_obj = new Date(Date.UTC(year, endMonth, 0));
  end_date_obj.setUTCHours(23, 59, 59, 999);
  
  return {
    start_date: start_date_obj.toISOString().split('T')[0],
    end_date: end_date_obj.toISOString().split('T')[0],
    quarter_number,
    year
  };
};

export const getQuarterLabel = (year, quarter_number) => {
  return `${year}-Q${quarter_number}`;
};

export const calculateQuarterNetDeposit = (mentorId, startDate, endDate, transactions) => {
  if (!transactions || !mentorId || !startDate || !endDate) return 0;
  
  const MAX_NET_DEPOSIT_PER_STUDENT = 25000;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  const relevantTransactions = transactions.filter(t => {
    if (t.status !== 'APPROVED') return false;
    if (t.primary_mentor_id !== mentorId) return false;
    
    const requestedDate = new Date(t.requested_at);
    return requestedDate >= start && requestedDate <= end;
  });
  
  // Group transactions by student
  const studentNetDeposits = {};
  
  relevantTransactions.forEach(t => {
    const studentId = t.student_id;
    if (!studentNetDeposits[studentId]) {
      studentNetDeposits[studentId] = 0;
    }
    
    if (t.type === 'DEPOSIT') {
      studentNetDeposits[studentId] += (t.amount_usd || 0);
    } else if (t.type === 'WITHDRAWAL') {
      studentNetDeposits[studentId] -= (t.amount_usd || 0);
    }
  });
  
  // Apply cap per student and sum
  let totalCappedNetDeposit = 0;
  Object.values(studentNetDeposits).forEach(netDeposit => {
    const cappedAmount = Math.min(netDeposit, MAX_NET_DEPOSIT_PER_STUDENT);
    totalCappedNetDeposit += Math.max(cappedAmount, 0); // Don't count negative net deposits
  });
  
  return totalCappedNetDeposit;
};

export const calculateQuarterCommission = (netDeposit, bufferCarriedIn = 0, commissionRatePercent = 4) => {
  const rate = commissionRatePercent / 100;
  const grossFromNetDeposit = netDeposit * rate;
  const totalGrossForCalculation = grossFromNetDeposit + bufferCarriedIn;
  
  const commission_release_usd = totalGrossForCalculation * 0.75;
  const commission_buffer_usd = totalGrossForCalculation * 0.25;
  
  return {
    gross_commission_usd: grossFromNetDeposit,
    commission_release_usd,
    commission_buffer_usd,
    commission_rate: commissionRatePercent
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