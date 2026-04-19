// Cross-page data store persisted in localStorage.
// Pages write their computed values here; other pages can sync via "載入" button.

const KEY = 'fintool-shared-v1'

export interface SharedStore {
  // From debts page
  totalDebt?: number
  totalMonthlyDebtPayment?: number
  // From subscriptions page
  monthlySubscriptionTotal?: number
  // From budget page
  budgetMonthlyIncome?: number
  budgetMonthlySavings?: number
  budgetSubscriptionAmt?: number
  // From retirement page
  retirementMonthlyContribution?: number
  retirementTarget?: number
  retirementWithdrawal?: number   // monthly withdrawal for tax integration
  // From cashflow page
  cfMonthlyIncome?: number
  cfMonthlyExpense?: number
}

export function readStore(): SharedStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function writeStore(updates: Partial<SharedStore>) {
  if (typeof window === 'undefined') return
  const current = readStore()
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...updates }))
}
