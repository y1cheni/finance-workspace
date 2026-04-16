# CHANGELOG

所有版本的重要變更記錄於此文件。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，版本號遵循語意版本管理（SemVer）。

---

## [v1.0.0] — 2026-04-16

### 新增

**financial-app（Next.js PWA）**
- Google OAuth 登入（Supabase Auth）
- 複利計算器（/compound）：滑桿輸入、面積成長曲線、利率敏感度分析表
- 退休規劃（/retirement）：反推月存金額、4% 法則 / 固定提領兩種模式、情境比較表、提領模擬曲線
- 財務報表（/statements）：資產負債表投影、損益表投影、B/S 堆疊柱狀圖、P/L 折線圖、數字明細分頁
- 管理後台（/admin）：用戶訪問統計（限 admin email）
- 頁面訪問日誌 API（/api/log-usage → Supabase usage_logs）
- Auth guard：未登入自動跳轉 /login

**financial-tool（Python + Streamlit 原型）**
- 複利計算器：本金 + 月定投 + 複利頻率選擇、Plotly 成長曲線、逐年明細
- 退休規劃：反推計算、多情境比較、提領模擬
- 財務報表：B/S + P/L 逐年投影、Plotly 互動圖表

**共用演算法（financial-app/lib/ + financial-tool/models/）**
- 財務數學引擎：FV / PV / CAGR / 年金 / 複利序列 / 退休反推 / IRR / NPV
- 財務報表引擎：年度 B/S + P/L 投影

**shared/**
- 重疊功能清單（含 11 個跨語言重疊函數）
- 演算法錨點測試案例（5 個）

**專案文件**
- 根目錄 README.md
- CHANGELOG.md
- .github/PULL_REQUEST_TEMPLATE.md
- docs/PRD.md、docs/ARCHITECTURE.md、docs/TASKS.md、docs/DECISIONS.md
- docs/agents/PM.md、ARCHITECT.md、ENGINEER.md、QA.md
