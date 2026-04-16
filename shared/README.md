# shared/ — 跨子專案共用模組

## 用途

此目錄用於集中管理 `financial-app`（TypeScript）與 `financial-tool`（Python）之間的重疊功能。

目前兩個子專案使用不同語言，因此 **無法直接共用程式碼**。
`shared/` 目前作用為：

1. **記錄重疊功能清單**，作為未來遷移的依據
2. **定義演算法規格與測試錨點**，確保兩個語言實作行為一致
3. **未來擴充點**：若需要第三個子專案，應優先從此目錄引用

---

## 重疊功能清單

### math-engine（財務數學計算引擎）

| 功能 | financial-app | financial-tool | 遷移狀態 |
|------|---------------|----------------|----------|
| Future Value | `lib/math-engine.ts` → `fv()` | `models/math_engine.py` → `fv()` | 待遷移 |
| Present Value | `lib/math-engine.ts` → `pvFromFv()` | `models/math_engine.py` → `pv_from_fv()` | 待遷移 |
| CAGR | `lib/math-engine.ts` → `cagr()` | `models/math_engine.py` → `cagr()` | 待遷移 |
| Annuity FV | `lib/math-engine.ts` → `annuityFv()` | `models/math_engine.py` → `annuity_fv()` | 待遷移 |
| Annuity PV | `lib/math-engine.ts` → `annuityPv()` | `models/math_engine.py` → `annuity_pv()` | 待遷移 |
| 每月需存金額反推 | `lib/math-engine.ts` → `monthlySavingsNeeded()` | `models/math_engine.py` → `monthly_savings_needed()` | 待遷移 |
| 達標所需年數 | `lib/math-engine.ts` → `yearsToTarget()` | `models/math_engine.py` → `years_to_target()` | 待遷移 |
| 複利時間序列 | `lib/math-engine.ts` → `compoundSeries()` | `models/math_engine.py` → `compound_series()` | 待遷移 |
| IRR（Newton-Raphson） | `lib/math-engine.ts` → `irr()` | `models/math_engine.py` → `irr()` | 待遷移 |
| NPV | `lib/math-engine.ts` → `npv()` | `models/math_engine.py` → `npv()` | 待遷移 |

### statement-engine（財務報表投影引擎）

| 功能 | financial-app | financial-tool | 遷移狀態 |
|------|---------------|----------------|----------|
| 年度 B/S + P/L 投影 | `lib/statement-engine.ts` → `generateStatements()` | `models/statement_engine.py` → `generate_statements()` | 待遷移 |

---

## 演算法規格（錨點測試案例）

兩個語言實作必須對以下測試案例回傳一致結果（誤差 < 1 NT$）。

### math-engine 測試錨點

```
案例 A：複利終值
輸入：initial=1,000,000, annualRate=0.07, years=20, monthlyContribution=10,000, compoundFreq=12
預期 balance[-1]：約 8,618,983

案例 B：退休反推
輸入：targetFv=18,000,000, currentSavings=500,000, annualRate=0.07, months=360（30 年）
預期 monthlySavingsNeeded：約 14,476

案例 C：4% 法則目標
輸入：monthlyExpense=60,000
預期 target：60,000 × 12 / 0.04 = 18,000,000

案例 D：IRR 邊界
輸入：cashFlows=[-1,000,000, 200,000, 200,000, 200,000, 200,000, 800,000]
預期 IRR：約 0.1283（12.83%）
```

### statement-engine 測試錨點

```
案例 E：年度淨值成長
輸入（year 0）：cash=500,000, investments=1,000,000, realEstate=3,000,000,
               liabilities=2,000,000, monthlyIncome=80,000, monthlyExpenses=50,000,
               investmentReturn=0.07, years=1
預期 year 0 netWorth：2,500,000
預期 year 1 netWorth：約 2,930,000
（cash += 30,000×12=360,000；investments × 1.07 = 1,070,000；liabilities -= 200,000）
```

---

## 遷移指引（未來參考）

當決定將某個引擎正式遷入 `shared/` 時，建議方式：

**Option A（漸進）**：保留兩個語言版本，在 `shared/` 新增跨語言測試腳本，驗證輸出一致性。

**Option B（TypeScript 為主）**：若 financial-tool 未來重寫為 Next.js/Node.js，可直接引用 `shared/` 的 TypeScript 實作，消除 Python 版本。

**Option C（Python 為主）**：若新增 Python API server，可消除 TypeScript 版本，financial-app 改為呼叫 API。

目前不強制執行任何 Option，等需求明確後再決策。
