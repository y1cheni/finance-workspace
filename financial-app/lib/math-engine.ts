// Financial Math Engine — ported from Python math_engine.py
// TODO: move to shared — canonical algorithm spec in shared/README.md
// Cross-language duplicate: financial-tool/models/math_engine.py

// ── Basic TVM ──────────────────────────────────────────────────────────────

export function fv(pv: number, annualRate: number, years: number): number {
  return pv * Math.pow(1 + annualRate, years)
}

export function pvFromFv(fvVal: number, annualRate: number, years: number): number {
  return fvVal / Math.pow(1 + annualRate, years)
}

export function cagr(pvVal: number, fvVal: number, years: number): number {
  if (pvVal <= 0 || years <= 0) return 0
  return Math.pow(fvVal / pvVal, 1 / years) - 1
}

// ── Annuity ────────────────────────────────────────────────────────────────

export function annuityFv(payment: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) return payment * periods
  return payment * (Math.pow(1 + periodicRate, periods) - 1) / periodicRate
}

export function annuityPv(payment: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) return payment * periods
  return payment * (1 - Math.pow(1 + periodicRate, -periods)) / periodicRate
}

// ── Retirement Reverse Solver ──────────────────────────────────────────────

export function monthlySavingsNeeded(
  targetFv: number,
  currentSavings: number,
  annualRate: number,
  months: number,
): number {
  const rm = annualRate / 12
  if (months <= 0) return 0
  if (rm === 0) return Math.max(0, (targetFv - currentSavings) / months)

  const growthFactor = Math.pow(1 + rm, months)
  const shortfall = targetFv - currentSavings * growthFactor
  if (shortfall <= 0) return 0

  return shortfall / ((growthFactor - 1) / rm)
}

export function yearsToTarget(
  targetFv: number,
  currentSavings: number,
  monthlyContribution: number,
  annualRate: number,
  maxYears = 100,
): number {
  const rm = annualRate / 12
  const balanceAt = (m: number) =>
    currentSavings * Math.pow(1 + rm, m) + annuityFv(monthlyContribution, rm, m)

  if (balanceAt(maxYears * 12) < targetFv) return Infinity

  let lo = 0, hi = maxYears * 12
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    balanceAt(Math.floor(mid)) >= targetFv ? (hi = mid) : (lo = mid)
  }
  return hi / 12
}

// ── Compound Growth Series ─────────────────────────────────────────────────

export interface CompoundSeries {
  years: number[]
  balance: number[]
  contributions: number[]
  interest: number[]
}

export function compoundSeries(
  initial: number,
  annualRate: number,
  years: number,
  monthlyContribution = 0,
  compoundFreq = 12,
): CompoundSeries {
  const rp = annualRate / compoundFreq
  const contribsPerPeriod = (monthlyContribution * 12) / compoundFreq
  const totalPeriods = years * compoundFreq

  const yearLabels: number[] = []
  const balances: number[] = []
  const contributions: number[] = []
  const interests: number[] = []

  let balance = initial
  let totalContrib = initial
  let totalInterest = 0

  for (let period = 0; period <= totalPeriods; period++) {
    yearLabels.push(Math.round((period / compoundFreq) * 10000) / 10000)
    balances.push(Math.round(balance * 100) / 100)
    contributions.push(Math.round(totalContrib * 100) / 100)
    interests.push(Math.round(totalInterest * 100) / 100)

    if (period < totalPeriods) {
      const earned = balance * rp
      balance += earned + contribsPerPeriod
      totalContrib += contribsPerPeriod
      totalInterest += earned
    }
  }

  return { years: yearLabels, balance: balances, contributions, interest: interests }
}

// ── IRR ───────────────────────────────────────────────────────────────────

export function irr(cashFlows: number[], maxIter = 1000, tol = 1e-7): number {
  let rate = 0.1
  for (let i = 0; i < maxIter; i++) {
    const npvVal = cashFlows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0)
    const dNpv = cashFlows.reduce((s, cf, t) => s - (t * cf) / Math.pow(1 + rate, t + 1), 0)
    if (Math.abs(dNpv) < 1e-12) break
    const newRate = rate - npvVal / dNpv
    if (Math.abs(newRate - rate) < tol) return newRate
    rate = Math.max(-0.999, newRate)
  }
  return rate
}

export function npv(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((s, cf, t) => s + cf / Math.pow(1 + discountRate, t), 0)
}
