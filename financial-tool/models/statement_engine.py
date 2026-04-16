"""
Financial Statement Engine
Generates year-by-year Balance Sheet (B/S) and P&L projections.

TODO: move to shared — canonical algorithm spec in shared/README.md
Cross-language duplicate: financial-app/lib/statement-engine.ts
"""

from typing import List, Dict


def generate_statements(
    # Balance Sheet (initial)
    cash: float,
    investments: float,
    real_estate: float,
    other_assets: float,
    liabilities: float,
    # P&L assumptions
    monthly_income: float,
    monthly_expenses: float,
    # Growth rates (annual)
    investment_return: float,   # e.g. 0.07
    real_estate_growth: float,  # e.g. 0.03
    income_growth: float,       # e.g. 0.02
    expense_growth: float,      # e.g. 0.02 (inflation)
    liability_paydown: float,   # annual principal repayment
    years: int,
) -> List[Dict]:
    """
    Return a list of dicts, one per year (year 0 = today).
    Each dict contains full B/S and P/L for that year.
    """
    records = []

    for year in range(years + 1):
        total_assets = cash + investments + real_estate + other_assets
        net_worth = total_assets - liabilities

        annual_income = monthly_income * 12
        annual_expenses = monthly_expenses * 12
        net_income = annual_income - annual_expenses

        investment_income = investments * investment_return

        records.append(
            {
                "year": year,
                # Balance Sheet
                "cash": round(cash, 0),
                "investments": round(investments, 0),
                "real_estate": round(real_estate, 0),
                "other_assets": round(other_assets, 0),
                "total_assets": round(total_assets, 0),
                "liabilities": round(liabilities, 0),
                "net_worth": round(net_worth, 0),
                # P&L
                "annual_income": round(annual_income, 0),
                "investment_income": round(investment_income, 0),
                "total_income": round(annual_income + investment_income, 0),
                "annual_expenses": round(annual_expenses, 0),
                "net_income": round(net_income + investment_income, 0),
                # Ratios
                "savings_rate": (
                    round((net_income) / annual_income * 100, 1)
                    if annual_income > 0
                    else 0
                ),
                "debt_to_assets": (
                    round(liabilities / total_assets * 100, 1)
                    if total_assets > 0
                    else 0
                ),
            }
        )

        # ── Advance one year ──────────────────────────────
        # Cash: accumulates only salary surplus (income - expenses).
        # Investment gains stay inside the investment portfolio (already handled below).
        salary_surplus = annual_income - annual_expenses
        cash += salary_surplus
        cash = max(0, cash)

        # Investments: grow + reinvest gains (gains already counted in investment_income above)
        investments *= 1 + investment_return

        # Real estate appreciates
        real_estate *= 1 + real_estate_growth

        # Liabilities reduce by paydown amount
        liabilities = max(0, liabilities - liability_paydown)

        # Income & expenses grow
        monthly_income *= 1 + income_growth
        monthly_expenses *= 1 + expense_growth

    return records
