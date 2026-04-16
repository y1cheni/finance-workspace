import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from models.math_engine import compound_series, cagr

st.set_page_config(page_title="複利計算器", page_icon="💰", layout="wide")
st.title("💰 複利計算器")
st.markdown("---")

# ── 初始化 session state（跨頁保留用）─────────────────────────────────────
_defaults = {
    "p1_initial": 1_000_000,
    "p1_monthly": 10_000,
    "p1_rate": 7.0,
    "p1_years": 20,
    "p1_freq": "每月",
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Sidebar ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("參數設定")

    initial = st.slider(
        "初始本金 (NT$)", 0, 5_000_000,
        value=st.session_state["p1_initial"], step=10_000, format="%d", key="p1_initial",
    )
    monthly_contrib = st.slider(
        "每月定投 (NT$)", 0, 200_000,
        value=st.session_state["p1_monthly"], step=1_000, format="%d", key="p1_monthly",
    )
    annual_rate = st.slider(
        "年化利率 (%)", 0.0, 20.0,
        value=st.session_state["p1_rate"], step=0.1, format="%.1f%%", key="p1_rate",
    ) / 100
    years = st.slider(
        "投資年限（年）", 1, 50,
        value=st.session_state["p1_years"], step=1, key="p1_years",
    )
    freq_label = st.selectbox(
        "複利頻率", ["每月", "每季", "每年", "每日"],
        index=["每月", "每季", "每年", "每日"].index(st.session_state["p1_freq"]),
        key="p1_freq",
    )
    freq_map = {"每月": 12, "每季": 4, "每年": 1, "每日": 365}
    compound_freq = freq_map[freq_label]

# ── Compute ────────────────────────────────────────────────────────────────
data = compound_series(initial, annual_rate, years, monthly_contrib, compound_freq)

final_balance  = data["balance"][-1]
total_contrib  = data["contributions"][-1]
total_interest = data["interest"][-1]
effective_cagr = cagr(initial, final_balance, years) if initial > 0 else 0

# ── Metrics ────────────────────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4)
c1.metric("最終餘額",    f"NT$ {final_balance:,.0f}")
c2.metric("總投入本金",  f"NT$ {total_contrib:,.0f}")
c3.metric("累計利息收益", f"NT$ {total_interest:,.0f}",
          f"{total_interest/total_contrib*100:.1f}% 回報" if total_contrib > 0 else "-")
c4.metric("實際 CAGR",  f"{effective_cagr*100:.2f}%")

st.markdown("---")

# ── Chart ──────────────────────────────────────────────────────────────────
fig = go.Figure()
fig.add_trace(go.Scatter(
    x=data["years"], y=data["contributions"], name="累計投入本金",
    fill="tozeroy", line=dict(color="#636EFA", width=1.5),
    fillcolor="rgba(99,110,250,0.2)",
    hovertemplate="第 %{x:.1f} 年<br>本金: NT$%{y:,.0f}<extra></extra>",
))
fig.add_trace(go.Scatter(
    x=data["years"], y=data["balance"], name="總資產餘額",
    fill="tonexty", line=dict(color="#EF553B", width=2),
    fillcolor="rgba(239,85,59,0.25)",
    hovertemplate="第 %{x:.1f} 年<br>總餘額: NT$%{y:,.0f}<extra></extra>",
))
fig.update_layout(
    title=f"複利成長曲線（{freq_label}複利，年利率 {annual_rate*100:.1f}%）",
    xaxis_title="年", yaxis_title="金額 (NT$)", yaxis_tickformat=",.0f",
    hovermode="x unified", legend=dict(orientation="h", y=1.05), height=420,
)
st.plotly_chart(fig, use_container_width=True)

# ── 利率敏感度 ─────────────────────────────────────────────────────────────
st.subheader("利率敏感度分析")
rows = []
for r in [0.02, 0.04, 0.06, 0.07, 0.08, 0.10, 0.12, 0.15]:
    d  = compound_series(initial, r, years, monthly_contrib, compound_freq)
    fb = d["balance"][-1]
    tc = d["contributions"][-1]
    rows.append({
        "年化利率": f"{r*100:.0f}%",
        "最終餘額": f"NT$ {fb:,.0f}",
        "利息收益": f"NT$ {fb - tc:,.0f}",
        "本金倍數": f"{fb/tc:.2f}x" if tc > 0 else "-",
    })
st.dataframe(pd.DataFrame(rows))

# ── 逐年明細 ───────────────────────────────────────────────────────────────
with st.expander("逐年明細"):
    idx = [i for i, y in enumerate(data["years"]) if y == int(y)]
    st.dataframe(pd.DataFrame({
        "年":   [int(data["years"][i]) for i in idx],
        "總餘額": [f"NT$ {data['balance'][i]:,.0f}" for i in idx],
        "累計本金": [f"NT$ {data['contributions'][i]:,.0f}" for i in idx],
        "累計利息": [f"NT$ {data['interest'][i]:,.0f}" for i in idx],
    }))

with st.expander("公式說明"):
    st.markdown(f"""
    每期利率 r = {annual_rate*100:.1f}% ÷ {compound_freq} = {annual_rate/compound_freq*100:.4f}%，
    期數 n = {years}年 × {compound_freq} = {years*compound_freq}期

    - 本金成長：`PV × (1+r)^n`
    - 定期年金：`P × [(1+r)^n - 1] / r`（end-of-period）
    """)
