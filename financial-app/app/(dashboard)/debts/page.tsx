'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'
import { writeStore } from '@/lib/shared-store'
import CsvImportModal from '@/components/CsvImportModal'

interface Debt {
  id: string
  name: string
  debt_type: string
  original_amount: number
  remaining: number
  monthly_payment: number
  annual_rate: number
  end_date: string | null
}

const EMPTY: Omit<Debt, 'id'> = {
  name: '', debt_type: '信貸', original_amount: 0, remaining: 0,
  monthly_payment: 0, annual_rate: 0, end_date: null,
}

const TYPES = ['信貸', '房貸', '車貸', '學貸', '信用卡', '其他']

function fmt(n: number) { return `NT$ ${Math.round(n).toLocaleString('zh-TW')}` }

interface StrategyResult { months: number; totalInterest: number }

function simulate(debts: Debt[], extraPayment: number, mode: 'snowball' | 'avalanche'): StrategyResult {
  let ds = debts.map(d => ({ ...d, rem: d.remaining }))
  let month = 0
  let totalInterest = 0
  while (ds.some(d => d.rem > 0) && month < 600) {
    month++
    let extra = extraPayment
    ds = ds
      .sort((a, b) => mode === 'snowball' ? a.rem - b.rem : b.annual_rate - a.annual_rate)
      .map(d => {
        if (d.rem <= 0) return d
        const interest = d.rem * (d.annual_rate / 100 / 12)
        totalInterest += interest
        const pay = d.monthly_payment + extra
        extra = Math.max(0, pay - d.rem - interest)
        d.rem = Math.max(0, d.rem + interest - pay)
        return d
      })
  }
  return { months: month, totalInterest }
}

// Monthly total-balance timeline for chart (max 120 months)
function simulateTimeline(debts: Debt[], extraPayment: number, mode: 'snowball' | 'avalanche'): number[] {
  if (!debts.length) return []
  let ds = debts.map(d => ({ ...d, rem: d.remaining }))
  const balances: number[] = [ds.reduce((s, d) => s + d.rem, 0)]
  for (let m = 1; m <= 120; m++) {
    let extra = extraPayment
    ds = [...ds]
      .sort((a, b) => mode === 'snowball' ? a.rem - b.rem : b.annual_rate - a.annual_rate)
      .map(d => {
        if (d.rem <= 0) return d
        const interest = d.rem * (d.annual_rate / 100 / 12)
        const pay = Math.min(d.monthly_payment + extra, d.rem + interest)
        extra = Math.max(0, d.monthly_payment + extra - (d.rem + interest))
        return { ...d, rem: Math.max(0, d.rem + interest - pay) }
      })
    const total = ds.reduce((s, d) => s + d.rem, 0)
    balances.push(Math.round(total))
    if (total <= 0) break
  }
  return balances
}

// Per-debt months to payoff (no extra)
function debtMonths(d: Debt): number {
  if (d.monthly_payment <= 0 || d.remaining <= 0) return 0
  let rem = d.remaining
  let m = 0
  const mr = d.annual_rate / 100 / 12
  while (rem > 0 && m < 600) {
    m++
    rem = rem * (1 + mr) - d.monthly_payment
  }
  return m
}

export default function DebtsPage() {
  const [debts, setDebts]       = useState<Debt[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing]       = useState<Debt | null>(null)
  const [draft, setDraft]       = useState<Omit<Debt, 'id'>>(EMPTY)
  const [income, setIncome]     = useState(60000)
  const [extra, setExtra]       = useState(0)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('debts').select('*').order('remaining', { ascending: false }).then(({ data }) => {
      const d = (data ?? []) as Debt[]
      setDebts(d)
      setLoading(false)
    })
  }, [])

  // sync to shared store whenever debts change
  useEffect(() => {
    const totalDebt = debts.reduce((s, d) => s + d.remaining, 0)
    const totalMonthlyDebtPayment = debts.reduce((s, d) => s + d.monthly_payment, 0)
    writeStore({ totalDebt, totalMonthlyDebtPayment })
  }, [debts])

  const openNew  = () => { setEditing(null); setDraft(EMPTY); setShowForm(true) }
  const openEdit = (d: Debt) => { setEditing(d); setDraft({ ...d }); setShowForm(true) }

  const save = async () => {
    if (!draft.name || draft.remaining <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      await supabase.from('debts').update(draft).eq('id', editing.id)
      setDebts(prev => prev.map(d => d.id === editing.id ? { ...editing, ...draft } : d))
    } else {
      const { data } = await supabase.from('debts').insert({ ...draft, user_id: user.id }).select().single()
      if (data) setDebts(prev => [...prev, data as Debt])
    }
    setShowForm(false)
  }

  const del = async (id: string) => {
    await supabase.from('debts').delete().eq('id', id)
    setDebts(prev => prev.filter(d => d.id !== id))
  }

  const totalDebt    = debts.reduce((s, d) => s + d.remaining, 0)
  const totalPayment = debts.reduce((s, d) => s + d.monthly_payment, 0)
  const dti          = income > 0 ? (totalPayment / income) * 100 : 0

  const sbBase = debts.length > 0 ? simulate(debts, 0, 'snowball') : { months: 0, totalInterest: 0 }
  const avBase = debts.length > 0 ? simulate(debts, 0, 'avalanche') : { months: 0, totalInterest: 0 }
  const sbExtra = debts.length > 0 ? simulate(debts, extra, 'snowball') : { months: 0, totalInterest: 0 }
  const avExtra = debts.length > 0 ? simulate(debts, extra, 'avalanche') : { months: 0, totalInterest: 0 }

  const chartData = debts.map(d => ({
    name: d.name,
    剩餘: d.remaining,
    已還: Math.max(0, d.original_amount - d.remaining),
  }))

  const sbTimeline = useMemo(() => simulateTimeline(debts, extra, 'snowball'),  [debts, extra])
  const avTimeline = useMemo(() => simulateTimeline(debts, extra, 'avalanche'), [debts, extra])
  const timelineData = useMemo(() => {
    const maxLen = Math.max(sbTimeline.length, avTimeline.length)
    return Array.from({ length: maxLen }, (_, i) => ({
      month: i,
      雪球法: sbTimeline[i] ?? 0,
      雪崩法: avTimeline[i] ?? 0,
    }))
  }, [sbTimeline, avTimeline])

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: D.accent }} />
    </div>
  )

  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>負債管理</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.surface, color: D.muted, border: `1px solid var(--subtle)` }}>
            ↑ 匯入 CSV
          </button>
          <button onClick={openNew}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.ink, color: D.bg }}>
            + 新增負債
          </button>
        </div>
      </div>

      {/* 摘要 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '總負債餘額',   value: fmt(totalDebt),      accent: true,  danger: false },
          { label: '每月還款合計', value: fmt(totalPayment),   accent: false, danger: false },
          { label: 'DTI 比率',    value: `${dti.toFixed(1)}%`, accent: false, danger: dti > 36 },
          { label: '負債筆數',    value: `${debts.length} 筆`, accent: false, danger: false },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.danger ? D.danger : m.accent ? D.accent : D.ink }}>{m.value}</p>
          </div>
        ))}
      </div>

      {dti > 0 && (
        <div className="rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4" style={{ backgroundColor: D.surface }}>
          <label className="text-xs shrink-0" style={{ color: D.muted }}>每月收入（計算 DTI 用）</label>
          <input type="number" value={income} step={5000}
            onChange={e => setIncome(Number(e.target.value))}
            className="w-36 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
          <p className="text-xs" style={{ color: D.muted }}>
            {dti <= 28 ? 'DTI ≤ 28%：健康' : dti <= 36 ? 'DTI 28~36%：注意' : 'DTI > 36%：高風險，建議減少負債'}
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          {/* 列表 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                    {['名稱', '類型', '剩餘金額', '每月還款', '年利率', '總利息', '還清月數', ''].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-xs font-medium" style={{ color: D.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {debts.map(d => {
                    const months = debtMonths(d)
                    const totalInterest = months > 0
                      ? d.monthly_payment * months - d.remaining
                      : 0
                    return (
                      <tr key={d.id} style={{ borderBottom: `1px solid var(--subtle)` }}>
                        <td className="py-2 pr-4 font-medium" style={{ color: D.ink }}>{d.name}</td>
                        <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{d.debt_type}</td>
                        <td className="py-2 pr-4 font-semibold" style={{ color: D.accent }}>{fmt(d.remaining)}</td>
                        <td className="py-2 pr-4" style={{ color: D.muted }}>{fmt(d.monthly_payment)}</td>
                        <td className="py-2 pr-4" style={{ color: D.muted }}>{d.annual_rate}%</td>
                        <td className="py-2 pr-4 text-xs" style={{ color: D.danger }}>{fmt(totalInterest)}</td>
                        <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>
                          {months >= 600 ? '600+' : months} 個月
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(d)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.muted }}>編輯</button>
                            <button onClick={() => del(d.id)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.danger }}>刪除</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {debts.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-xs" style={{ color: D.muted }}>尚無負債項目</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 負債結構 BarChart */}
          {debts.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>負債結構</p>
              <ResponsiveContainer width="100%" height={Math.max(160, debts.length * 48)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                  <XAxis type="number" tickFormatter={v => `${(v/10000).toFixed(0)}萬`}
                    tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="剩餘" stackId="a" fill="var(--accent)" fillOpacity={0.8} />
                  <Bar dataKey="已還" stackId="a" fill="var(--subtle)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 還款曲線 LineChart */}
          {debts.length > 0 && timelineData.length > 1 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs" style={{ color: D.muted }}>還款進度曲線</p>
                <div className="text-right">
                  {sbTimeline.length !== avTimeline.length && (
                    <p className="text-xs" style={{ color: D.accent }}>
                      雪崩法可提前 {Math.abs(sbTimeline.length - avTimeline.length)} 個月還清
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs mb-4" style={{ color: D.muted, opacity: 0.6 }}>
                每月剩餘負債總額（月數含額外還款 {extra > 0 ? fmt(extra) : '無'}）
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timelineData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                  <XAxis dataKey="month" tickFormatter={v => `${v}月`}
                    tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false}
                    interval="preserveStartEnd" />
                  <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`}
                    tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v))}
                    labelFormatter={v => `第 ${v} 個月`}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="var(--subtle)" />
                  <Line type="monotone" dataKey="雪球法" stroke="var(--muted)"
                    strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="雪崩法" stroke="var(--accent)"
                    strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 text-xs" style={{ color: D.muted }}>
                <span>
                  雪球法：<strong style={{ color: D.ink }}>{sbTimeline.length - 1} 個月</strong>，
                  利息 <strong style={{ color: D.danger }}>{fmt(Math.round(sbBase.totalInterest))}</strong>
                </span>
                <span>
                  雪崩法：<strong style={{ color: D.accent }}>{avTimeline.length - 1} 個月</strong>，
                  利息 <strong style={{ color: D.danger }}>{fmt(Math.round(avBase.totalInterest))}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 還款策略 */}
        {debts.length > 0 && (
          <div className="lg:w-80 shrink-0 space-y-4">

            {/* ── APR / 費用分析 ── */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs font-medium mb-1" style={{ color: D.ink }}>費用分析</p>
              <p className="text-xs mb-4" style={{ color: D.muted }}>
                契約總額 − 實拿 = 利息＋手續費；APR 越高優先還
              </p>
              <div className="space-y-3">
                {[...debts]
                  .filter(d => d.annual_rate > 0 || d.original_amount > d.remaining)
                  .sort((a, b) => b.annual_rate - a.annual_rate)
                  .map(d => {
                    const totalCost   = d.original_amount > d.remaining
                      ? d.original_amount - d.remaining
                      : (() => {
                          const m = debtMonths(d)
                          return m > 0 ? d.monthly_payment * m - d.remaining : 0
                        })()
                    const costRatio = d.original_amount > 0 ? totalCost / d.original_amount : 0
                    const maxAPR    = Math.max(...debts.map(x => x.annual_rate), 1)
                    return (
                      <div key={d.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium truncate max-w-[120px]" style={{ color: D.ink }}>{d.name}</span>
                          <span style={{ color: d.annual_rate > 10 ? D.danger : D.muted }}>
                            APR {d.annual_rate.toFixed(2)}%
                          </span>
                        </div>
                        {/* APR bar */}
                        <div className="h-1 rounded-full mb-1" style={{ backgroundColor: D.bg }}>
                          <div className="h-1 rounded-full" style={{
                            width: `${(d.annual_rate / maxAPR) * 100}%`,
                            backgroundColor: d.annual_rate > 10 ? D.danger : D.accent,
                          }} />
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: D.muted }}>
                          <span>
                            利息＋費 {fmt(Math.round(totalCost))}
                          </span>
                          <span style={{ color: costRatio > 0.3 ? D.danger : D.muted }}>
                            佔 {(costRatio * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>
              {/* Total interest */}
              {(() => {
                const totalInterest = debts.reduce((s, d) => {
                  if (d.original_amount > d.remaining) return s + (d.original_amount - d.remaining)
                  const m = debtMonths(d)
                  return s + (m > 0 ? d.monthly_payment * m - d.remaining : 0)
                }, 0)
                return (
                  <div className="mt-4 pt-3 flex justify-between text-xs"
                    style={{ borderTop: `1px solid var(--subtle)` }}>
                    <span style={{ color: D.muted }}>全部利息＋費用合計</span>
                    <span className="font-semibold" style={{ color: D.danger }}>
                      {fmt(Math.round(totalInterest))}
                    </span>
                  </div>
                )
              })()}
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>還款策略比較</p>
              <div className="mb-4">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>每月額外還款 (NT$)</label>
                <input type="number" value={extra} step={1000}
                  onChange={e => setExtra(Number(e.target.value))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>

              {[
                {
                  name: '雪球法', sub: '餘額小→大，心理成就感強',
                  base: sbBase, extra: sbExtra,
                },
                {
                  name: '雪崩法', sub: '利率高→低，總利息最少',
                  base: avBase, extra: avExtra,
                },
              ].map(s => (
                <div key={s.name} className="mb-4 p-4 rounded-xl" style={{ backgroundColor: D.bg }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: D.ink }}>{s.name}</p>
                  <p className="text-xs mb-3" style={{ color: D.muted }}>{s.sub}</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs" style={{ color: D.muted }}>還清月數</p>
                      <p className="text-base font-bold" style={{ color: D.accent }}>
                        {s.extra.months >= 600 ? '600+' : s.extra.months}
                        <span className="text-xs font-normal ml-1" style={{ color: D.muted }}>月</span>
                      </p>
                      {extra > 0 && s.extra.months < s.base.months && (
                        <p className="text-xs" style={{ color: D.accent }}>
                          省 {s.base.months - s.extra.months} 個月
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: D.muted }}>總利息支出</p>
                      <p className="text-sm font-bold" style={{ color: D.danger }}>
                        {fmt(Math.round(s.extra.totalInterest))}
                      </p>
                      {extra > 0 && s.extra.totalInterest < s.base.totalInterest && (
                        <p className="text-xs" style={{ color: D.accent }}>
                          省息 {fmt(Math.round(s.base.totalInterest - s.extra.totalInterest))}
                        </p>
                      )}
                    </div>
                  </div>

                  {extra > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid var(--subtle)` }}>
                      <div className="flex justify-between text-xs" style={{ color: D.muted }}>
                        <span>額外還款效益（每月 +{fmt(extra)}）</span>
                      </div>
                      <div className="flex gap-4 mt-1">
                        <div>
                          <p className="text-xs" style={{ color: D.muted }}>節省時間</p>
                          <p className="text-xs font-semibold" style={{ color: D.accent }}>
                            {s.base.months - s.extra.months} 個月
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: D.muted }}>節省利息</p>
                          <p className="text-xs font-semibold" style={{ color: D.accent }}>
                            {fmt(Math.round(s.base.totalInterest - s.extra.totalInterest))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showImport && (
        <CsvImportModal
          title="匯入負債資料（支援 M-flow 格式）"
          templateCsv={[
            '負債名稱,type,契約總負債額,實拿,月付,APR年化成本,終止',
            '國泰信貸,信貸,372780,291000,6213,5.62%,2901',
            'linebank,信貸,127680,98697,2128,5.87%,3003',
            '房屋貸款,房貸,8000000,6500000,35000,2.06%,3506',
          ].join('\n')}
          templateFilename="負債範本_mflow.csv"
          fields={[
            { key: 'name',             label: '負債名稱', required: true, type: 'text' },
            { key: 'debt_type',        label: '類型',     type: 'text', defaultValue: '其他',
              hint: '信貸/房貸/車貸/信用卡' },
            { key: 'original_amount',  label: '契約總負債額', type: 'number',
              hint: '含利息費用的合約總額' },
            { key: 'remaining',        label: '實拿/剩餘', required: true, type: 'number',
              hint: '實際收到金額或剩餘餘額' },
            { key: 'monthly_payment',  label: '月付',     type: 'number' },
            { key: 'annual_rate',      label: 'APR年化',  type: 'number',
              hint: '自動去除 % 符號' },
            { key: 'end_date',         label: '終止日',   type: 'text',
              hint: 'YYMM 如 2608 或 YYYY-MM-DD' },
          ]}
          validate={(rec) => {
            const remaining = rec.remaining as number | null
            if (!remaining || remaining <= 0) return '實拿/剩餘必須大於 0'
            return null
          }}
          onConfirm={async (records) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const rows = records.map(r => {
              // Parse YYMM format "2608" → "2026-08-01"
              const edRaw = r.end_date as string | null
              let end_date: string | null = null
              if (edRaw) {
                if (/^\d{4}$/.test(edRaw)) {
                  end_date = `20${edRaw.slice(0, 2)}-${edRaw.slice(2)}-01`
                } else if (/^\d{4}-\d{2}/.test(edRaw)) {
                  end_date = edRaw
                }
              }
              const remaining = r.remaining as number
              const original_amount = (r.original_amount as number) || remaining
              return {
                name:             r.name as string,
                debt_type:        (r.debt_type as string) || '其他',
                original_amount,
                remaining,
                monthly_payment:  (r.monthly_payment as number) || 0,
                annual_rate:      (r.annual_rate as number) || 0,
                end_date,
                user_id:          user.id,
              }
            })
            const { data } = await supabase.from('debts').insert(rows).select()
            if (data) setDebts(prev => [...prev, ...(data as Debt[])])
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* 表單 Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ backgroundColor: D.surface }}>
            <p className="text-sm font-semibold mb-4" style={{ color: D.ink }}>{editing ? '編輯負債' : '新增負債'}</p>
            <div className="mb-3">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>名稱</label>
              <input type="text" value={draft.name}
                onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
            </div>
            <div className="mb-3">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>類型</label>
              <select value={draft.debt_type} onChange={e => setDraft(p => ({ ...p, debt_type: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { label: '原始金額 (NT$)',  key: 'original_amount' },
              { label: '剩餘金額 (NT$)',  key: 'remaining'       },
              { label: '每月還款 (NT$)',  key: 'monthly_payment' },
              { label: '年利率 (%)',      key: 'annual_rate'     },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>{f.label}</label>
                <input type="number" value={(draft as any)[f.key]}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>
            ))}
            <div className="mb-3">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>預計還清日（選填）</label>
              <input type="date" value={draft.end_date ?? ''}
                onChange={e => setDraft(p => ({ ...p, end_date: e.target.value || null }))}
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.bg, color: D.muted }}>取消</button>
              <button onClick={save}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.ink, color: D.bg }}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
