'use client'
import { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
         Legend, ResponsiveContainer } from 'recharts'
import { generateStatements } from '@/lib/statement-engine'
import ScenarioBar from '@/components/ScenarioBar'
import { downloadCSV } from '@/lib/csv-export'
import { D } from '@/lib/design'
import Slider from '@/components/Slider'
import FormulaPanel from '@/components/FormulaPanel'
import { usePageParams } from '@/lib/use-page-params'
import { createClient } from '@/lib/supabase'

/* ─── Snapshot helpers ─── */
interface Snapshot { date: string; netWorth: number; totalAssets: number; totalLiabilities: number }

function loadSnapshots(uid: string): Snapshot[] {
  try { const r = localStorage.getItem(`ftp-snapshots-${uid}`); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveSnapshots(uid: string, s: Snapshot[]) {
  localStorage.setItem(`ftp-snapshots-${uid}`, JSON.stringify(s))
}

const RANGE_DAYS: Record<string, number | null> = { '30天': 30, '6月': 180, '1年': 365, '年初至今': -1, '全部': null }

/* ─── Asset Items ─── */
interface AssetItem { id: string; category: string; name: string; amount: number; note: string | null; updated_at: string }

const CATEGORIES = [
  { key: '流動資金', label: '流動資金', hint: '現金、存款、電子支付', color: '#22c55e' },
  { key: '投資',    label: '投資',    hint: '股票、基金、加密貨幣', color: '#818cf8' },
  { key: '固定資產', label: '固定資產', hint: '不動產、車輛、設備',  color: '#3b82f6' },
  { key: '應收款',  label: '應收款',  hint: '借出款項、預付款',    color: '#06b6d4' },
  { key: '負債',    label: '負債',    hint: '貸款、信用卡餘額',    color: '#ef4444' },
]

const SETUP_SQL = `create table asset_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  name text not null,
  amount numeric not null default 0,
  note text,
  updated_at timestamptz default now()
);
alter table asset_items enable row level security;
create policy "Users manage own asset items"
  on asset_items for all using (auth.uid() = user_id);`

/* ─── Helpers ─── */
function fmt(n: number) { return `NT$ ${Math.abs(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}` }
function fmtShort(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(abs / 10_000).toFixed(0)}萬`
  if (abs >= 10_000)    return `${(abs / 10_000).toFixed(1)}萬`
  return abs.toLocaleString('zh-TW')
}
function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 更新`
}
function ytdCutoff() {
  const d = new Date(); d.setMonth(0); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

const FORMULAS = [
  { name: '淨資產（Net Worth）', formula: 'NW = 總資產 − 總負債',
    vars: [{ sym: '總資產', desc: '流動資金 + 投資 + 固定資產 + 應收款' }, { sym: '總負債', desc: '各類貸款餘額合計' }] },
  { name: '儲蓄率', formula: '儲蓄率 = (總收入 − 總支出) / 總收入 × 100%' },
  { name: '負債比（D/A）', formula: 'D/A = 總負債 / 總資產 × 100%',
    vars: [{ sym: 'D/A < 30%', desc: '健康' }, { sym: 'D/A 30~50%', desc: '注意' }, { sym: 'D/A > 50%', desc: '高風險' }] },
  { name: '投資收益（年化）', formula: '投資收益 = 投資 × 年化報酬率' },
]

/* ─── Main Page ─── */
export default function StatementsPage() {
  /* Asset items */
  const [items,       setItems]       = useState<AssetItem[]>([])
  const [tableReady,  setTableReady]  = useState<boolean | null>(null)

  /* Modal state — step 1: pick category, step 2: fill form */
  const [modalStep,   setModalStep]   = useState<0 | 1 | 2>(0) // 0=closed 1=pick-cat 2=form
  const [editId,      setEditId]      = useState<string | null>(null)
  const [form,        setForm]        = useState({ name: '', amount: '', note: '', category: '流動資金' })
  const [saving,      setSaving]      = useState(false)

  /* Visibility toggle */
  const [amountsHidden, setAmountsHidden] = useState(false)

  /* Expanded category detail */
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  /* Snapshots */
  const [snapshots,   setSnapshots]   = useState<Snapshot[]>([])
  const [snapRange,   setSnapRange]   = useState('全部')
  const [snapSaved,   setSnapSaved]   = useState(false)
  const [trendTab,    setTrendTab]    = useState<'networth' | 'liquid'>('networth')

  /* Projection params */
  const [income,      setIncome]      = useState(80_000)
  const [expenses,    setExpenses]    = useState(50_000)
  const [invRet,      setInvRet]      = useState(7)
  const [reGrowth,    setReGrowth]    = useState(3)
  const [incGrowth,   setIncGrowth]   = useState(2)
  const [expGrowth,   setExpGrowth]   = useState(2)
  const [paydown,     setPaydown]     = useState(200_000)
  const [projYears,   setProjYears]   = useState(20)
  const [activeTab,   setActiveTab]   = useState<'bs' | 'pl'>('bs')

  const userIdRef = useRef<string | null>(null)

  /* ── Load data ── */
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      userIdRef.current = data.user.id
      setSnapshots(loadSnapshots(data.user.id))

      const { data: rows, error } = await supabase
        .from('asset_items').select('*').order('updated_at', { ascending: false })
      if (error?.code === '42P01') { setTableReady(false) }
      else { setTableReady(true); setItems(rows ?? []) }
    })
  }, [])

  /* ── Computed totals ── */
  const totals = CATEGORIES.reduce((acc, c) => {
    acc[c.key] = items.filter(i => i.category === c.key).reduce((s, i) => s + i.amount, 0)
    return acc
  }, {} as Record<string, number>)

  const cash        = totals['流動資金'] ?? 0
  const investments = totals['投資']    ?? 0
  const realEstate  = totals['固定資產'] ?? 0
  const otherAssets = totals['應收款']  ?? 0
  const liabilities = totals['負債']    ?? 0
  const totalAssets = cash + investments + realEstate + otherAssets
  const netWorth    = totalAssets - liabilities

  /* ── Add / Edit / Delete ── */
  const openAdd = (cat?: string) => {
    setEditId(null)
    if (cat) {
      setForm({ name: '', amount: '', note: '', category: cat })
      setModalStep(2)
    } else {
      setModalStep(1)
    }
  }
  const openEdit = (item: AssetItem) => {
    setEditId(item.id)
    setForm({ name: item.name, amount: String(item.amount), note: item.note ?? '', category: item.category })
    setModalStep(2)
  }
  const saveItem = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = { name: form.name.trim(), amount: Number(form.amount) || 0, note: form.note || null, category: form.category, updated_at: new Date().toISOString() }
    if (editId) {
      const { data } = await supabase.from('asset_items').update(payload).eq('id', editId).select().single()
      if (data) setItems(p => p.map(i => i.id === editId ? data : i))
    } else {
      const { data } = await supabase.from('asset_items').insert(payload).select().single()
      if (data) setItems(p => [data, ...p])
    }
    setSaving(false)
    setModalStep(0)
  }
  const deleteItem = async (id: string) => {
    await createClient().from('asset_items').delete().eq('id', id)
    setItems(p => p.filter(i => i.id !== id))
  }

  /* ── Snapshots ── */
  const recordSnapshot = () => {
    if (!userIdRef.current) return
    const todayStr = new Date().toISOString().slice(0, 10)
    const snap: Snapshot = { date: todayStr, netWorth, totalAssets, totalLiabilities: liabilities }
    const existing = loadSnapshots(userIdRef.current)
    const updated = [...existing.filter(s => s.date !== todayStr), snap].sort((a, b) => a.date.localeCompare(b.date))
    saveSnapshots(userIdRef.current, updated)
    setSnapshots(updated)
    setSnapSaved(true)
    setTimeout(() => setSnapSaved(false), 2000)
  }
  const filteredSnaps = (() => {
    const days = RANGE_DAYS[snapRange]
    if (days === null) return snapshots
    if (days === -1) return snapshots.filter(s => s.date >= ytdCutoff())
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    return snapshots.filter(s => s.date >= cutoff.toISOString().slice(0, 10))
  })()
  const snapChartData = filteredSnaps.map(s => ({ date: s.date.slice(5), 淨資產: s.netWorth, 總資產: s.totalAssets, 總負債: s.totalLiabilities, 流動資金: 0, 投資: 0 }))

  /* ── Projection ── */
  const currentParams = { income, expenses, invRet, reGrowth, incGrowth, expGrowth, paydown, projYears }
  const handleLoad = (p: Record<string, unknown>) => {
    if (typeof p.income    === 'number') setIncome(p.income)
    if (typeof p.expenses  === 'number') setExpenses(p.expenses)
    if (typeof p.invRet    === 'number') setInvRet(p.invRet)
    if (typeof p.reGrowth  === 'number') setReGrowth(p.reGrowth)
    if (typeof p.incGrowth === 'number') setIncGrowth(p.incGrowth)
    if (typeof p.expGrowth === 'number') setExpGrowth(p.expGrowth)
    if (typeof p.paydown   === 'number') setPaydown(p.paydown)
    if (typeof p.projYears === 'number') setProjYears(p.projYears)
  }
  usePageParams('statements', currentParams, handleLoad)

  const handleExport = () => {
    if (activeTab === 'bs') {
      downloadCSV('資產負債表.csv', ['年','現金','投資','不動產','總資產','負債','淨值','負債比%'],
        records.map(r => [r.year, r.cash, r.investments, r.realEstate, r.totalAssets, r.liabilities, r.netWorth, r.debtToAssets]))
    } else {
      downloadCSV('損益表.csv', ['年','薪資收入','投資收益','總收入','總支出','淨收入','儲蓄率%'],
        records.map(r => [r.year, r.annualIncome, r.investmentIncome, r.totalIncome, r.annualExpenses, r.netIncome, r.savingsRate]))
    }
  }

  const records = generateStatements({
    cash, investments, realEstate, otherAssets, liabilities,
    monthlyIncome: income, monthlyExpenses: expenses,
    investmentReturn: invRet / 100, realEstateGrowth: reGrowth / 100,
    incomeGrowth: incGrowth / 100, expenseGrowth: expGrowth / 100,
    liabilityPaydown: paydown, years: projYears,
  })

  const today = records[0]
  const final = records[records.length - 1]

  const bsChartData = records.map(r => ({ year: `Y${r.year}`, 現金: r.cash, 投資: r.investments, 不動產: r.realEstate, 其他: r.otherAssets, 負債: -r.liabilities, 淨值: r.netWorth }))
  const plChartData = records.map(r => ({ year: `Y${r.year}`, 總收入: r.totalIncome, 總支出: r.annualExpenses, 淨收入: r.netIncome }))

  const maskVal = (v: string) => amountsHidden ? '•••••' : v

  /* ─── Setup SQL card ─── */
  if (tableReady === false) return (
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: D.ink }}>財務報表</h1>
      <div className="rounded-2xl p-6 max-w-2xl" style={{ backgroundColor: D.surface }}>
        <p className="text-sm font-medium mb-2" style={{ color: D.ink }}>需要建立資料表</p>
        <p className="text-xs mb-4" style={{ color: D.muted }}>請到 Supabase Dashboard → SQL Editor 執行以下指令：</p>
        <pre className="text-xs rounded-xl p-4 overflow-x-auto" style={{ backgroundColor: D.bg, color: D.ink }}>{SETUP_SQL}</pre>
      </div>
    </div>
  )

  /* ─── Main render ─── */
  return (
    <div style={{ fontFamily: D.font }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: D.muted }}>財務報表</p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: D.ink }}>
              {maskVal(fmt(netWorth))}
            </h1>
            <button onClick={() => setAmountsHidden(v => !v)}
              className="transition-opacity hover:opacity-60"
              style={{ color: D.muted, fontSize: 18 }}>
              {amountsHidden ? '○' : '◎'}
            </button>
          </div>
          {tableReady && (
            <p className="text-xs mt-1" style={{ color: D.muted }}>
              總資產 {maskVal(fmt(totalAssets))}　負債 {maskVal(fmt(liabilities))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ScenarioBar page="statements" currentParams={currentParams} onLoad={handleLoad} onExport={handleExport} />
          {tableReady && (
            <button onClick={() => openAdd()}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-light transition-opacity hover:opacity-70"
              style={{ backgroundColor: D.accent, color: '#fff' }}>+</button>
          )}
        </div>
      </div>

      {/* ── Asset category list ── */}
      {tableReady && (
        <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: D.surface }}>
          <p className="text-xs font-medium mb-4" style={{ color: D.muted }}>資產與負債明細</p>
          <div className="space-y-3">
            {CATEGORIES.map(cat => {
              const catItems = items.filter(i => i.category === cat.key)
              const total = catItems.reduce((s, i) => s + i.amount, 0)
              const isLiab = cat.key === '負債'
              const previewNames = catItems.map(i => i.name).join('、')
              const latestUpdate = catItems.length > 0
                ? catItems.reduce((a, b) => a.updated_at > b.updated_at ? a : b).updated_at
                : null
              const isExpanded = expandedCat === cat.key

              return (
                <div key={cat.key} className="rounded-xl overflow-hidden" style={{ backgroundColor: D.bg }}>
                  {/* Card row */}
                  <div
                    className="flex items-stretch cursor-pointer"
                    onClick={() => setExpandedCat(isExpanded ? null : cat.key)}
                  >
                    {/* Left color bar */}
                    <div className="w-1 shrink-0 rounded-l-xl" style={{ backgroundColor: cat.color }} />

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: D.ink }}>{cat.label}</p>
                        {previewNames ? (
                          <p className="text-xs mt-0.5 truncate" style={{ color: D.muted }}>{previewNames}</p>
                        ) : (
                          <p className="text-xs mt-0.5" style={{ color: D.muted, opacity: 0.4 }}>{cat.hint}</p>
                        )}
                        {latestUpdate && (
                          <p className="text-xs mt-0.5" style={{ color: D.muted, opacity: 0.5 }}>{fmtDate(latestUpdate)}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {isLiab && total > 0 ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: '#ef4444', color: '#fff' }}>−</span>
                            <span className="text-base font-bold" style={{ color: '#ef4444' }}>
                              {maskVal(fmtShort(total))}
                            </span>
                          </div>
                        ) : (
                          <p className="text-base font-bold" style={{ color: cat.color }}>
                            {maskVal(fmtShort(total))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="px-5 pb-3 pt-1" style={{ borderTop: `1px solid var(--subtle)` }}>
                      <div className="space-y-1.5 mb-2">
                        {catItems.length === 0 && (
                          <p className="text-xs py-1" style={{ color: D.muted, opacity: 0.4 }}>尚無項目</p>
                        )}
                        {catItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between gap-2 group">
                            <button onClick={e => { e.stopPropagation(); openEdit(item) }}
                              className="text-xs truncate text-left flex-1 transition-opacity hover:opacity-70"
                              style={{ color: D.muted }}
                              title={item.note ?? item.name}>
                              {item.name}
                              {item.note && <span className="ml-1 opacity-50">({item.note})</span>}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-medium" style={{ color: D.ink }}>{maskVal(fmtShort(item.amount))}</span>
                              <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-50"
                                style={{ color: D.muted }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={e => { e.stopPropagation(); openAdd(cat.key) }}
                        className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: D.accent }}>+ 新增{cat.label}項目</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main layout: sidebar (sliders) + content (charts) */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left sidebar: projection inputs ── */}
        <aside className="lg:w-60 shrink-0 space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>每月收支</p>
            <Slider label="每月收入" value={income}   min={20_000} max={500_000} step={5_000} format={fmt} onChange={setIncome} />
            <Slider label="每月支出" value={expenses} min={10_000} max={300_000} step={5_000} format={fmt} onChange={setExpenses} />
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>成長假設（年化）</p>
            <Slider label="投資報酬率"       value={invRet}    min={0} max={20} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setInvRet} />
            <Slider label="固定資產增值"     value={reGrowth}  min={0} max={10} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setReGrowth} />
            <Slider label="收入成長率"       value={incGrowth} min={0} max={10} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setIncGrowth} />
            <Slider label="支出成長（通膨）" value={expGrowth} min={0} max={8}  step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setExpGrowth} />
            <div className="mt-3">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>每年還款本金 (NT$)</label>
              <input type="number" value={paydown} step={50000}
                onChange={e => setPaydown(Number(e.target.value))}
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
            </div>
            <Slider label="預測年限" value={projYears} min={5} max={40} step={1} format={v => `${v} 年`} onChange={setProjYears} />
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 space-y-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '目前淨值',             value: maskVal(fmt(today.netWorth)),                 accent: true  },
              { label: `${projYears} 年後淨值`, value: maskVal(fmt(final.netWorth)),                accent: false },
              { label: '目前儲蓄率',           value: `${today.savingsRate.toFixed(1)}%`,  accent: false },
              { label: '目前負債比',           value: `${today.debtToAssets.toFixed(1)}%`, accent: false },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
                <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
                <p className="text-base font-bold" style={{ color: m.accent ? D.accent : D.ink }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* ── Net Worth Trend (Snapshots) ── */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium" style={{ color: D.ink }}>趨勢圖</p>
              <button onClick={recordSnapshot}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.accent, color: '#fff', opacity: snapSaved ? 0.6 : 1 }}>
                {snapSaved ? '✓ 已記錄' : '+ 記錄今日'}
              </button>
            </div>

            {/* Tab toggle */}
            <div className="flex rounded-xl p-1 mb-4 gap-1" style={{ backgroundColor: D.bg }}>
              {[
                { key: 'networth', label: '淨資產與負債' },
                { key: 'liquid',   label: '流動資金與投資' },
              ].map(t => (
                <button key={t.key} onClick={() => setTrendTab(t.key as typeof trendTab)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: trendTab === t.key ? D.surface : 'transparent', color: trendTab === t.key ? D.ink : D.muted }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Range selector */}
            <div className="flex gap-1 mb-4">
              {Object.keys(RANGE_DAYS).map(r => (
                <button key={r} onClick={() => setSnapRange(r)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-opacity hover:opacity-70"
                  style={{ backgroundColor: snapRange === r ? D.ink : D.bg, color: snapRange === r ? D.bg : D.muted }}>
                  {r}
                </button>
              ))}
            </div>

            {snapChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 gap-1">
                <p className="text-xs" style={{ color: D.muted }}>尚無快照紀錄</p>
                <p className="text-xs" style={{ color: D.muted, opacity: 0.5 }}>點擊「+ 記錄今日」開始追蹤淨值變化</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={snapChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--ink)" stopOpacity={0.15} /><stop offset="95%" stopColor="var(--ink)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {trendTab === 'networth' ? <>
                    <Area type="monotone" dataKey="總資產" stroke="var(--ink)" strokeWidth={1.5} fill="url(#gA)" strokeOpacity={0.6} dot={{ r: 3, fill: 'var(--ink)' }} />
                    <Area type="monotone" dataKey="淨資產" stroke="var(--accent)" strokeWidth={2} fill="url(#gN)" dot={{ r: 3, fill: 'var(--accent)' }} />
                    <Line type="monotone" dataKey="總負債" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  </> : <>
                    <Area type="monotone" dataKey="流動資金" stroke="#22c55e" strokeWidth={2} fill="none" dot={{ r: 3, fill: '#22c55e' }} />
                    <Area type="monotone" dataKey="投資" stroke="#818cf8" strokeWidth={2} fill="none" dot={{ r: 3, fill: '#818cf8' }} />
                  </>}
                </AreaChart>
              </ResponsiveContainer>
            )}

            {snapshots.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid var(--subtle)` }}>
                <p className="text-xs mb-2" style={{ color: D.muted }}>歷史紀錄（最近 {Math.min(snapshots.length, 5)} 筆）</p>
                <div className="space-y-1">
                  {[...snapshots].reverse().slice(0, 5).map(s => (
                    <div key={s.date} className="flex items-center justify-between text-xs">
                      <span style={{ color: D.muted }}>{s.date}</span>
                      <div className="flex gap-4">
                        <span style={{ color: D.muted }}>資產 {maskVal(fmt(s.totalAssets))}</span>
                        <span style={{ color: D.muted }}>負債 {maskVal(fmt(s.totalLiabilities))}</span>
                        <span className="font-medium" style={{ color: D.accent }}>淨值 {maskVal(fmt(s.netWorth))}</span>
                        <button onClick={() => {
                          if (!userIdRef.current) return
                          const u = snapshots.filter(x => x.date !== s.date)
                          saveSnapshots(userIdRef.current, u); setSnapshots(u)
                        }} className="transition-opacity hover:opacity-50" style={{ color: D.muted }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── B/S Projection Chart ── */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>資產結構與淨值預測（B/S）</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bsChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: unknown) => fmt(Math.abs(Number(v)))} contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="現金"   stackId="a" fill="var(--ink)" fillOpacity={0.7} />
                <Bar dataKey="投資"   stackId="a" fill="var(--ink)" fillOpacity={0.5} />
                <Bar dataKey="不動產" stackId="a" fill="var(--ink)" fillOpacity={0.3} />
                <Bar dataKey="其他"   stackId="a" fill="var(--muted)" fillOpacity={0.3} />
                <Line type="monotone" dataKey="淨值" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── P/L Chart ── */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>損益表趨勢（P/L）</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={plChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="總收入" stroke="var(--ink)"    strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="總支出" stroke="var(--muted)"  strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="淨收入" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Projection table ── */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="flex gap-2 mb-4">
              {(['bs', 'pl'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ backgroundColor: activeTab === tab ? D.ink : D.bg, color: activeTab === tab ? D.bg : D.muted }}>
                  {tab === 'bs' ? '資產負債表' : '損益表'}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              {activeTab === 'bs' ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                      {['年','現金','投資','不動產','總資產','負債','淨值','負債比'].map(h => (
                        <th key={h} className="text-left py-2 pr-3 font-medium" style={{ color: D.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.year} style={{ borderBottom: `1px solid var(--subtle)` }}>
                        <td className="py-1.5 pr-3 font-medium" style={{ color: D.ink }}>{r.year}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.cash)}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.investments)}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.realEstate)}</td>
                        <td className="py-1.5 pr-3 font-medium" style={{ color: D.ink }}>{fmt(r.totalAssets)}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.liabilities)}</td>
                        <td className="py-1.5 pr-3 font-medium" style={{ color: D.accent }}>{fmt(r.netWorth)}</td>
                        <td className="py-1.5" style={{ color: D.muted }}>{r.debtToAssets}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                      {['年','薪資收入','投資收益','總收入','總支出','淨收入','儲蓄率'].map(h => (
                        <th key={h} className="text-left py-2 pr-3 font-medium" style={{ color: D.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.year} style={{ borderBottom: `1px solid var(--subtle)` }}>
                        <td className="py-1.5 pr-3 font-medium" style={{ color: D.ink }}>{r.year}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.annualIncome)}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.investmentIncome)}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.totalIncome)}</td>
                        <td className="py-1.5 pr-3" style={{ color: D.muted }}>{fmt(r.annualExpenses)}</td>
                        <td className="py-1.5 pr-3 font-medium" style={{ color: D.accent }}>{fmt(r.netIncome)}</td>
                        <td className="py-1.5" style={{ color: D.muted }}>{r.savingsRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <FormulaPanel formulas={FORMULAS} />
        </div>
      </div>

      {/* ── Modal: Step 1 — Pick category ── */}
      {modalStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalStep(0) }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: D.surface }}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold" style={{ color: D.ink }}>新增帳戶</p>
              <button onClick={() => setModalStep(0)} className="text-lg transition-opacity hover:opacity-50" style={{ color: D.muted }}>×</button>
            </div>
            <div className="space-y-2">
              {CATEGORIES.map(c => (
                <button key={c.key}
                  onClick={() => { setForm(f => ({ ...f, category: c.key })); setModalStep(2) }}
                  className="w-full px-4 py-3.5 rounded-xl text-sm font-medium text-left transition-opacity hover:opacity-80"
                  style={{ backgroundColor: D.bg, color: D.ink, borderLeft: `4px solid ${c.color}` }}>
                  {c.label}
                  <span className="ml-2 text-xs font-normal" style={{ color: D.muted }}>{c.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Step 2 — Fill form ── */}
      {modalStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalStep(0) }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: D.surface }}>
            <div className="flex items-center gap-2 mb-5">
              {!editId && (
                <button onClick={() => setModalStep(1)}
                  className="text-sm transition-opacity hover:opacity-50" style={{ color: D.muted }}>←</button>
              )}
              <p className="text-sm font-semibold flex-1" style={{ color: D.ink }}>
                {editId ? '編輯項目' : `新增${form.category}`}
              </p>
              <button onClick={() => setModalStep(0)} className="text-lg transition-opacity hover:opacity-50" style={{ color: D.muted }}>×</button>
            </div>

            {/* Category badge */}
            {!editId && (
              <div className="mb-4 px-3 py-1.5 rounded-lg inline-flex items-center gap-2"
                style={{ backgroundColor: D.bg }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORIES.find(c => c.key === form.category)?.color }} />
                <span className="text-xs" style={{ color: D.ink }}>{form.category}</span>
              </div>
            )}

            {/* Edit: category selector */}
            {editId && (
              <div className="mb-3">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>類別</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => setForm(f => ({ ...f, category: c.key }))}
                      className="px-3 py-1 rounded-lg text-xs transition-opacity hover:opacity-70"
                      style={{ backgroundColor: form.category === c.key ? c.color : D.bg, color: form.category === c.key ? '#fff' : D.muted }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>名稱</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：郵政金融卡、微軟股票…"
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
            </div>

            <div className="mb-3">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>金額 (NT$)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
            </div>

            <div className="mb-5">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>備註（選填）</label>
              <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="說明、備忘…"
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModalStep(0)}
                className="flex-1 py-2 rounded-xl text-xs transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.bg, color: D.muted }}>取消</button>
              <button onClick={saveItem} disabled={saving || !form.name.trim()}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ backgroundColor: D.accent, color: '#fff' }}>
                {saving ? '儲存中…' : editId ? '更新' : '新增'}
              </button>
            </div>

            {editId && (
              <button onClick={async () => { await deleteItem(editId); setModalStep(0) }}
                className="w-full mt-2 py-2 rounded-xl text-xs transition-opacity hover:opacity-70"
                style={{ color: '#ef4444' }}>刪除此項目</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
