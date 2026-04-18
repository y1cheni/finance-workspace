'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'

const USD_RATE = 32.5

interface Sub {
  id: string
  name: string
  cost: number
  currency: string
  billing_cycle: string
  next_charge_date: string | null
  category: string | null
  active: boolean
}

const EMPTY: Omit<Sub, 'id'> = {
  name: '', cost: 0, currency: 'TWD', billing_cycle: 'monthly',
  next_charge_date: null, category: null, active: true,
}

const CYCLES: Record<string, number> = { daily: 365, weekly: 52, monthly: 12, yearly: 1 }
const CYCLE_LABELS: Record<string, string> = { daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' }

function toMonthlyTWD(cost: number, currency: string, cycle: string, rate: number) {
  const annual = currency === 'USD' ? cost * rate : cost
  return (annual * (CYCLES[cycle] ?? 12)) / 12
}

function fmt(n: number) {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function SubscriptionsPage() {
  const [subs, setSubs]         = useState<Sub[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<Sub | null>(null)
  const [draft, setDraft]       = useState<Omit<Sub, 'id'>>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [rate, setRate]         = useState(USD_RATE)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('subscriptions').select('*').order('name').then(({ data }) => {
      setSubs((data ?? []) as Sub[])
      setLoading(false)
    })
  }, [])

  const openNew  = () => { setEditing(null); setDraft(EMPTY); setShowForm(true) }
  const openEdit = (s: Sub) => { setEditing(s); setDraft({ ...s }); setShowForm(true) }

  const save = async () => {
    if (!draft.name || draft.cost <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      await supabase.from('subscriptions').update(draft).eq('id', editing.id)
      setSubs(prev => prev.map(s => s.id === editing.id ? { ...editing, ...draft } : s))
    } else {
      const { data } = await supabase.from('subscriptions').insert({ ...draft, user_id: user.id }).select().single()
      if (data) setSubs(prev => [...prev, data as Sub])
    }
    setShowForm(false)
  }

  const del = async (id: string) => {
    await supabase.from('subscriptions').delete().eq('id', id)
    setSubs(prev => prev.filter(s => s.id !== id))
  }

  const toggle = async (s: Sub) => {
    await supabase.from('subscriptions').update({ active: !s.active }).eq('id', s.id)
    setSubs(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x))
  }

  const activeSubs   = subs.filter(s => s.active)
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate), 0)
  const annualTotal  = monthlyTotal * 12

  const upcoming = subs
    .filter(s => s.active && s.next_charge_date)
    .map(s => ({ ...s, days: daysUntil(s.next_charge_date) }))
    .filter(s => (s.days ?? 99) <= 30)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: D.accent }} />
    </div>
  )

  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>訂閱管理</h1>
        <button onClick={openNew}
          className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.ink, color: D.bg }}>
          + 新增訂閱
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '每月總費用',  value: fmt(monthlyTotal),          accent: true  },
          { label: '每年總費用',  value: fmt(annualTotal),            accent: false },
          { label: '訂閱數量',   value: `${activeSubs.length} 項`,   accent: false },
          { label: '30日內到期', value: `${upcoming.length} 項`,     accent: false },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.accent ? D.accent : D.ink }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ backgroundColor: D.surface }}>
        <span className="text-xs" style={{ color: D.muted }}>USD / TWD 匯率</span>
        <input type="number" value={rate} step={0.1}
          onChange={e => setRate(Number(e.target.value))}
          className="w-24 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
          style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
      </div>

      {upcoming.length > 0 && (
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: D.surface }}>
          <p className="text-xs mb-3" style={{ color: D.muted }}>30 日內即將到期</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ backgroundColor: D.bg, color: D.accent, border: `1px solid var(--subtle)` }}>
                <span>{s.name}</span>
                <span>{s.next_charge_date}</span>
                <span>（{s.days === 0 ? '今天' : `${s.days} 天後`}）</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                {['名稱', '費用', '週期', '月費(TWD)', '下次扣款', '類別', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-xs font-medium" style={{ color: D.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid var(--subtle)`, opacity: s.active ? 1 : 0.4 }}>
                  <td className="py-2 pr-4 font-medium" style={{ color: D.ink }}>{s.name}</td>
                  <td className="py-2 pr-4" style={{ color: D.muted }}>
                    {s.currency === 'USD' ? `$${s.cost}` : fmt(s.cost)}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{CYCLE_LABELS[s.billing_cycle] ?? s.billing_cycle}</td>
                  <td className="py-2 pr-4 font-semibold" style={{ color: D.accent }}>
                    {fmt(toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate))}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{s.next_charge_date ?? '—'}</td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{s.category ?? '—'}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={() => toggle(s)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.muted }}>
                        {s.active ? '停用' : '啟用'}
                      </button>
                      <button onClick={() => openEdit(s)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.muted }}>編輯</button>
                      <button onClick={() => del(s.id)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.danger }}>刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-xs" style={{ color: D.muted }}>尚無訂閱項目</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ backgroundColor: D.surface }}>
            <p className="text-sm font-semibold mb-4" style={{ color: D.ink }}>{editing ? '編輯訂閱' : '新增訂閱'}</p>
            {[
              { label: '名稱', key: 'name', type: 'text' },
              { label: '費用', key: 'cost', type: 'number' },
              { label: '類別（選填）', key: 'category', type: 'text' },
              { label: '下次扣款日', key: 'next_charge_date', type: 'date' },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>{f.label}</label>
                <input type={f.type} value={(draft as any)[f.key] ?? ''}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: D.muted }}>幣別</label>
                <select value={draft.currency} onChange={e => setDraft(p => ({ ...p, currency: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                  <option value="TWD">TWD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: D.muted }}>週期</label>
                <select value={draft.billing_cycle} onChange={e => setDraft(p => ({ ...p, billing_cycle: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                  {Object.entries(CYCLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.bg, color: D.muted }}>
                取消
              </button>
              <button onClick={save}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.ink, color: D.bg }}>
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
