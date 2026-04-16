import streamlit as st

st.set_page_config(
    page_title="Financial Modeling Tool",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("📊 Financial Modeling Tool")
st.markdown("---")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("""
    ### 💰 複利計算器
    - 本金 + 月定投
    - 複利頻率（月/季/年/日）
    - 即時成長曲線視覺化
    """)
    st.info("使用左側導覽列 → 1_複利計算器")

with col2:
    st.markdown("""
    ### 🎯 退休規劃
    - 輸入退休目標金額
    - 反推每月需存多少
    - 多情境比較
    """)
    st.info("使用左側導覽列 → 2_退休規劃")

with col3:
    st.markdown("""
    ### 📋 財務報表
    - 資產負債表（B/S）
    - 損益表（P/L）
    - 淨值成長曲線
    """)
    st.info("使用左側導覽列 → 3_財務報表")

st.markdown("---")
st.caption("使用左側導覽列切換頁面 | Financial Modeling Tool")
