'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'
import { writeStore } from '@/lib/shared-store'
import CsvImportModal from '@/components/CsvImportModal'

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
  // Extended fields (requires DB migration — see bottom of file)
  subscription_type?: 'subscription' | 'one_time'
  last_payment_date?: string | null
  is_free_trial?: boolean
  end_date?: string | null
  payment_method?: 'cash' | 'credit_card' | 'other' | null
  plan_type?: 'personal' | 'family' | null
  notify?: boolean
  notify_days_before?: number
  notes?: string | null
  link?: string | null
}

const EMPTY: Omit<Sub, 'id'> = {
  name: '', cost: 0, currency: 'TWD', billing_cycle: 'monthly',
  next_charge_date: null, category: null, active: true,
  subscription_type: 'subscription',
  last_payment_date: null,
  is_free_trial: false,
  end_date: null,
  payment_method: 'credit_card',
  plan_type: 'personal',
  notify: true,
  notify_days_before: 1,
  notes: null,
  link: null,
}

const CYCLES: Record<string, number> = { daily: 365, weekly: 52, monthly: 12, yearly: 1 }
const CYCLE_LABELS: Record<string, string> = { daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' }
const PAYMENT_LABELS: Record<string, string> = { cash: '現金', credit_card: '信用卡', other: '其他' }

const CAT_COLORS: Record<string, string> = {
  AI:           '#1c1c1e',
  Cloud:        '#4f9cf9',
  Necessary:    '#64748b',
  Productivity: '#8b5cf6',
  Media:        '#f59e0b',
  Learning:     '#10b981',
  Trade:        '#ef4444',
  APP:          '#6366f1',
}
const EXTRA_COLORS = ['#94a3b8', '#f97316', '#14b8a6', '#ec4899', '#a3e635']

function catColor(cat: string, idx: number) {
  return CAT_COLORS[cat] ?? EXTRA_COLORS[idx % EXTRA_COLORS.length]
}

function toMonthlyTWD(cost: number, currency: string, cycle: string, rate: number) {
  const inTWD = currency === 'USD' ? cost * rate : cost
  return (inTWD * (CYCLES[cycle] ?? 12)) / 12
}

function fmt(n: number) { return `NT$ ${Math.round(n).toLocaleString('zh-TW')}` }

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function parseMflowDate(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null
  const v = raw.trim()
  if (/^\d{1,2}$/.test(v)) {
    const day = parseInt(v)
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth(), day)
    if (d <= now) d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (/^\d{4}-\d{2}/.test(v)) return v.slice(0, 10)
  return null
}

function calcNextDate(lastDate: string, cycle: string): string {
  const d = new Date(lastDate)
  const now = new Date()
  const advance = () => {
    if (cycle === 'weekly')  d.setDate(d.getDate() + 7)
    else if (cycle === 'monthly') d.setMonth(d.getMonth() + 1)
    else if (cycle === 'yearly')  d.setFullYear(d.getFullYear() + 1)
    else if (cycle === 'daily')   d.setDate(d.getDate() + 1)
  }
  advance()
  while (d <= now) advance()
  return d.toISOString().slice(0, 10)
}

function fmtDateTW(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ── Shared UI components ──────────────────────────────────────────────────────

type SegOpt<T extends string> = { value: T; label: string }

function Segmented<T extends string>({
  options, value, onChange,
}: { options: SegOpt<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: D.bg }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
          style={{
            backgroundColor: value === opt.value ? 'var(--surface)' : 'transparent',
            color: value === opt.value ? D.ink : D.muted,
            boxShadow: value === opt.value ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ value, onChange, color = 'var(--accent)' }: {
  value: boolean; onChange: (v: boolean) => void; color?: string
}) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
      style={{ backgroundColor: value ? color : 'var(--subtle)' }}>
      <span className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: value ? 'translateX(22px)' : 'translateX(3px)' }} />
    </button>
  )
}

function RowToggle({ label, value, onChange, color, highlight }: {
  label: string; value: boolean; onChange: (v: boolean) => void
  color?: string; highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200"
      style={{
        border: `1px solid ${highlight && value ? '#f97316' : 'var(--subtle)'}`,
        backgroundColor: highlight && value ? 'rgba(249,115,22,0.06)' : 'transparent',
      }}>
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: D.ink }}>{label}</span>
      </div>
      <Toggle value={value} onChange={onChange} color={color} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [subs, setSubs]             = useState<Sub[]>([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState<Sub | null>(null)
  const [draft, setDraft]           = useState<Omit<Sub, 'id'>>(EMPTY)
  const [showForm, setShowForm]     = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showEndDate, setShowEndDate] = useState(false)
  const [rate, setRate]             = useState(USD_RATE)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('subscriptions').select('*').order('name').then(({ data }) => {
      setSubs((data ?? []) as Sub[])
      setLoading(false)
    })
  }, [])

  const set = <K extends keyof Omit<Sub, 'id'>>(key: K, val: Omit<Sub, 'id'>[K]) =>
    setDraft(p => ({ ...p, [key]: val }))

  const openNew = () => {
    setEditing(null); setDraft(EMPTY); setShowEndDate(false); setShowForm(true)
  }
  const openEdit = (s: Sub) => {
    setEditing(s); setDraft({ ...s })
    setShowEndDate(!!s.end_date); setShowForm(true)
  }

  // Auto-calculate next charge date from last_payment_date + cycle
  const nextChargePreview = useMemo(() => {
    if (!draft.last_payment_date || draft.subscription_type === 'one_time') return null
    try { return calcNextDate(draft.last_payment_date, draft.billing_cycle) } catch { return null }
  }, [draft.last_payment_date, draft.billing_cycle, draft.subscription_type])

  const save = async () => {
    if (!draft.name || draft.cost <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload: Omit<Sub, 'id'> = {
      ...draft,
      next_charge_date: nextChargePreview ?? draft.next_charge_date,
      end_date: showEndDate ? (draft.end_date ?? null) : null,
    }

    if (editing) {
      await supabase.from('subscriptions').update(payload).eq('id', editing.id)
      setSubs(prev => prev.map(s => s.id === editing.id ? { ...editing, ...payload } : s))
    } else {
      const { data } = await supabase.from('subscriptions')
        .insert({ ...payload, user_id: user.id }).select().single()
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
  const monthlyTotal = activeSubs
    .filter(s => s.subscription_type !== 'one_time')
    .reduce((sum, s) => sum + toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate), 0)
  const annualTotal  = monthlyTotal * 12

  useEffect(() => { writeStore({ monthlySubscriptionTotal: monthlyTotal }) }, [monthlyTotal])

  const upcoming = subs
    .filter(s => s.active && s.next_charge_date && s.subscription_type !== 'one_time')
    .map(s => ({ ...s, days: daysUntil(s.next_charge_date) }))
    .filter(s => (s.days ?? 99) <= 30)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  const catData = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const s of activeSubs.filter(x => x.subscription_type !== 'one_time')) {
      const cat = s.category ?? '其他'
      acc[cat] = (acc[cat] ?? 0) + toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate)
    }
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  }, [activeSubs, rate])

  const topServiceData = useMemo(() =>
    [...activeSubs.filter(x => x.subscription_type !== 'one_time')]
      .map(s => ({ name: s.name, 月費: Math.round(toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate)) }))
      .sort((a, b) => b.月費 - a.月費)
      .slice(0, 8)
  , [activeSubs, rate])

  const tooltipStyle = { backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: D.accent }} />
    </div>
  )

  return (
    <div style={{ fontFamily: D.font }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>訂閱管理</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.surface, color: D.muted, border: `1px solid var(--subtle)` }}>
            ↑ 匯入 CSV
          </button>
          <button onClick={openNew}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.ink, color: D.bg }}>
            + 新增訂閱
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: '每月總費用',  value: fmt(monthlyTotal), accent: true  },
          { label: '每年總費用',  value: fmt(annualTotal),  accent: false },
          { label: '訂閱數量',   value: `${activeSubs.length} 項`, accent: false },
          { label: '30日內到期', value: `${upcoming.length} 項`,   accent: false },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.accent ? D.accent : D.ink }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* USD rate */}
      <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ backgroundColor: D.surface }}>
        <span className="text-xs" style={{ color: D.muted }}>USD / TWD 匯率</span>
        <input type="number" value={rate} step={0.1}
          onChange={e => setRate(Number(e.target.value))}
          className="w-24 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
          style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
      </div>

      {/* Charts */}
      {activeSubs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>月費類別分佈（啟用中）</p>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={catData} cx="40%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={2}>
                  {catData.map((entry, i) => <Cell key={i} fill={catColor(entry.name, i)} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={tooltipStyle} />
                <Legend layout="vertical" align="right" verticalAlign="middle"
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value, entry: any) => `${value} ${fmt(entry.payload.value)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>月費排行（啟用中，前 8）</p>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={topServiceData} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${v}`}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={72}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={tooltipStyle} />
                <Bar dataKey="月費" fill="var(--accent)" fillOpacity={0.85} radius={[0, 3, 3, 0]}
                  label={{ position: 'right', fontSize: 10, fill: 'var(--muted)',
                    formatter: (v: any) => v > 0 ? `${v}` : '' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: D.surface }}>
          <p className="text-xs mb-3" style={{ color: D.muted }}>30 日內即將扣款</p>
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

      {/* Table */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                {['名稱', '費用', '週期', '月費(TWD)', '下次扣款', '類別', '付款', ''].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-xs font-medium" style={{ color: D.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid var(--subtle)`, opacity: s.active ? 1 : 0.4 }}>
                  <td className="py-2 pr-4 font-medium" style={{ color: D.ink }}>
                    <div className="flex items-center gap-1.5">
                      {s.is_free_trial && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316' }}>試用</span>}
                      {s.subscription_type === 'one_time' && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>買斷</span>}
                      {s.name}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>
                    {s.currency === 'USD' ? `$${s.cost}` : fmt(s.cost)}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>
                    {s.subscription_type === 'one_time' ? '—' : (CYCLE_LABELS[s.billing_cycle] ?? s.billing_cycle)}
                  </td>
                  <td className="py-2 pr-4 font-semibold" style={{ color: s.subscription_type === 'one_time' ? D.muted : D.accent }}>
                    {s.subscription_type === 'one_time' ? '—' : fmt(toMonthlyTWD(s.cost, s.currency, s.billing_cycle, rate))}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>
                    {s.subscription_type === 'one_time' ? '—' : (s.next_charge_date ?? '—')}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{s.category ?? '—'}</td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>
                    {PAYMENT_LABELS[s.payment_method ?? ''] ?? '—'}
                  </td>
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
                <tr><td colSpan={8} className="py-8 text-center text-xs" style={{ color: D.muted }}>尚無訂閱項目</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Import */}
      {showImport && (
        <CsvImportModal
          title="匯入訂閱資料（支援 M-flow 格式）"
          skipRows={1}
          templateCsv={[
            'service,category,state,price_twd_monthly,billing_cycle,next_charge_date',
            'Claude,AI,Active,628.94,monthly,',
            'apple icloud,Cloud,Active,90.00,monthly,',
            'heptabase,Productivity,Active,282.71,yearly,2026-01-02',
            'netflix,Media,Cancelled,330.00,monthly,',
          ].join('\n')}
          templateFilename="訂閱範本_mflow.csv"
          fields={[
            { key: 'name',             label: '名稱',    required: true, type: 'text' },
            { key: 'category',         label: '類別',    type: 'text' },
            { key: 'state',            label: '狀態',    type: 'text', hint: 'Active / Cancelled' },
            { key: 'cost',             label: '月費TWD', required: true, type: 'number',
              hint: 'price_twd_monthly（已換算月費）' },
            { key: 'billing_cycle',    label: '週期',    type: 'text', defaultValue: 'monthly',
              hint: 'monthly / yearly' },
            { key: 'next_charge_date', label: '下次扣款', type: 'text',
              hint: '日期或日期數字（如 05）' },
          ]}
          validate={(rec) => {
            const state = (rec.state as string || '').trim()
            if (!state) return '無狀態資料，跳過（觀察清單）'
            const cost = rec.cost as number | null
            if (!cost || cost <= 0) return '無月費資料，跳過'
            return null
          }}
          onConfirm={async (records) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const STATE_MAP: Record<string, boolean> = { active: true, cancelled: false }
            const rows = records.map(r => ({
              name:             r.name as string,
              cost:             r.cost as number,
              currency:         'TWD',
              billing_cycle:    (r.billing_cycle as string) || 'monthly',
              next_charge_date: parseMflowDate(r.next_charge_date as string | null),
              category:         (r.category as string) || null,
              active:           STATE_MAP[(r.state as string || '').toLowerCase()] ?? true,
              user_id:          user.id,
            }))
            const { data } = await supabase.from('subscriptions').insert(rows).select()
            if (data) setSubs(prev => [...prev, ...(data as Sub[])])
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* ── Add / Edit form (bottom-sheet) ──────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl"
            style={{ backgroundColor: D.surface }}>

            {/* Sheet handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--subtle)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: `1px solid var(--subtle)` }}>
              <p className="text-sm font-semibold" style={{ color: D.ink }}>
                {editing ? '編輯訂閱' : '新增訂閱項目'}
              </p>
              <button onClick={() => setShowForm(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-sm transition-opacity hover:opacity-60"
                style={{ backgroundColor: D.bg, color: D.muted }}>×</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Subscription type */}
              <Segmented<'subscription' | 'one_time'>
                options={[{ value: 'subscription', label: '訂閱項目' }, { value: 'one_time', label: '買斷' }]}
                value={draft.subscription_type ?? 'subscription'}
                onChange={v => set('subscription_type', v)}
              />

              {/* Name */}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: D.muted }}>
                  訂閱項目名稱 <span style={{ color: D.danger }}>*</span>
                </label>
                <input type="text" value={draft.name} placeholder="例：Spotify"
                  onChange={e => set('name', e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>

              {/* Cost + Currency */}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: D.muted }}>
                  價格 <span style={{ color: D.danger }}>*</span>
                </label>
                <div className="flex gap-2">
                  <input type="number" value={draft.cost} step={0.01} min={0}
                    onChange={e => set('cost', Number(e.target.value))}
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                  <select value={draft.currency} onChange={e => set('currency', e.target.value)}
                    className="rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                    <option value="TWD">TWD</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: D.muted }}>分類</label>
                <select value={draft.category ?? ''}
                  onChange={e => set('category', e.target.value || null)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                  <option value="">選擇類別</option>
                  {Object.keys(CAT_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="其他">其他</option>
                </select>
              </div>

              {/* Billing cycle — only for subscription */}
              {draft.subscription_type !== 'one_time' && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: D.muted }}>
                    週期 <span style={{ color: D.danger }}>*</span>
                  </label>
                  <Segmented<'weekly' | 'monthly' | 'yearly'>
                    options={[
                      { value: 'weekly',  label: '每週' },
                      { value: 'monthly', label: '每月' },
                      { value: 'yearly',  label: '每年' },
                    ]}
                    value={(draft.billing_cycle as 'weekly' | 'monthly' | 'yearly') || 'monthly'}
                    onChange={v => set('billing_cycle', v)}
                  />
                </div>
              )}

              {/* Last payment / start date */}
              {draft.subscription_type !== 'one_time' && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: D.muted }}>
                    上次付款日期/起始日期 <span style={{ color: D.danger }}>*</span>
                  </label>
                  <input type="date" value={draft.last_payment_date ?? ''}
                    onChange={e => set('last_payment_date', e.target.value || null)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                  {nextChargePreview && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: D.muted }}>
                      <span>續訂日期為&nbsp;
                        <span style={{ color: D.accent }}>{fmtDateTW(nextChargePreview)}</span>
                      </span>
                      <span>每月平均為&nbsp;
                        <span style={{ color: D.accent }}>
                          (TWD) {fmt(toMonthlyTWD(draft.cost, draft.currency, draft.billing_cycle, rate))}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* End date toggle */}
              {draft.subscription_type !== 'one_time' && (
                <>
                  <RowToggle label="使用結束日期" value={showEndDate} onChange={setShowEndDate} />
                  {showEndDate && (
                    <input type="date" value={draft.end_date ?? ''}
                      onChange={e => set('end_date', e.target.value || null)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                  )}
                </>
              )}

              {/* Free trial */}
              <RowToggle label="免費試用"
                value={draft.is_free_trial ?? false}
                onChange={v => set('is_free_trial', v)}
                color="#f97316" highlight />

              {/* Payment method */}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: D.muted }}>付款方式</label>
                <Segmented<'cash' | 'credit_card' | 'other'>
                  options={[
                    { value: 'cash',        label: '現金' },
                    { value: 'credit_card', label: '信用卡' },
                    { value: 'other',       label: '其他' },
                  ]}
                  value={(draft.payment_method ?? 'credit_card') as 'cash' | 'credit_card' | 'other'}
                  onChange={v => set('payment_method', v)}
                />
              </div>

              {/* Plan type */}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: D.muted }}>方案</label>
                <Segmented<'personal' | 'family'>
                  options={[
                    { value: 'personal', label: '個人' },
                    { value: 'family',   label: '家庭' },
                  ]}
                  value={(draft.plan_type ?? 'personal') as 'personal' | 'family'}
                  onChange={v => set('plan_type', v)}
                />
              </div>

              {/* Notify */}
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid var(--subtle)` }}>
                <div className="flex items-center justify-between px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: D.ink }}>通知</span>
                  </div>
                  <Toggle value={draft.notify ?? true} onChange={v => set('notify', v)} color="#4f9cf9" />
                </div>
                {(draft.notify ?? true) && (
                  <div className="flex items-center justify-between px-3 py-2.5"
                    style={{ borderTop: `1px solid var(--subtle)`, backgroundColor: D.bg }}>
                    <span className="text-xs" style={{ color: D.muted }}>提醒我</span>
                    <select value={draft.notify_days_before ?? 1}
                      onChange={e => set('notify_days_before', Number(e.target.value))}
                      className="rounded-lg px-2 py-1 text-xs focus:outline-none"
                      style={{ backgroundColor: D.surface, color: D.ink, border: `1px solid var(--subtle)` }}>
                      <option value={0}>當天</option>
                      <option value={1}>一天前</option>
                      <option value={3}>三天前</option>
                      <option value={7}>一週前</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Link */}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: D.muted }}>連結</label>
                <input type="url" value={draft.link ?? ''} placeholder="https://"
                  onChange={e => set('link', e.target.value || null)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: D.muted }}>備註</label>
                <textarea value={draft.notes ?? ''} rows={2}
                  onChange={e => set('notes', e.target.value || null)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1 pb-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ backgroundColor: D.bg, color: D.muted }}>
                  取消
                </button>
                <button onClick={save}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ backgroundColor: '#4f6ef7', color: '#fff' }}>
                  {editing ? '儲存' : '新增'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/*
  Required Supabase migration to enable extended fields:

  ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS subscription_type  text    DEFAULT 'subscription',
    ADD COLUMN IF NOT EXISTS last_payment_date  date,
    ADD COLUMN IF NOT EXISTS is_free_trial      boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS end_date           date,
    ADD COLUMN IF NOT EXISTS payment_method     text,
    ADD COLUMN IF NOT EXISTS plan_type          text    DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS notify             boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_days_before integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS notes              text,
    ADD COLUMN IF NOT EXISTS link               text;
*/
