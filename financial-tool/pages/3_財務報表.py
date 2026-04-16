import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from models.statement_engine import generate_statements

st.set_page_config(page_title="財務報表", page_icon="📋", layout="wide")
st.title("📋 財務報表視覺化")
st.markdown("---")

# ── 初始化 session state ───────────────────────────────────────────────────
_defaults = {
    "p3_cash": 500_000,
    "p3_inv": 1_000_000,
    "p3_re": 3_000_000,
    "p3_other": 0,
    "p3_liab": 2_000_000,
    "p3_income": 80_000,
    "p3_expense": 50_000,
    "p3_inv_ret": 7.0,
    "p3_re_growth": 3.0,
    "p3_inc_growth": 2.0,
    "p3_exp_growth": 2.0,
    "p3_paydown": 200_000,
    "p3_proj_years": 20,
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Sidebar ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("資產負債（現況）")

    cash        = st.number_input("現金 / 存款 (NT$)",      0, 50_000_000,  value=st.session_state["p3_cash"],    step=50_000,  key="p3_cash")
    investments = st.number_input("投資組合 (NT$)",          0, 50_000_000,  value=st.session_state["p3_inv"],     step=50_000,  key="p3_inv")
    real_estate = st.number_input("不動產 (NT$)",            0, 100_000_000, value=st.session_state["p3_re"],      step=100_000, key="p3_re")
    other_assets= st.number_input("其他資產 (NT$)",          0, 10_000_000,  value=st.session_state["p3_other"],   step=50_000,  key="p3_other")
    liabilities = st.number_input("負債（房貸/車貸）(NT$)",  0, 50_000_000,  value=st.session_state["p3_liab"],    step=100_000, key="p3_liab")

    st.markdown("---")
    st.header("每月收支")
    monthly_income   = st.slider("每月收入 (NT$)", 20_000, 500_000, value=st.session_state["p3_income"],  step=5_000, format="%d", key="p3_income")
    monthly_expenses = st.slider("每月支出 (NT$)", 10_000, 300_000, value=st.session_state["p3_expense"], step=5_000, format="%d", key="p3_expense")

    st.markdown("---")
    st.header("成長假設（年化）")
    investment_return  = st.slider("投資報酬率 (%)",      0.0, 20.0, value=st.session_state["p3_inv_ret"],    step=0.1, format="%.1f%%", key="p3_inv_ret")   / 100
    real_estate_growth = st.slider("不動產增值 (%)",      0.0, 10.0, value=st.session_state["p3_re_growth"],  step=0.1, format="%.1f%%", key="p3_re_growth")  / 100
    income_growth      = st.slider("收入成長率 (%)",      0.0, 10.0, value=st.session_state["p3_inc_growth"], step=0.1, format="%.1f%%", key="p3_inc_growth") / 100
    expense_growth     = st.slider("支出成長率（通膨）(%)",0.0,  8.0, value=st.session_state["p3_exp_growth"], step=0.1, format="%.1f%%", key="p3_exp_growth") / 100
    liability_paydown  = st.number_input("每年還款本金 (NT$)", 0, 2_000_000, value=st.session_state["p3_paydown"], step=50_000, key="p3_paydown")
    projection_years   = st.slider("預測年限（年）", 5, 40, value=st.session_state["p3_proj_years"], step=1, key="p3_proj_years")

# ── Compute ────────────────────────────────────────────────────────────────
records = generate_statements(
    cash, investments, real_estate, other_assets, liabilities,
    monthly_income, monthly_expenses,
    investment_return, real_estate_growth, income_growth, expense_growth,
    liability_paydown, projection_years,
)
df_raw     = pd.DataFrame(records)
years_list = df_raw["year"].tolist()
today, final = records[0], records[-1]

# ── Metrics ────────────────────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4)
c1.metric("目前淨值",          f"NT$ {today['net_worth']:,.0f}")
c2.metric(f"{projection_years} 年後淨值", f"NT$ {final['net_worth']:,.0f}",
          f"+NT$ {final['net_worth'] - today['net_worth']:,.0f}")
c3.metric("目前儲蓄率",        f"{today['savings_rate']:.1f}%")
c4.metric("目前負債比率",      f"{today['debt_to_assets']:.1f}%")

st.markdown("---")

# ── B/S 圖 ────────────────────────────────────────────────────────────────
st.subheader("資產結構與淨值（B/S）")
fig = go.Figure()
fig.add_trace(go.Bar(x=years_list, y=df_raw["cash"],         name="現金",   marker_color="#636EFA"))
fig.add_trace(go.Bar(x=years_list, y=df_raw["investments"],  name="投資",   marker_color="#EF553B"))
fig.add_trace(go.Bar(x=years_list, y=df_raw["real_estate"],  name="不動產", marker_color="#00CC96"))
fig.add_trace(go.Bar(x=years_list, y=df_raw["other_assets"], name="其他",   marker_color="#AB63FA"))
fig.add_trace(go.Bar(x=years_list, y=[-v for v in df_raw["liabilities"]], name="負債", marker_color="#FFA15A"))
fig.add_trace(go.Scatter(
    x=years_list, y=df_raw["net_worth"], name="淨值",
    mode="lines+markers", line=dict(color="black", width=2.5), marker=dict(size=5),
    hovertemplate="第 %{x} 年<br>淨值: NT$%{y:,.0f}<extra></extra>",
))
fig.update_layout(barmode="relative", xaxis_title="年", yaxis_title="金額 (NT$)",
                  yaxis_tickformat=",.0f", legend=dict(orientation="h", y=1.05),
                  height=450, hovermode="x unified")
st.plotly_chart(fig, use_container_width=True)

# ── P/L 圖 ────────────────────────────────────────────────────────────────
st.subheader("損益表（P/L）趨勢")
fig2 = go.Figure()
fig2.add_trace(go.Scatter(x=years_list, y=df_raw["total_income"],    name="總收入",     line=dict(color="#00CC96", width=2)))
fig2.add_trace(go.Scatter(x=years_list, y=df_raw["annual_expenses"], name="年支出",     line=dict(color="#EF553B", width=2)))
fig2.add_trace(go.Scatter(x=years_list, y=df_raw["net_income"],      name="淨收入",
    fill="tozeroy", line=dict(color="#636EFA", width=2), fillcolor="rgba(99,110,250,0.15)"))
fig2.update_layout(xaxis_title="年", yaxis_title="年度金額 (NT$)", yaxis_tickformat=",.0f",
                   legend=dict(orientation="h", y=1.05), height=350, hovermode="x unified")
st.plotly_chart(fig2, use_container_width=True)

# ── 報表 ──────────────────────────────────────────────────────────────────
tab1, tab2 = st.tabs(["📊 資產負債表 (B/S)", "📈 損益表 (P/L)"])

with tab1:
    bs = df_raw[["year","cash","investments","real_estate","other_assets",
                 "total_assets","liabilities","net_worth","debt_to_assets"]].copy()
    bs.columns = ["年","現金","投資","不動產","其他資產","總資產","負債","淨值","負債比(%)"]
    for col in ["現金","投資","不動產","其他資產","總資產","負債","淨值"]:
        bs[col] = bs[col].apply(lambda x: f"NT$ {x:,.0f}")
    st.dataframe(bs)

with tab2:
    pl = df_raw[["year","annual_income","investment_income","total_income",
                 "annual_expenses","net_income","savings_rate"]].copy()
    pl.columns = ["年","薪資收入","投資收益","總收入","總支出","淨收入","儲蓄率(%)"]
    for col in ["薪資收入","投資收益","總收入","總支出","淨收入"]:
        pl[col] = pl[col].apply(lambda x: f"NT$ {x:,.0f}")
    st.dataframe(pl)

with st.expander("模型假設說明"):
    st.markdown("""
    - **現金** += 薪資 - 支出（純儲蓄部分）
    - **投資** × (1 + 報酬率)（複利，收益留在組合內，不重複計入現金）
    - **不動產** × (1 + 增值率)
    - **負債** -= 每年還款本金
    """)
