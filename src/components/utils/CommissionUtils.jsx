// Utility functions for commission calculations

export const isWithinCurrentQuarter = (date, currentDate = new Date()) => {
  if (!date) return false;
  
  const checkDate = new Date(date);
  const current = new Date(currentDate);
  
  // Get current quarter
  const currentQuarter = Math.floor(current.getMonth() / 3);
  const currentYear = current.getFullYear();
  
  // Get quarter start and end
  const quarterStartMonth = currentQuarter * 3;
  const quarterStart = new Date(currentYear, quarterStartMonth, 1);
  const quarterEnd = new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59, 999);
  
  return checkDate >= quarterStart && checkDate <= quarterEnd;
};

export const getCurrentQuarterLabel = (currentDate = new Date()) => {
  const current = new Date(currentDate);
  const quarter = Math.floor(current.getMonth() / 3) + 1;
  const year = current.getFullYear();
  return `Q${quarter} ${year}`;
};

export const calculateQuarterlyNetDepositAndCommission = (transactions, currentUser, currentDate = new Date()) => {
  if (!transactions || !currentUser) {
    return {
      netDepositUsd: 0,
      grossCommissionUsd: 0,
      release75Usd: 0,
      buffer25Usd: 0
    };
  }
  
  // Filter transactions for current quarter, APPROVED status, and current mentor
  const relevantTransactions = transactions.filter(t => 
    t.status === 'APPROVED' &&
    t.primary_mentor_id === currentUser.id &&
    isWithinCurrentQuarter(t.requested_at, currentDate)
  );
  
  // Calculate net deposit
  const totalDeposits = relevantTransactions
    .filter(t => t.type === 'DEPOSIT')
    .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
  
  const totalWithdrawals = relevantTransactions
    .filter(t => t.type === 'WITHDRAWAL')
    .reduce((sum, t) => sum + (t.amount_usd || 0), 0);
  
  const netDepositUsd = totalDeposits - totalWithdrawals;
  
  // Calculate commission (4% of net deposit)
  const grossCommissionUsd = netDepositUsd * 0.04;
  
  // Calculate release (75%) and buffer (25%)
  const release75Usd = grossCommissionUsd * 0.75;
  const buffer25Usd = grossCommissionUsd * 0.25;
  
  return {
    netDepositUsd,
    grossCommissionUsd,
    release75Usd,
    buffer25Usd
  };
};