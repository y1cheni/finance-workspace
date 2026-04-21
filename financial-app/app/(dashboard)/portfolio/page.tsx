'use client'
import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'
import { writeStore } from '@/lib/shared-store'
import FormulaPanel from '@/components/FormulaPanel'

// ── SQL to create table (shown when table is missing) ───────────────────────
const SETUP_SQL = `create table holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  ticker text,
  type text not null default '股票',
  quantity numeric not null default 0,
  cost_price numeric not null default 0,
  current_price numeric not null default 0,
  currency text not null default 'TWD',
  note text,
  created_at timestamptz default now()
);
alter table holdings enable row level security;
create policy "Users manage own holdings"
  on holdings for all using (auth.uid() = user_id);`

// ── Types ────────────────────────────────────────────────────────────────────
interface Holding {
  id: string
  name: string
  ticker: string | null
  type: string
  quantity: number
  cost_price: number
  current_price: number
  currency: string
  note: string | null
}

const EMPTY: Omit<Holding, 'id'> = {
  name: '', ticker: null, type: '股票',
  quantity: 0, cost_price: 0, current_price: 0, currency: 'TWD', note: null,
}

const TYPES = ['股票', 'ETF', '加密貨幣', '基金', '其他']
const TYPE_COLORS: Record<string, string> = {
  '股票':   'var(--ink)',
  'ETF':    'var(--accent)',
  '加密貨幣': '#f59e0b',
  '基金':   'var(--muted)',
  '其他':   'var(--subtle)',
}

const FORMULAS = [
  {
    name: '持倉市值',
    formula: '市值 = 數量 × 現價 × 匯率',
    vars: [
      { sym: '數量',  desc: '持有股數 / 單位數 / 顆' },
      { sym: '現價',  desc: '每股最新報價（原始幣別）' },
      { sym: '匯率',  desc: 'USD→TWD 或 HKD→TWD，TWD=1' },
    ],
  },
  {
    name: '未實現損益',
    formula: '未實現損益 = 市值 − 成本  =  數量 × (現價 − 成本價) × 匯率',
  },
  {
    name: '報酬率',
    formula: '報酬率 = 未實現損益 / 總成本 × 100%',
  },
]

function fmt(n: number) { return `NT$ ${Math.round(n).toLocaleString('zh-TW')}` }
function sign(n: number) { return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%` }

// ── Component ────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [holdings,   setHoldings]   = useState<Holding[]>([])
  const [loading,    setLoading]    = useState(true)
  const [noTable,    setNoTable]    = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<Holding | null>(null)
  const [draft,      setDraft]      = useState<Omit<Holding, 'id'>>(EMPTY)
  const [usdRate,    setUsdRate]    = useState(32.5)
  const [hkdRate,    setHkdRate]    = useState(4.2)
  const [activeType, setActiveType] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('holdings').select('*').order('type').then(({ data, error }) => {
      if (error?.code === '42P01') { setNoTable(true); setLoading(false); return }
      setHoldings((data ?? []) as Holding[])
      setLoading(false)
    })
  }, [])

  // ── FX ────────────────────────────────────────────────────────────────────
  function fx(currency: string) {
    if (currency === 'USD') return usdRate
    if (currency === 'HKD') return hkdRate
    return 1
  }
  const val  = (h: Holding) => h.quantity * h.current_price * fx(h.currency)
  const cost = (h: Holding) => h.quantity * h.cost_price  * fx(h.currency)
  const pnl  = (h: Holding) => val(h) - cost(h)
  const pct  = (h: Holding) => cost(h) > 0 ? (pnl(h) / cost(h)) * 100 : 0

  // ── Aggregates ────────────────────────────────────────────────────────────
  const displayed    = activeType ? holdings.filter(h => h.type === activeType) : holdings
  const totalVal     = holdings.reduce((s, h) => s + val(h), 0)
  const totalCost    = holdings.reduce((s, h) => s + cost(h), 0)
  const totalPnL     = totalVal - totalCost
  const totalPct     = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  // Sync to shared store so statements page can read it
  useEffect(() => {
    writeStore({ portfolioTotal: totalVal })
  }, [totalVal])

  // ── Chart data ────────────────────────────────────────────────────────────
  const pieData = TYPES
    .map(t => ({
      name: t,
      value: Math.round(holdings.filter(h => h.type === t).reduce((s, h) => s + val(h), 0)),
    }))
    .filter(d => d.value > 0)

  const barData = [...displayed]
    .sort((a, b) => pnl(b) - pnl(a))
    .map(h => ({ name: h.name, 損益: Math.round(pnl(h)), 市值: Math.round(val(h)) }))

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const openNew  = () => { setEditing(null); setDraft(EMPTY); setShowForm(true) }
  const openEdit = (h: Holding) => { setEditing(h); setDraft({ ...h }); setShowForm(true) }

  const save = async () => {
    if (!draft.name || draft.quantity <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      await supabase.from('holdings').update(draft).eq('id', editing.id)
      setHoldings(prev => prev.map(h => h.id === editing.id ? { ...editing, ...draft } : h))
    } else {
      const { data } = await supabase.from('holdings')
        .insert({ ...draft, user_id: user.id }).select().single()
      if (data) setHoldings(prev => [...prev, data as Holding])
    }
    setShowForm(false)
  }

  const del = async (id: string) => {
    await supabase.from('holdings').delete().eq('id', id)
    setHoldings(prev => prev.filter(h => h.id !== id))
  }

  // ── Loading / no-table states ─────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: D.accent }} />
    </div>
  )

  if (noTable) return (
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: D.ink }}>投資組合</h1>
      <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: D.surface }}>
        <p className="text-sm font-semibold" style={{ color: D.ink }}>需要先建立資料表</p>
        <p className="text-xs" style={{ color: D.muted }}>
          請前往 Supabase Dashboard → SQL Editor，貼上以下指令執行，完成後重新整理此頁面。
        </p>
        <pre className="text-xs p-4 rounded-xl overflow-x-auto leading-relaxed"
          style={{ backgroundColor: D.bg, color: D.accent }}>
          {SETUP_SQL}
        </pre>
      </div>
    </div>
  )

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: D.font }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>投資組合</h1>
        <button onClick={openNew}
          className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.ink, color: D.bg }}>
          + 新增持倉
        </button>
      </div>

      {/* FX rates */}
      <div className="rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-6"
        style={{ backgroundColor: D.surface }}>
        <span className="text-xs" style={{ color: D.muted }}>即時匯率</span>
        {[
          { label: 'USD / TWD', val: usdRate, set: setUsdRate },
          { label: 'HKD / TWD', val: hkdRate, set: setHkdRate },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-2">
            <label className="text-xs" style={{ color: D.muted }}>{r.label}</label>
            <input type="number" value={r.val} step={0.1}
              onChange={e => r.set(Number(e.target.value))}
              className="w-20 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
              style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
          </div>
        ))}
        <p className="text-xs ml-auto" style={{ color: D.muted }}>
          所有金額換算為 TWD 顯示
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '總市值',   value: fmt(totalVal),                   color: D.accent },
          { label: '總成本',   value: fmt(totalCost),                  color: D.ink    },
          { label: '未實現損益', value: fmt(totalPnL),                  color: totalPnL >= 0 ? D.accent : D.danger },
          { label: '整體報酬率', value: sign(totalPct),                 color: totalPct >= 0 ? D.accent : D.danger },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Left: charts ── */}
        <div className="lg:w-64 shrink-0 space-y-4">

          {/* Type filter pills */}
          {pieData.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveType(null)}
                className="text-xs px-2 py-1 rounded-xl transition-opacity hover:opacity-70"
                style={{
                  backgroundColor: activeType === null ? D.ink : D.bg,
                  color: activeType === null ? D.bg : D.muted,
                }}>全部</button>
              {pieData.map(d => (
                <button key={d.name}
                  onClick={() => setActiveType(activeType === d.name ? null : d.name)}
                  className="text-xs px-2 py-1 rounded-xl transition-opacity hover:opacity-70"
                  style={{
                    backgroundColor: activeType === d.name ? D.ink : D.bg,
                    color: activeType === d.name ? D.bg : D.muted,
                  }}>{d.name}</button>
              ))}
            </div>
          )}

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-3" style={{ color: D.muted }}>持倉分布</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" paddingAngle={2}
                    onClick={d => setActiveType(activeType === (d.name ?? null) ? null : (d.name ?? null))}>
                    {pieData.map((d, i) => (
                      <Cell key={i}
                        fill={TYPE_COLORS[d.name] ?? 'var(--subtle)'}
                        fillOpacity={activeType === null || activeType === d.name ? 0.9 : 0.3} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {pieData.map(d => {
                  const pct = totalVal > 0 ? (d.value / totalVal) * 100 : 0
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-xs cursor-pointer"
                      onClick={() => setActiveType(activeType === d.name ? null : d.name)}>
                      <div className="w-2 h-2 rounded-sm shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[d.name] ?? 'var(--subtle)' }} />
                      <span className="flex-1" style={{ color: D.muted }}>{d.name}</span>
                      <span style={{ color: D.ink }}>{pct.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* P&L bar chart */}
          {barData.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-3" style={{ color: D.muted }}>
                各持倉損益{activeType ? ` — ${activeType}` : ''}
              </p>
              <ResponsiveContainer width="100%" height={Math.max(100, barData.length * 30)}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                  <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={54}
                    tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="損益" radius={[0, 3, 3, 0]}>
                    {barData.map((d, i) => (
                      <Cell key={i}
                        fill={d.損益 >= 0 ? 'var(--accent)' : '#ef4444'}
                        fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Right: table ── */}
        <div className="flex-1 space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                    {['名稱 / 代號', '類型', '數量', '成本價', '現價', '市值 (TWD)', '損益', '報酬率', ''].map(h => (
                      <th key={h} className="text-left py-2 pr-3 font-medium whitespace-nowrap"
                        style={{ color: D.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(h => {
                    const v = val(h), c = cost(h), p = pnl(h), r = pct(h)
                    return (
                      <tr key={h.id} style={{ borderBottom: `1px solid var(--subtle)` }}>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium" style={{ color: D.ink }}>{h.name}</p>
                          {h.ticker && <p style={{ color: D.muted }}>{h.ticker}</p>}
                          {h.note && <p style={{ color: D.muted, fontSize: 10 }}>{h.note}</p>}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: D.bg, color: D.muted }}>{h.type}</span>
                        </td>
                        <td className="py-2.5 pr-3" style={{ color: D.muted }}>
                          {h.quantity.toLocaleString()}
                          {h.currency !== 'TWD' && (
                            <span className="ml-1" style={{ fontSize: 10 }}>{h.currency}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3" style={{ color: D.muted }}>
                          {h.currency !== 'TWD'
                            ? `${h.currency} ${h.cost_price.toLocaleString()}`
                            : fmt(h.cost_price)}
                        </td>
                        <td className="py-2.5 pr-3 font-medium" style={{ color: D.ink }}>
                          {h.currency !== 'TWD'
                            ? `${h.currency} ${h.current_price.toLocaleString()}`
                            : fmt(h.current_price)}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold" style={{ color: D.accent }}>
                          {fmt(v)}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold"
                          style={{ color: p >= 0 ? D.accent : D.danger }}>
                          {p >= 0 ? '+' : ''}{fmt(p)}
                        </td>
                        <td className="py-2.5 pr-3"
                          style={{ color: r >= 0 ? D.accent : D.danger }}>
                          {sign(r)}
                        </td>
                        <td className="py-2.5">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(h)}
                              className="transition-opacity hover:opacity-50" style={{ color: D.muted }}>編輯</button>
                            <button onClick={() => del(h.id)}
                              className="transition-opacity hover:opacity-50" style={{ color: D.danger }}>刪除</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {displayed.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center" style={{ color: D.muted }}>
                        {holdings.length === 0
                          ? '尚無持倉，點擊「+ 新增持倉」開始追蹤'
                          : `${activeType} 類型無持倉`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Per-type subtotals */}
            {holdings.length > 0 && (
              <div className="mt-4 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
                style={{ borderTop: `1px solid var(--subtle)` }}>
                {pieData.map(d => {
                  const typeHoldings = holdings.filter(h => h.type === d.name)
                  const typePnL = typeHoldings.reduce((s, h) => s + pnl(h), 0)
                  return (
                    <div key={d.name} className="text-xs">
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-sm"
                          style={{ backgroundColor: TYPE_COLORS[d.name] ?? 'var(--subtle)' }} />
                        <span style={{ color: D.muted }}>{d.name}</span>
                      </div>
                      <p className="font-semibold" style={{ color: D.ink }}>{fmt(d.value)}</p>
                      <p style={{ color: typePnL >= 0 ? D.accent : D.danger }}>
                        {typePnL >= 0 ? '+' : ''}{fmt(typePnL)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <FormulaPanel formulas={FORMULAS} />
        </div>
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ backgroundColor: D.surface }}>
            <p className="text-sm font-semibold mb-4" style={{ color: D.ink }}>
              {editing ? '編輯持倉' : '新增持倉'}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: D.muted }}>名稱 *</label>
                  <input type="text" value={draft.name} placeholder="e.g. 台積電"
                    onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: D.muted }}>代號（選填）</label>
                  <input type="text" value={draft.ticker ?? ''} placeholder="e.g. 2330.TW"
                    onChange={e => setDraft(p => ({ ...p, ticker: e.target.value || null }))}
                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1" style={{ color: D.muted }}>類型</label>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map(t => (
                    <button key={t} onClick={() => setDraft(p => ({ ...p, type: t }))}
                      className="px-3 py-1 rounded-xl text-xs transition-opacity hover:opacity-70"
                      style={{
                        backgroundColor: draft.type === t ? D.ink : D.bg,
                        color: draft.type === t ? D.bg : D.muted,
                      }}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1" style={{ color: D.muted }}>數量 *</label>
                <input type="number" value={draft.quantity} step={1} min={0}
                  onChange={e => setDraft(p => ({ ...p, quantity: Number(e.target.value) }))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs block mb-1" style={{ color: D.muted }}>成本價 *</label>
                  <input type="number" value={draft.cost_price} step={0.01} min={0}
                    onChange={e => setDraft(p => ({ ...p, cost_price: Number(e.target.value) }))}
                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: D.muted }}>現價 *</label>
                  <input type="number" value={draft.current_price} step={0.01} min={0}
                    onChange={e => setDraft(p => ({ ...p, current_price: Number(e.target.value) }))}
                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: D.muted }}>幣別</label>
                  <select value={draft.currency}
                    onChange={e => setDraft(p => ({ ...p, currency: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                    style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                    {['TWD', 'USD', 'HKD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1" style={{ color: D.muted }}>備注（選填）</label>
                <input type="text" value={draft.note ?? ''} placeholder="e.g. 定期定額"
                  onChange={e => setDraft(p => ({ ...p, note: e.target.value || null }))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>

              {/* Preview P&L */}
              {draft.cost_price > 0 && draft.current_price > 0 && draft.quantity > 0 && (
                <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: D.bg }}>
                  <div className="flex justify-between">
                    <span style={{ color: D.muted }}>市值</span>
                    <span style={{ color: D.ink }}>
                      {fmt(draft.quantity * draft.current_price * (draft.currency === 'USD' ? usdRate : draft.currency === 'HKD' ? hkdRate : 1))}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span style={{ color: D.muted }}>損益</span>
                    {(() => {
                      const p = draft.quantity * (draft.current_price - draft.cost_price) * (draft.currency === 'USD' ? usdRate : draft.currency === 'HKD' ? hkdRate : 1)
                      return <span style={{ color: p >= 0 ? D.accent : D.danger }}>{p >= 0 ? '+' : ''}{fmt(p)}</span>
                    })()}
                  </div>
                </div>
              )}
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
