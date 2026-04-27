'use client'
import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Slider from '@/components/Slider'
import FormulaPanel from '@/components/FormulaPanel'
import { D } from '@/lib/design'

/* ─── Types ─── */
interface GoalDef {
  id: string
  label: string
  goal: number
  current: number
  years: number
  rate: number
}

const GOALS_KEY = 'ftp-goals-v1'

const PRESETS: Omit<GoalDef, 'id'>[] = [
  { label: '買房頭期款',   goal: 3_000_000, current: 0, years: 10, rate: 6 },
  { label: '買車',         goal:   800_000, current: 0, years:  5, rate: 4 },
  { label: '結婚基金',     goal:   500_000, current: 0, years:  3, rate: 4 },
  { label: '子女教育基金', goal: 2_000_000, current: 0, years: 18, rate: 6 },
  { label: '創業資金',     goal: 1_000_000, current: 0, years:  5, rate: 5 },
  { label: '環遊世界',     goal:   300_000, current: 0, years:  3, rate: 3 },
]

function newId() { return Math.random().toString(36).slice(2) }

function loadGoals(): GoalDef[] {
  if (typeof window === 'undefined') return []
  try { const r = localStorage.getItem(GOALS_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveGoals(goals: GoalDef[]) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals))
}

/* ─── Math helpers ─── */
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

/* ─── Main ─── */
export default function GoalsPage() {
  const [goals,     setGoals]     = useState<GoalDef[]>([])
  const [activeId,  setActiveId]  = useState<string | null>(null)
  const [showPreset, setShowPreset] = useState(false)

  useEffect(() => {
    const loaded = loadGoals()
    setGoals(loaded)
    if (loaded.length > 0) setActiveId(loaded[0].id)
  }, [])

  const active = goals.find(g => g.id === activeId) ?? null

  function updateActive(patch: Partial<GoalDef>) {
    if (!active) return
    const updated = goals.map(g => g.id === active.id ? { ...g, ...patch } : g)
    setGoals(updated)
    saveGoals(updated)
  }

  function addGoal(preset?: Omit<GoalDef, 'id'>) {
    const g: GoalDef = { id: newId(), label: '新目標', goal: 1_000_000, current: 0, years: 5, rate: 6, ...preset }
    const next = [...goals, g]
    setGoals(next)
    saveGoals(next)
    setActiveId(g.id)
    setShowPreset(false)
  }

  function deleteGoal(id: string) {
    const next = goals.filter(g => g.id !== id)
    setGoals(next)
    saveGoals(next)
    if (activeId === id) setActiveId(next[0]?.id ?? null)
  }

  /* ─── Active goal calculations ─── */
  const monthly    = active ? calcMonthly(active.goal, active.current, active.years, active.rate) : 0
  const monthlyGap = active ? active.goal - active.current * Math.pow(1 + active.rate / 100 / 12, active.years * 12) : 0
  const alreadyThere = monthlyGap <= 0

  const sensitivityData = useMemo(() => {
    if (!active) return []
    return [3000,5000,8000,10000,15000,20000,30000,50000].map(m => {
      const yr = yearsNeeded(active.goal, active.current, m, active.rate)
      return { monthly: `${(m/1000).toFixed(0)}k`, 年數: yr === Infinity ? 50 : parseFloat(yr.toFixed(1)) }
    })
  }, [active?.goal, active?.current, active?.rate])

  const rateOptions = [2,3,4,5,6,7,8,10,12]
  const rateSensitivity = useMemo(() => {
    if (!active) return []
    return rateOptions.map(r => ({
      rate: `${r}%`,
      每月需存: Math.round(calcMonthly(active.goal, active.current, active.years, r)),
    }))
  }, [active?.goal, active?.current, active?.years])

  const tooltipStyle = { backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }

  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>目標儲蓄</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowPreset(v => !v)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.surface, color: D.muted }}>
            + 快速新增
          </button>
          <button onClick={() => addGoal()}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.ink, color: D.bg }}>
            + 自訂目標
          </button>
        </div>
      </div>

      {/* Preset picker */}
      {showPreset && (
        <div className="rounded-2xl p-4 mb-4 flex flex-wrap gap-2" style={{ backgroundColor: D.surface }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => addGoal(p)}
              className="px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-70"
              style={{ backgroundColor: D.bg, color: D.muted }}>
              {p.label} — {fmt(p.goal)}
            </button>
          ))}
        </div>
      )}

      {/* All goals grid */}
      {goals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {goals.map(g => {
            const m = calcMonthly(g.goal, g.current, g.years, g.rate)
            const gap = g.goal - g.current * Math.pow(1 + g.rate / 100 / 12, g.years * 12)
            const done = gap <= 0
            const pct  = Math.min(100, (g.current / g.goal) * 100)
            const isActive = g.id === activeId
            return (
              <div key={g.id}
                onClick={() => setActiveId(g.id)}
                className="rounded-2xl p-4 cursor-pointer transition-all"
                style={{
                  backgroundColor: D.surface,
                  outline: isActive ? `2px solid var(--accent)` : '2px solid transparent',
                }}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold truncate pr-2" style={{ color: D.ink }}>{g.label}</p>
                  <button
                    onClick={e => { e.stopPropagation(); deleteGoal(g.id) }}
                    className="text-xs shrink-0 transition-opacity hover:opacity-50"
                    style={{ color: D.muted }}>✕</button>
                </div>
                <p className="text-xs mb-2" style={{ color: D.muted }}>目標 {fmt(g.goal)}</p>

                {done ? (
                  <p className="text-sm font-bold" style={{ color: D.accent }}>已達標 ✓</p>
                ) : (
                  <p className="text-sm font-bold" style={{ color: D.accent }}>
                    {fmt(Math.ceil(m))}
                    <span className="text-xs font-normal ml-1" style={{ color: D.muted }}>/月</span>
                  </p>
                )}

                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: D.bg }}>
                  <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: D.accent }} />
                </div>
                <div className="flex justify-between text-xs mt-1" style={{ color: D.muted }}>
                  <span>{pct.toFixed(0)}%</span>
                  <span>{g.years} 年 · {g.rate}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {goals.length === 0 && (
        <div className="rounded-2xl p-12 text-center mb-6" style={{ backgroundColor: D.surface }}>
          <p className="text-sm mb-2" style={{ color: D.ink }}>尚無目標</p>
          <p className="text-xs" style={{ color: D.muted }}>點擊「+ 快速新增」選擇常見目標，或「+ 自訂目標」建立新目標</p>
        </div>
      )}

      {/* Active goal detail */}
      {active && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: sliders */}
          <aside className="lg:w-60 shrink-0">
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>目標設定</p>
              <div className="mb-4">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>目標名稱</label>
                <input type="text" value={active.label} onChange={e => updateActive({ label: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>
              <Slider label="目標金額" value={active.goal} min={100_000} max={20_000_000} step={100_000}
                format={fmt} onChange={v => updateActive({ goal: v })} />
              <Slider label="現有存款" value={active.current} min={0} max={10_000_000} step={10_000}
                format={fmt} onChange={v => updateActive({ current: v })} />
              <Slider label="達成年限" value={active.years} min={1} max={40} step={1}
                format={v => `${v} 年`} onChange={v => updateActive({ years: v })} />
              <Slider label="年化報酬率" value={active.rate} min={0} max={15} step={0.1}
                format={v => `${v.toFixed(1)}%`} onChange={v => updateActive({ rate: v })} />
            </div>
          </aside>

          {/* Right: results */}
          <div className="flex-1 space-y-4">
            {/* Main result */}
            <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-2" style={{ color: D.muted }}>
                距離「{active.label}」目標 {fmt(active.goal)}，還有 {active.years} 年
              </p>
              {alreadyThere ? (
                <>
                  <p className="text-3xl font-bold mb-2" style={{ color: D.accent }}>已達標！</p>
                  <p className="text-xs" style={{ color: D.muted }}>
                    現有存款在 {active.rate.toFixed(1)}% 報酬率下，{active.years} 年後將達{' '}
                    {fmt(active.current * Math.pow(1 + active.rate / 100 / 12, active.years * 12))}，超過目標
                  </p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold mb-1" style={{ color: D.accent }}>{fmt(Math.ceil(monthly))}</p>
                  <p className="text-sm" style={{ color: D.muted }}>每月需存入</p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {[
                      { label: '目標金額', value: fmt(active.goal) },
                      { label: '現有存款貢獻', value: fmt(Math.min(active.goal, active.current * Math.pow(1 + active.rate / 100 / 12, active.years * 12))) },
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

            {/* Progress bar */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <div className="flex justify-between text-xs mb-2" style={{ color: D.muted }}>
                <span>目前進度</span>
                <span>{((active.current / active.goal) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: D.bg }}>
                <div className="h-2 rounded-full transition-all" style={{
                  width: `${Math.min(100, (active.current / active.goal) * 100)}%`,
                  backgroundColor: D.accent,
                }} />
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: D.muted }}>
                <span>{fmt(active.current)}</span><span>{fmt(active.goal)}</span>
              </div>
            </div>

            {/* Sensitivity: monthly → years */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>
                每月存款金額 → 達成年數（年利率 {active.rate.toFixed(1)}%）
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sensitivityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                  <XAxis dataKey="monthly" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}年`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`${v} 年`, '達成年數']} contentStyle={tooltipStyle} />
                  <Bar dataKey="年數" fill="var(--accent)" fillOpacity={0.8} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Rate sensitivity table */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-3" style={{ color: D.muted }}>
                利率敏感度 — {active.years} 年達成 {fmt(active.goal)} 所需月存款
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                    {['年化利率', '每月需存', '比較'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 font-medium" style={{ color: D.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rateSensitivity.map(r => {
                    const base = rateSensitivity.find(x => x.rate === `${active.rate.toFixed(1)}%`)?.每月需存 ?? monthly
                    const diff = r.每月需存 - Math.round(base)
                    const isCurrent = parseFloat(r.rate) === active.rate
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
      )}
    </div>
  )
}
