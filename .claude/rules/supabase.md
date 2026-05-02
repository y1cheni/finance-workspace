---
paths:
  - "financial-app/lib/supabase*"
  - "financial-app/app/api/**"
---

# Supabase 規範

## Client 初始化
```ts
// Client component
import { createClient } from '@/lib/supabase'
const supabase = createClient()

// Server component / Server Action（尚未引入，待擴充）
// import { createServerClient } from '@supabase/ssr'
```

## 現有 Tables

| Table | 說明 |
|-------|------|
| `subscriptions` | 訂閱項目（含 extended fields） |
| `debts` | 負債管理 |
| `goals` | 財務目標 |
| `cashflow` | 現金流紀錄 |
| `budget` | 預算設定 |

## 必須做的事
- 所有寫入操作前必須驗證 `auth.uid()`
- 讀取後要用 `?? []` 或 `?? {}` 提供預設值

```ts
// 標準寫入模式
const { data: { user } } = await supabase.auth.getUser()
if (!user) return

await supabase.from('table').insert({ ...data, user_id: user.id })
```

## 命名規範
- Table：snake_case
- Column：snake_case
- Migration 檔名：`{YYYYMMDDHHMMSS}_{動詞}_{描述}.sql`

## Migration SQL 模板
```sql
ALTER TABLE {table}
  ADD COLUMN IF NOT EXISTS {col} {type} DEFAULT {default};
```
