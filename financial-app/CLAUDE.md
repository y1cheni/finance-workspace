# finance-workspace — financial-app

## 技術棧
- Framework：Next.js 16.2.3（App Router，Turbopack）
- Styling：Tailwind CSS + CSS Variables（globals.css）
- DB / Auth：Supabase（`lib/supabase.ts`）
- Charts：Recharts
- Language：TypeScript strict mode
- 字型：JetBrains Mono（monospace）

## 常用指令
```bash
npm run dev          # 開發伺服器（http://localhost:3000）
npm run build        # 建置
npm run lint         # ESLint
./node_modules/.bin/tsc --noEmit   # 型別檢查（npx tsc 在此專案無效）
```

## 部署
- Vercel：https://financial-app-pi-three.vercel.app
- Git branch：`develop` → push 後 Vercel 自動部署
- Supabase project：`uqxfkhyxqlgyboufqjoz`

## 目錄結構
```
app/
  (dashboard)/
    layout.tsx          ← Sidebar + 主框架
    dashboard/          ← 總覽儀表板
    subscriptions/      ← 訂閱管理（含 extended fields）
    debts/              ← 負債管理
    goals/              ← 財務目標
    cashflow/           ← 現金流
    budget/             ← 預算
    retirement/         ← 退休規劃
    tax/                ← 稅務
    housing/            ← 房產
    portfolio/          ← 投資組合
    compound/           ← 複利計算
    statements/         ← 財務報表
    formula/            ← 公式計算
  (auth)/login/         ← 登入頁
components/
  CsvImportModal.tsx    ← CSV 匯入通用元件
  Slider.tsx
  ThemeProvider.tsx
  LanguageProvider.tsx
lib/
  supabase.ts           ← Supabase client
  design.ts             ← D 色彩物件（D.bg / D.ink / D.accent 等）
  shared-store.ts       ← 跨頁面狀態（writeStore）
  math-engine.ts
  i18n.ts
```

## 設計規範（核心）
- 顏色：一律用 `D.xxx`（`import { D } from '@/lib/design'`），禁止 hardcode hex
- 禁止：emoji、icon library、`any` 型別
- 按鈕互動：`transition-opacity hover:opacity-70`
- 頁面根元素：`style={{ fontFamily: D.font }}`

## Supabase 寫入模式
```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return
await supabase.from('table').insert({ ...data, user_id: user.id })
```

## 注意事項
- 這是 Next.js 16（非標準版本），API 可能與訓練資料不同，修改前先讀 `node_modules/next/dist/docs/`
- Client component 目前直接查詢 Supabase（歷史遺留，新功能盡量用 server action）
- DB migration 透過 Supabase Dashboard SQL editor 手動執行（非 supabase CLI）
