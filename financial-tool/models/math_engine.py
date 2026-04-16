"""
Financial Math Engine
FV / PV / IRR / CAGR / Annuity / Retirement reverse solver

TODO: move to shared — canonical algorithm spec in shared/README.md
Cross-language duplicate: financial-app/lib/math-engine.ts
"""

from typing import List


# ── Basic TVM ──────────────────────────────────────────────────────────────

def fv(pv: float, annual_rate: float, years: float) -> float:
    """Future Value: FV = PV * (1 + r)^n"""
    return pv * (1 + annual_rate) ** years


def pv_from_fv(fv_val: float, annual_rate: float, years: float) -> float:
    """Present Value: PV = FV / (1 + r)^n"""
    if (1 + annual_rate) ** years == 0:
        return 0
    return fv_val / (1 + annual_rate) ** years


def cagr(pv_val: float, fv_val: float, years: float) -> float:
    """CAGR = (FV / PV)^(1/n) - 1"""
    if pv_val <= 0 or years <= 0:
        return 0.0
    return (fv_val / pv_val) ** (1.0 / years) - 1


# ── Annuity ────────────────────────────────────────────────────────────────

def annuity_fv(payment: float, periodic_rate: float, periods: int) -> float:
    """
    Annuity Future Value (end of period payments).
    FV = P * [(1+r)^n - 1] / r
    """
    if periodic_rate == 0:
        return payment * periods
    return payment * ((1 + periodic_rate) ** periods - 1) / periodic_rate


def annuity_pv(payment: float, periodic_rate: float, periods: int) -> float:
    """
    Annuity Present Value (end of period payments).
    PV = P * [1 - (1+r)^-n] / r
    """
    if periodic_rate == 0:
        return payment * periods
    return payment * (1 - (1 + periodic_rate) ** (-periods)) / periodic_rate


# ── Retirement Reverse Solver ──────────────────────────────────────────────

def monthly_savings_needed(
    target_fv: float,
    current_savings: float,
    annual_rate: float,
    months: int,
) -> float:
    """
    How much to save per month to reach target_fv?

    target_fv = current_savings*(1+r_m)^n + PMT*[(1+r_m)^n - 1]/r_m
    → PMT = [target_fv - current_savings*(1+r_m)^n] * r_m / [(1+r_m)^n - 1]
    """
    r_m = annual_rate / 12
    if months <= 0:
        return 0.0
    if r_m == 0:
        remaining = target_fv - current_savings
        return max(0.0, remaining / months)

    growth_factor = (1 + r_m) ** months
    existing_growth = current_savings * growth_factor
    shortfall = target_fv - existing_growth

    if shortfall <= 0:
        return 0.0

    annuity_factor = (growth_factor - 1) / r_m
    return shortfall / annuity_factor


def years_to_target(
    target_fv: float,
    current_savings: float,
    monthly_contribution: float,
    annual_rate: float,
    max_years: int = 100,
) -> float:
    """Binary search: how many years until savings hit target?"""
    r_m = annual_rate / 12

    def balance_at(months: int) -> float:
        b = current_savings * (1 + r_m) ** months
        b += annuity_fv(monthly_contribution, r_m, months)
        return b

    if balance_at(max_years * 12) < target_fv:
        return float("inf")

    lo, hi = 0, max_years * 12
    for _ in range(60):
        mid = (lo + hi) / 2
        if balance_at(int(mid)) >= target_fv:
            hi = mid
        else:
            lo = mid
    return hi / 12


# ── Compound Growth Time Series ────────────────────────────────────────────

def compound_series(
    initial: float,
    annual_rate: float,
    years: int,
    monthly_contribution: float = 0.0,
    compound_freq: int = 12,  # 1=annual, 4=quarterly, 12=monthly, 365=daily
) -> dict:
    """
    Generate period-by-period balance breakdown.
    Returns dict with lists: years, balance, contributions, interest
    """
    r_p = annual_rate / compound_freq
    contribs_per_period = monthly_contribution * 12 / compound_freq
    total_periods = years * compound_freq

    year_labels, balances, contributions, interests = [], [], [], []

    balance = initial
    total_contrib = initial
    total_interest = 0.0

    for period in range(total_periods + 1):
        year_labels.append(round(period / compound_freq, 4))
        balances.append(round(balance, 2))
        contributions.append(round(total_contrib, 2))
        interests.append(round(total_interest, 2))

        if period < total_periods:
            earned = balance * r_p
            balance += earned + contribs_per_period
            total_contrib += contribs_per_period
            total_interest += earned

    return {
        "years": year_labels,
        "balance": balances,
        "contributions": contributions,
        "interest": interests,
    }


# ── IRR (Newton-Raphson) ───────────────────────────────────────────────────

def irr(cash_flows: List[float], max_iter: int = 1000, tol: float = 1e-7) -> float:
    """
    Internal Rate of Return via Newton-Raphson.
    cash_flows[0] is typically negative (initial outflow).
    """
    rate = 0.1
    for _ in range(max_iter):
        npv_val = sum(cf / (1 + rate) ** t for t, cf in enumerate(cash_flows))
        d_npv = sum(
            -t * cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cash_flows)
        )
        if abs(d_npv) < 1e-12:
            break
        new_rate = rate - npv_val / d_npv
        if abs(new_rate - rate) < tol:
            return new_rate
        rate = max(-0.999, new_rate)  # prevent divide-by-zero
    return rate


def npv(cash_flows: List[float], discount_rate: float) -> float:
    """Net Present Value"""
    return sum(cf / (1 + discount_rate) ** t for t, cf in enumerate(cash_flows))
