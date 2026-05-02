---
description: 建立 Supabase migration 並同步 TypeScript 型別
argument-hint: [描述 DB 變更]
---

**需求：** $ARGUMENTS

流程：

1. 確認現有 schema（讀取相關 page.tsx 的 interface）
2. 撰寫冪等 migration SQL
3. 提供使用者執行步驟：
   - 打開 https://supabase.com/dashboard/project/uqxfkhyxqlgyboufqjoz/sql/new
   - 貼上 SQL → 點 Run
4. 更新對應頁面的 TypeScript interface
5. 型別檢查確認：`cd financial-app && ./node_modules/.bin/tsc --noEmit`
