import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from models.math_engine import monthly_savings_needed, compound_series, years_to_target, annuity_pv

st.set_page_config(page_title="退休規劃", page_icon="🎯", layout="wide")
st.title("🎯 退休規劃反推")
st.markdown("---")

# ── 初始化 session state ───────────────────────────────────────────────────
_defaults = {
    "p2_current_age": 30,
    "p2_retirement_age": 60,
    "p2_life_expectancy": 85,
    "p2_current_savings": 500_000,
    "p2_monthly_expense": 60_000,
    "p2_annual_return": 7.0,
    "p2_inflation": 2.0,
    "p2_withdrawal_mode": "固定金額提領",
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Sidebar ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("基本資料")

    current_age = st.slider(
        "目前年齡", 20, 65,
        value=st.session_state["p2_current_age"], step=1, key="p2_current_age",
    )

    ret_default = max(min(st.session_state["p2_retirement_age"], 80), current_age + 1)
    retirement_age = st.slider(
        "預計退休年齡", current_age + 1, 80,
        value=ret_default, step=1, key="p2_retirement_age",
    )

    life_default = max(min(st.session_state["p2_life_expectancy"], 100), retirement_age + 1)
    life_expectancy = st.slider(
        "預期壽命", retirement_age + 1, 100,
        value=life_default, step=1, key="p2_life_expectancy",
    )

    st.markdown("---")
    st.header("財務設定")

    current_savings = st.slider(
        "目前存款 / 投資 (NT$)", 0, 10_000_000,
        value=st.session_state["p2_current_savings"], step=50_000, format="%d",
        key="p2_current_savings",
    )
    monthly_expense_retire = st.slider(
        "退休後每月生活費 (NT$)", 10_000, 200_000,
        value=st.session_state["p2_monthly_expense"], step=5_000, format="%d",
        key="p2_monthly_expense",
    )
    annual_return = st.slider(
        "預期年化報酬率 (%)", 1.0, 15.0,
        value=st.session_state["p2_annual_return"], step=0.1, format="%.1f%%",
        key="p2_annual_return",
    ) / 100
    inflation = st.slider(
        "通膨率 (%)", 0.0, 6.0,
        value=st.session_state["p2_inflation"], step=0.1, format="%.1f%%",
        key="p2_inflation",
    ) / 100

    st.markdown("---")
    st.header("退休後提領")
    withdrawal_mode = st.radio(
        "提領方式", ["固定金額提領", "4% 法則（本金永續）"],
        index=["固定金額提領", "4% 法則（本金永續）"].index(st.session_state["p2_withdrawal_mode"]),
        key="p2_withdrawal_mode",
    )

# ── Compute ────────────────────────────────────────────────────────────────
years_to_retire    = retirement_age - current_age
years_in_retire    = life_expectancy - retirement_age
months_to_retire   = years_to_retire * 12
real_return        = (1 + annual_return) / (1 + inflation) - 1
monthly_real_rate  = real_return / 12

if withdrawal_mode == "4% 法則（本金永續）":
    target_nest_egg = (monthly_expense_retire * 12) / 0.04
    method_note = "4% 法則（本金永不用盡）"
else:
    periods = years_in_retire * 12
    target_nest_egg = (annuity_pv(monthly_expense_retire, monthly_real_rate, periods)
                       if monthly_real_rate > 0 else monthly_expense_retire * periods)
    method_note = f"{years_in_retire} 年提領期（通膨調整後）"

needed_monthly = monthly_savings_needed(target_nest_egg, current_savings, annual_return, months_to_retire)

# ── Metrics ────────────────────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4)
c1.metric("退休目標金額", f"NT$ {target_nest_egg:,.0f}", method_note)
c2.metric("每月需存入",   f"NT$ {needed_monthly:,.0f}")
c3.metric("距退休年數",   f"{years_to_retire} 年")
c4.metric("退休後生活年數", f"{years_in_retire} 年")

st.markdown("---")

# ── 累積曲線 ───────────────────────────────────────────────────────────────
if years_to_retire > 0:
    st.subheader("資產累積曲線")
    data = compound_series(current_savings, annual_return, years_to_retire, needed_monthly, 12)

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=[current_age + y for y in data["years"]], y=data["contributions"],
        name="累計投入", fill="tozeroy", line=dict(color="#636EFA", width=1.5),
        fillcolor="rgba(99,110,250,0.2)",
        hovertemplate="年齡 %{x:.0f}<br>累計投入: NT$%{y:,.0f}<extra></extra>",
    ))
    fig.add_trace(go.Scatter(
        x=[current_age + y for y in data["years"]], y=data["balance"],
        name="總資產", fill="tonexty", line=dict(color="#EF553B", width=2),
        fillcolor="rgba(239,85,59,0.25)",
        hovertemplate="年齡 %{x:.0f}<br>總資產: NT$%{y:,.0f}<extra></extra>",
    ))
    fig.add_hline(y=target_nest_egg, line_dash="dash", line_color="green",
                  annotation_text=f"退休目標 NT${target_nest_egg:,.0f}",
                  annotation_position="bottom right")
    fig.update_layout(xaxis_title="年齡", yaxis_title="金額 (NT$)",
                      yaxis_tickformat=",.0f", hovermode="x unified",
                      legend=dict(orientation="h", y=1.05), height=400)
    st.plotly_chart(fig, use_container_width=True)

# ── 情境比較 ───────────────────────────────────────────────────────────────
if years_to_retire > 0:
    st.subheader("情境比較：每月存入 vs 退休目標")
    rows = []
    for amt in [5_000, 10_000, 20_000, 30_000, 50_000, 80_000, 100_000]:
        d    = compound_series(current_savings, annual_return, years_to_retire, amt, 12)
        fb   = d["balance"][-1]
        gap  = fb - target_nest_egg
        yr   = years_to_target(target_nest_egg, current_savings, amt, annual_return)
        rows.append({
            "每月存入":     f"NT$ {amt:,}",
            "退休時總資產": f"NT$ {fb:,.0f}",
            "vs 目標":      f"{'▲ ' if gap >= 0 else '▼ '}NT$ {abs(gap):,.0f}",
            "達標年齡":     f"{current_age + yr:.1f} 歲" if yr != float("inf") else "無法達標",
            "是否足夠":     "✅" if fb >= target_nest_egg else "❌",
        })
    st.dataframe(pd.DataFrame(rows))

# ── 退休提領模擬 ───────────────────────────────────────────────────────────
st.subheader("退休提領模擬")
balance = target_nest_egg
monthly_rate = annual_return / 12
ages, balances = [], []
for m in range(years_in_retire * 12 + 1):
    ages.append(round(retirement_age + m / 12, 2))
    balances.append(round(balance, 0))
    if m < years_in_retire * 12:
        balance = max(0, balance * (1 + monthly_rate) - monthly_expense_retire)

fig2 = go.Figure()
fig2.add_trace(go.Scatter(
    x=ages, y=balances, name="退休資產餘額",
    fill="tozeroy", line=dict(color="#00CC96", width=2),
    fillcolor="rgba(0,204,150,0.2)",
    hovertemplate="年齡 %{x:.0f}<br>餘額: NT$%{y:,.0f}<extra></extra>",
))
fig2.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="資產耗盡")
fig2.update_layout(xaxis_title="年齡", yaxis_title="剩餘資產 (NT$)",
                   yaxis_tickformat=",.0f", height=350)
st.plotly_chart(fig2, use_container_width=True)

remaining = balances[-1]
if remaining > 0:
    st.success(f"預期 {life_expectancy} 歲時仍有 NT$ {remaining:,.0f} 剩餘")
else:
    dep_idx = next((i for i, b in enumerate(balances) if b <= 0), None)
    if dep_idx:
        st.warning(f"資產將在 {ages[dep_idx]:.0f} 歲前耗盡，建議增加存款或調整目標")

with st.expander("公式說明"):
    st.markdown(f"""
    **退休目標（固定提領法）** PV = P × [1-(1+r)⁻ⁿ] / r
    - 實質月利率 r = (1+{annual_return*100:.1f}%)/(1+{inflation*100:.1f}%) - 1 = {real_return*100:.3f}%

    **每月需存（反推）** PMT = [目標 - PV×(1+r)ⁿ] × r / [(1+r)ⁿ - 1]
    - 月利率 {annual_return/12*100:.4f}%，{months_to_retire} 個月後達 NT${target_nest_egg:,.0f}
    """)
