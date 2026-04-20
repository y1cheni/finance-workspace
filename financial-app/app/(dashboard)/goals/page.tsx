'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Slider from '@/components/Slider'
import FormulaPanel from '@/components/FormulaPanel'
import { D } from '@/lib/design'
import { readStore } from '@/lib/shared-store'
import { usePageParams } from '@/lib/use-page-params'

function fmt(n: number) { return `NT$ ${Math.round(n).toLocaleString('zh-TW')}` }

function calcMonthly(fv: number, pv: number, years: number, rate: number): number {
  if (years <= 0) return 0
  const n = years * 12
  const r = rate / 100 / 12
  const pvGrown = pv * Math.pow(1 + r, n)
  const gap = fv - pvGrown
  if (gap <= 0) return 0
  if (r === 0) return gap / n
  return gap * r / (Math.pow(1 + r, n) - 1)
}

function yearsNeeded(fv: number, pv: number, monthly: number, rate: number): number {
  const r = rate / 100 / 12
  let bal = pv
  for (let m = 1; m <= 600; m++) {
    bal = bal * (1 + r) + monthly
    if (bal >= fv) return m / 12
  }
  return Infinity
}

const FORMULAS = [
  {
    name: '每月需存金額（反向試算）',
    formula: 'PMT = (FV − PV × (1 + r)^n) × r / [(1 + r)^n − 1]',
    vars: [
      { sym: 'FV',  desc: '目標金額' },
      { sym: 'PV',  desc: '現有存款' },
      { sym: 'r',   desc: '每月利率 = 年化 / 12' },
      { sym: 'n',   desc: '月數 = 年數 × 12' },
      { sym: 'PMT', desc: '每月需存金額' },
    ],
  },
]

export default function GoalsPage() {
  const [goal,    setGoal]    = useState(3_000_000)
  const [current, setCurrent] = useState(500_000)
  const [years,   setYears]   = useState(10)
  const [rate,    setRate]    = useState(6)
  const [label,   setLabel]   = useState('買房頭期款')

  const monthly    = calcMonthly(goal, current, years, rate)
  const monthlyGap = goal - current * Math.pow(1 + rate / 100 / 12, years * 12)
  const alreadyThere = monthlyGap <= 0

  // Sensitivity: how different monthly amounts affect time needed
  const monthlyOptions = [3000, 5000, 8000, 10000, 15000, 20000, 30000, 50000].filter(m => m > 0)
  const sensitivityData = monthlyOptions.map(m => {
    const yr = yearsNeeded(goal, current, m, rate)
    return {
      monthly: `${(m/1000).toFixed(0)}k`,
      年數: yr === Infinity ? 50 : parseFloat(yr.toFixed(1)),
      達標: yr !== Infinity,
    }
  })

  // Rate sensitivity
  const rateOptions = [2, 3, 4, 5, 6, 7, 8, 10, 12]
  const rateSensitivity = rateOptions.map(r => ({
    rate: `${r}%`,
    每月需存: Math.round(calcMonthly(goal, current, years, r)),
  }))

  const currentParams = { goal, current, years, rate, label }
  const handleLoad = (p: Record<string, unknown>) => {
    if (typeof p.goal    === 'number') setGoal(p.goal)
    if (typeof p.current === 'number') setCurrent(p.current)
    if (typeof p.years   === 'number') setYears(p.years)
    if (typeof p.rate    === 'number') setRate(p.rate)
    if (typeof p.label   === 'string') setLabel(p.label)
  }
  usePageParams('goals', currentParams, handleLoad)

  const syncFromShared = () => {
    const s = readStore()
    if (s.budgetMonthlySavings) setCurrent(c => c) // savings rate hint - just show
  }

  return (
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: D.ink }}>目標儲蓄計算器</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左側輸入 */}
        <aside className="lg:w-60 shrink-0">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>目標設定</p>

            <div className="mb-4">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>目標名稱</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
            </div>

            <Slider label="目標金額" value={goal} min={100_000} max={20_000_000} step={100_000}
              format={fmt} onChange={setGoal} />
            <Slider label="現有存款" value={current} min={0} max={10_000_000} step={10_000}
              format={fmt} onChange={setCurrent} />
            <Slider label="達成年限" value={years} min={1} max={40} step={1}
              format={v => `${v} 年`} onChange={setYears} />
            <Slider label="年化報酬率" value={rate} min={0} max={15} step={0.1}
              format={v => `${v.toFixed(1)}%`} onChange={setRate} />

            <div className="mt-4 pt-4" style={{ borderTop: `1px solid var(--subtle)` }}>
              <p className="text-xs mb-2" style={{ color: D.muted }}>常見目標</p>
              <div className="space-y-1">
                {[
                  { label: '買車', goal: 800_000, years: 5 },
                  { label: '結婚基金', goal: 500_000, years: 3 },
                  { label: '買房頭期款', goal: 3_000_000, years: 10 },
                  { label: '子女教育基金', goal: 2_000_000, years: 18 },
                  { label: '創業資金', goal: 1_000_000, years: 5 },
                ].map(p => (
                  <button key={p.label}
                    onClick={() => { setGoal(p.goal); setYears(p.years); setLabel(p.label) }}
                    className="w-full text-left px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-70"
                    style={{ backgroundColor: label === p.label ? D.ink : D.bg, color: label === p.label ? D.bg : D.muted }}>
                    {p.label} — {fmt(p.goal)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 右側結果 */}
        <div className="flex-1 space-y-4">
          {/* 主要結果 */}
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-2" style={{ color: D.muted }}>
              距離「{label}」目標 {fmt(goal)}，還有 {years} 年
            </p>
            {alreadyThere ? (
              <>
                <p className="text-3xl font-bold mb-2" style={{ color: D.accent }}>已達標！</p>
                <p className="text-xs" style={{ color: D.muted }}>
                  現有存款 {fmt(current)} 在 {rate.toFixed(1)}% 報酬率下，{years} 年後將達 {fmt(current * Math.pow(1 + rate / 100 / 12, years * 12))}，超過目標
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl font-bold mb-1" style={{ color: D.accent }}>
                  {fmt(Math.ceil(monthly))}
                </p>
                <p className="text-sm" style={{ color: D.muted }}>每月需存入</p>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  {[
                    { label: '目標金額', value: fmt(goal) },
                    { label: '現有存款貢獻', value: fmt(Math.min(goal, current * Math.pow(1 + rate / 100 / 12, years * 12))) },
                    { label: '需靠定存補足', value: fmt(Math.max(0, monthlyGap)) },
                  ].map(m => (
                    <div key={m.label}>
                      <p className="text-xs" style={{ color: D.muted }}>{m.label}</p>
                      <p className="text-sm font-semibold" style={{ color: D.ink }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 進度條：目前存款 vs 目標 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="flex justify-between text-xs mb-2" style={{ color: D.muted }}>
              <span>目前進度</span>
              <span>{((current / goal) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: D.bg }}>
              <div className="h-2 rounded-full transition-all" style={{
                width: `${Math.min(100, (current / goal) * 100)}%`,
                backgroundColor: D.accent,
              }} />
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: D.muted }}>
              <span>{fmt(current)}</span>
              <span>{fmt(goal)}</span>
            </div>
          </div>

          {/* 每月存款 vs 達成年數 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>每月存款金額 → 達成年數（年利率 {rate.toFixed(1)}%）</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sensitivityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="monthly" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}年`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any, name: any) => [`${v} 年`, '達成年數']}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="年數" fill="var(--accent)" fillOpacity={0.8} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 利率敏感度 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>利率敏感度 — {years} 年達成 {fmt(goal)} 所需月存款</p>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                  {['年化利率', '每月需存', '比較'].map(h => (
                    <th key={h} className="text-left py-2 pr-4 font-medium" style={{ color: D.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rateSensitivity.map((r, i) => {
                  const base = rateSensitivity.find(x => x.rate === `${rate.toFixed(1)}%`)?.每月需存 ?? monthly
                  const diff = r.每月需存 - Math.round(base)
                  const isCurrent = parseFloat(r.rate) === rate
                  return (
                    <tr key={r.rate} style={{ borderBottom: `1px solid var(--subtle)`, opacity: isCurrent ? 1 : 0.7 }}>
                      <td className="py-1.5 pr-4 font-semibold" style={{ color: isCurrent ? D.accent : D.ink }}>{r.rate}</td>
                      <td className="py-1.5 pr-4" style={{ color: D.ink }}>{fmt(r.每月需存)}</td>
                      <td className="py-1.5" style={{ color: diff < 0 ? D.accent : diff > 0 ? D.danger : D.muted }}>
                        {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <FormulaPanel formulas={FORMULAS} />
        </div>
      </div>
    </div>
  )
}
