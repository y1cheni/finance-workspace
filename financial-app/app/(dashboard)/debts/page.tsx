'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'

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

function fmt(n: number) {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

function snowball(debts: Debt[], extraPayment: number) {
  let ds = debts.map(d => ({ ...d, rem: d.remaining }))
  let month = 0
  while (ds.some(d => d.rem > 0) && month < 600) {
    month++
    let extra = extraPayment
    ds = ds
      .sort((a, b) => a.rem - b.rem)
      .map(d => {
        if (d.rem <= 0) return d
        const interest = d.rem * (d.annual_rate / 100 / 12)
        const pay = d.monthly_payment + extra
        extra = Math.max(0, pay - d.rem - interest)
        d.rem = Math.max(0, d.rem + interest - pay)
        return d
      })
  }
  return month
}

function avalanche(debts: Debt[], extraPayment: number) {
  let ds = debts.map(d => ({ ...d, rem: d.remaining }))
  let month = 0
  while (ds.some(d => d.rem > 0) && month < 600) {
    month++
    let extra = extraPayment
    ds = ds
      .sort((a, b) => b.annual_rate - a.annual_rate)
      .map(d => {
        if (d.rem <= 0) return d
        const interest = d.rem * (d.annual_rate / 100 / 12)
        const pay = d.monthly_payment + extra
        extra = Math.max(0, pay - d.rem - interest)
        d.rem = Math.max(0, d.rem + interest - pay)
        return d
      })
  }
  return month
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
      setDebts((data ?? []) as Debt[])
      setLoading(false)
    })
  }, [])

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

  const sbMonths = debts.length > 0 ? snowball(debts, extra) : 0
  const avMonths = debts.length > 0 ? avalanche(debts, extra) : 0

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '總負債餘額',   value: fmt(totalDebt),      accent: true  },
          { label: '每月還款合計', value: fmt(totalPayment),   accent: false },
          { label: 'DTI 比率',    value: `${dti.toFixed(1)}%`, accent: false, danger: dti > 36 },
          { label: '負債筆數',    value: `${debts.length} 筆`, accent: false },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.danger ? D.danger : m.accent ? D.accent : D.ink }}>{m.value}</p>
          </div>
        ))}
      </div>

      {dti > 0 && (
        <div className="rounded-2xl p-4 mb-4 flex items-center gap-4" style={{ backgroundColor: D.surface }}>
          <label className="text-xs shrink-0" style={{ color: D.muted }}>每月收入（計算 DTI 用）</label>
          <input type="number" value={income} step={5000}
            onChange={e => setIncome(Number(e.target.value))}
            className="w-36 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
          <p className="text-xs ml-2" style={{ color: D.muted }}>
            {dti <= 28 ? 'DTI ≤ 28%：健康' : dti <= 36 ? 'DTI 28~36%：注意' : 'DTI > 36%：高風險，建議減少負債'}
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                    {['名稱', '類型', '剩餘金額', '每月還款', '年利率', '還清日', ''].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-xs font-medium" style={{ color: D.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {debts.map(d => (
                    <tr key={d.id} style={{ borderBottom: `1px solid var(--subtle)` }}>
                      <td className="py-2 pr-4 font-medium" style={{ color: D.ink }}>{d.name}</td>
                      <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{d.debt_type}</td>
                      <td className="py-2 pr-4 font-semibold" style={{ color: D.accent }}>{fmt(d.remaining)}</td>
                      <td className="py-2 pr-4" style={{ color: D.muted }}>{fmt(d.monthly_payment)}</td>
                      <td className="py-2 pr-4" style={{ color: D.muted }}>{d.annual_rate}%</td>
                      <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{d.end_date ?? '—'}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(d)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.muted }}>編輯</button>
                          <button onClick={() => del(d.id)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.danger }}>刪除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {debts.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-xs" style={{ color: D.muted }}>尚無負債項目</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

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

        {debts.length > 0 && (
          <div className="lg:w-72 shrink-0">
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>還款策略比較</p>
              <div className="mb-3">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>每月額外還款 (NT$)</label>
                <input type="number" value={extra} step={1000}
                  onChange={e => setExtra(Number(e.target.value))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>
              <div className="space-y-3 mt-4">
                {[
                  { name: '雪球法（餘額小→大）', months: sbMonths, desc: '先還最小筆，心理成就感強' },
                  { name: '雪崩法（利率高→低）', months: avMonths, desc: '先還利率最高，總利息最少' },
                ].map(s => (
                  <div key={s.name} className="p-3 rounded-xl" style={{ backgroundColor: D.bg }}>
                    <p className="text-xs font-semibold" style={{ color: D.ink }}>{s.name}</p>
                    <p className="text-base font-bold mt-1" style={{ color: D.accent }}>
                      {s.months >= 600 ? '600+ 個月' : `${s.months} 個月`}
                      <span className="text-xs font-normal ml-1" style={{ color: D.muted }}>
                        （{s.months < 600 ? `約 ${(s.months / 12).toFixed(1)} 年` : '請增加還款額'}）
                      </span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: D.muted }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

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
