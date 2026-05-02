---
paths:
  - "financial-app/app/**/*.tsx"
  - "financial-app/components/**/*.tsx"
---

# UI 設計規範（finance-workspace）

## 色彩系統（一律用 CSS variable，不 hardcode hex）

```
var(--bg)      #F5F4EC   淡米色背景
var(--surface) #ECEAE0   卡片背景
var(--ink)     #1A1A1A   主要文字
var(--muted)   #AAAAAA   次要文字
var(--subtle)  #D4D2C8   分隔線/邊框
var(--accent)  #E8A020   橙金強調色
var(--danger)  #C0392B   警示/刪除

/* Dark mode */
var(--bg)      #1C1C1A
var(--surface) #252522
var(--ink)     #F0EFE7
var(--muted)   #888884
var(--subtle)  #3A3A36
```

所有顏色一律透過 `D` 物件引用（`import { D } from '@/lib/design'`）：
```ts
D.bg / D.surface / D.ink / D.muted / D.accent / D.danger
```

## 字型
- 主字型：JetBrains Mono（monospace），透過 `var(--font-mono)` 引用
- `style={{ fontFamily: D.font }}` 套用於頁面根元素

## Layout
- Sidebar：固定左側，寬 220px（展開）/ 56px（收合）
- Main content：`padding: 2rem 2.5rem`
- 頁面標題：`text-xl font-bold mb-6`

## 元件規格

### 卡片
```tsx
className="rounded-2xl p-4"
style={{ backgroundColor: D.surface }}
```

### 按鈕 Primary（深色）
```tsx
className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
style={{ backgroundColor: D.ink, color: D.bg }}
```

### 按鈕 Secondary（淺色）
```tsx
className="px-3 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
style={{ backgroundColor: D.surface, color: D.muted, border: `1px solid var(--subtle)` }}
```

### 輸入框
```tsx
className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}
```

### Recharts 圖表
```tsx
<CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
<XAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
<Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
```

## 禁止事項
- 禁止引入任何 icon library（lucide-react、heroicons、react-icons 等）
- 禁止使用 emoji
- 禁止 hardcode hex（`#xxxxxx`），一律用 CSS variable
- 禁止 hardcode 顏色字串（`'white'`、`'black'`、`'gray-500'` 等）
- 禁止 `any` 型別

## Icons
使用 Unicode 文字符號：`∿ ◎ ▦ ↺ ⊖ ◈ § ⇅ ⊙ × +`
