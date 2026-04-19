'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'
import { writeStore } from '@/lib/shared-store'

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
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Debt | null>(null)
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
    已還: d.original_amount - d.remaining,
  }))

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: D.accent }} />
    </div>
  )

  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>負債管理</h1>
        <button onClick={openNew}
          className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.ink, color: D.bg }}>
          + 新增負債
        </button>
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

          {/* 圖表 */}
          {debts.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>負債結構</p>
              <ResponsiveContainer width="100%" height={220}>
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
        </div>

        {/* 還款策略 */}
        {debts.length > 0 && (
          <div className="lg:w-80 shrink-0 space-y-4">
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
