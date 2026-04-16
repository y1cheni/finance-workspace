# finance-workspace

個人財務規劃工具的 monorepo，包含兩個子專案與共用演算法文件。

## 目錄結構

```
finance-workspace/
├── financial-app/       # Next.js PWA — 正式 Web App，含 Google OAuth 與 Supabase
├── financial-tool/      # Python + Streamlit — 本地原型工具
├── shared/              # 跨子專案重疊功能清單與演算法規格
│   └── README.md        # 重疊函數清單、測試錨點、遷移指引
├── docs/                # 專案文件
│   ├── PRD.md           # 產品需求
│   ├── ARCHITECTURE.md  # 技術架構
│   ├── TASKS.md         # Sprint 任務追蹤
│   ├── DECISIONS.md     # 架構決策記錄
│   └── agents/          # Claude agent 角色指引
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md
├── CHANGELOG.md
└── README.md
```

## 子專案說明

### financial-app

Next.js 15 App Router，部署為 Web PWA。

- **認證**：Supabase Google OAuth
- **功能**：複利計算器、退休規劃反推、財務報表視覺化、管理後台
- **技術棧**：TypeScript、Tailwind CSS、Recharts、Supabase

```bash
cd financial-app
npm install
cp .env.local.example .env.local   # 填入 Supabase 金鑰
npm run dev
```

> 需要 `.env.local` 中的 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。

### financial-tool

Python + Streamlit 本地原型，無需認證，直接在本機執行。

- **功能**：與 financial-app 相同的三個計算工具
- **技術棧**：Python 3、Streamlit、Plotly、Pandas

```bash
cd financial-tool
pip install streamlit plotly pandas
streamlit run app.py
```

## 分支策略

| 分支 | 用途 | 合併規則 |
|------|------|----------|
| `main` | 永遠是可發布狀態 | 禁止直接 push，需 PR |
| `develop` | 整合分支，日常開發基準 | 需 PR merge |
| `feature/*` | 單一功能開發 | 從 develop 開，merge 回 develop |
| `release/*` | 版本凍結與 QA | 從 develop 開，merge 進 main + develop |
| `hotfix/*` | 緊急修復 | 從 main 開，merge 進 main + develop |

## 版本管理

版本格式：`vMAJOR.MINOR.PATCH`（語意版本管理）

- **MAJOR**：破壞性變更
- **MINOR**：新功能，向下相容
- **PATCH**：bug fix

每次 merge 進 main 需打 git tag，並在 `CHANGELOG.md` 記錄變更。

## 共用演算法

`financial-app/lib/` 與 `financial-tool/models/` 包含相同演算法的 TypeScript 與 Python 實作。
修改任一版本時必須同步更新另一版本，並對照 `shared/README.md` 的錨點測試案例驗證一致性。

詳細說明見 [shared/README.md](shared/README.md)。
