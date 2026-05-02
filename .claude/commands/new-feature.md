---
description: 開始開發新功能的完整流程
argument-hint: [功能描述]
---

針對以下功能需求，執行完整的開發流程：

**功能描述：** $ARGUMENTS

依序完成：

1. **釐清需求**
   - 功能目標是什麼
   - 影響哪些頁面（`app/(dashboard)/` 下哪個路由）
   - 需要哪些新的 DB 欄位

2. **DB 變更（若需要）**
   - 用 supabase-expert agent 設計 migration SQL
   - 提供給使用者至 Supabase SQL editor 執行

3. **實作順序**
   - 先更新 TypeScript interface
   - 再實作 UI（遵守 `rules/ui-design.md`）
   - 型別檢查：`cd financial-app && ./node_modules/.bin/tsc --noEmit`

4. **完成後**
   - 用 ui-reviewer agent 審查 UI
   - 用 code-reviewer agent 審查邏輯
   - commit + push → Vercel 自動部署
