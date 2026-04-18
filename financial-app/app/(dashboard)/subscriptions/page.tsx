'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const PRIMARY = '#96B3D1'
const USD_RATE = 32.5  // 預設匯率，可手動調整

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
  const diff = Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
  return diff
}

export default function SubscriptionsPage() {
  const [subs, setSubs]     = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Sub | null>(null)
  const [draft, setDraft]   = useState<Omit<Sub, 'id'>>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [rate, setRate]     = useState(USD_RATE)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('subscriptions').select('*').order('name').then(({ data }) => {
      setSubs((data ?? []) as Sub[])
      setLoading(false)
    })
  }, [])

  const openNew = () => { setEditing(null); setDraft(EMPTY); setShowForm(true) }
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

  const activeSubs = subs.filter(s => s.active)
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate), 0)
  const annualTotal  = monthlyTotal * 12

  const upcoming = subs
    .filter(s => s.active && s.next_charge_date)
    .map(s => ({ ...s, days: daysUntil(s.next_charge_date) }))
    .filter(s => (s.days ?? 99) <= 30)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  if (loading) return <div className="min-h-[40vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200" style={{ borderTopColor: PRIMARY }} />
  </div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">訂閱管理</h1>
        <button onClick={openNew}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: PRIMARY }}>
          + 新增訂閱
        </button>
      </div>

      {/* 摘要 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '每月總費用', value: fmt(monthlyTotal), primary: true  },
          { label: '每年總費用', value: fmt(annualTotal),  primary: false },
          { label: '訂閱數量',  value: `${activeSubs.length} 項`, primary: false },
          { label: '30日內到期', value: `${upcoming.length} 項`, primary: false },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400">{m.label}</p>
            <p className="text-lg font-bold mt-1" style={{ color: m.primary ? PRIMARY : '#374151' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* 匯率設定 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-500">USD / TWD 匯率</span>
        <input type="number" value={rate} step={0.1}
          onChange={e => setRate(Number(e.target.value))}
          className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
      </div>

      {/* 即將到期 */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-3">30 日內即將到期</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                <span>{s.name}</span>
                <span>{s.next_charge_date}</span>
                <span>（{s.days === 0 ? '今天' : `${s.days} 天後`}）</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['名稱', '費用', '週期', '月費(TWD)', '下次扣款', '類別', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-xs text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!s.active ? 'opacity-40' : ''}`}>
                  <td className="py-2 pr-4 font-medium text-gray-700">{s.name}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {s.currency === 'USD' ? `$${s.cost}` : fmt(s.cost)}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{CYCLE_LABELS[s.billing_cycle] ?? s.billing_cycle}</td>
                  <td className="py-2 pr-4 font-semibold" style={{ color: PRIMARY }}>
                    {fmt(toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate))}
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{s.next_charge_date ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{s.category ?? '—'}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={() => toggle(s)} className="text-xs text-gray-400 hover:text-gray-600">
                        {s.active ? '停用' : '啟用'}
                      </button>
                      <button onClick={() => openEdit(s)} className="text-xs text-gray-400 hover:text-gray-600">編輯</button>
                      <button onClick={() => del(s.id)} className="text-xs text-gray-400 hover:text-red-500">刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-300">尚無訂閱項目</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 表單 Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <p className="text-base font-semibold text-gray-900 mb-4">{editing ? '編輯訂閱' : '新增訂閱'}</p>
            {[
              { label: '名稱', key: 'name', type: 'text' },
              { label: '費用', key: 'cost', type: 'number' },
              { label: '類別（選填）', key: 'category', type: 'text' },
              { label: '下次扣款日', key: 'next_charge_date', type: 'date' },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-sm text-gray-600 block mb-1">{f.label}</label>
                <input type={f.type} value={(draft as any)[f.key] ?? ''}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                  style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">幣別</label>
                <select value={draft.currency} onChange={e => setDraft(p => ({ ...p, currency: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="TWD">TWD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">週期</label>
                <select value={draft.billing_cycle} onChange={e => setDraft(p => ({ ...p, billing_cycle: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {Object.entries(CYCLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100">
                取消
              </button>
              <button onClick={save}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: PRIMARY }}>
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
