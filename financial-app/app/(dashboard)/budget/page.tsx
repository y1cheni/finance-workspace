'use client'
import { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ScenarioBar from '@/components/ScenarioBar'
import { D } from '@/lib/design'
import { readStore } from '@/lib/shared-store'
import { usePageParams } from '@/lib/use-page-params'

/* ─── Types ─── */
interface Category { id: string; label: string; monthly: number }
interface Layer     { id: string; label: string; sublabel: string; suggested: number; categories: Category[] }

/* ─── Defaults ─── */
const DEFAULT_LAYERS: Layer[] = [
  {
    id: 'survive', label: '生存層', sublabel: '經常消費性 / 風險性', suggested: 55,
    categories: [
      { id: 'eat',      label: '飲食',     monthly: 9000 },
      { id: 'live',     label: '居住',     monthly: 588  },
      { id: 'car',      label: '交通/車',  monthly: 6000 },
      { id: 'medical',  label: '醫療保健', monthly: 3000 },
      { id: 'tax',      label: '稅費',     monthly: 0    },
      { id: 'insurance',label: '保險',     monthly: 0    },
    ],
  },
  {
    id: 'experience', label: '體驗層', sublabel: '財務性 / 教育性', suggested: 30,
    categories: [
      { id: 'invest',       label: '投資儲蓄', monthly: 15000 },
      { id: 'debt',         label: '還債',     monthly: 2000  },
      { id: 'subscription', label: '訂閱工具', monthly: 4000  },
      { id: 'edu',          label: '教育進修', monthly: 2000  },
    ],
  },
  {
    id: 'social', label: '社交層', sublabel: '娛樂性', suggested: 15,
    categories: [
      { id: 'play',     label: '娛樂', monthly: 0    },
      { id: 'clothing', label: '服飾', monthly: 2700 },
      { id: 'chore',    label: '雜支', monthly: 2000 },
    ],
  },
]

const LAYER_COLORS = ['var(--ink)', 'var(--accent)', 'var(--muted)']
const STORAGE_KEY = 'fintool-budget-layers-v2'

function loadLayers(): Layer[] {
  if (typeof window === 'undefined') return DEFAULT_LAYERS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_LAYERS
  } catch { return DEFAULT_LAYERS }
}
function saveLayers(layers: Layer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layers))
}

/* ─── Frequency conversion (store monthly internally) ─── */
const DAILY_FACTOR  = 365 / 12   // ≈ 30.4
function toMonthly(val: number, freq: 'daily' | 'monthly' | 'yearly') {
  if (freq === 'daily')   return val * DAILY_FACTOR
  if (freq === 'yearly')  return val / 12
  return val
}
function fromMonthly(monthly: number, freq: 'daily' | 'monthly' | 'yearly') {
  if (freq === 'daily')   return monthly / DAILY_FACTOR
  if (freq === 'yearly')  return monthly * 12
  return monthly
}
function round(n: number) { return Math.round(n) }

/* ─── Helpers ─── */
function fmt(n: number) { return `NT$ ${round(n).toLocaleString('zh-TW')}` }
function pct(n: number) { return `${n.toFixed(1)}%` }
let _uid = 0
function uid() { return `c${Date.now()}_${_uid++}` }

/* ─── FreqInput: one category row with 日/月/年 three fields ─── */
function FreqInput({
  label, monthly, onLabelChange, onMonthlyChange, onDelete,
}: {
  label: string
  monthly: number
  onLabelChange: (v: string) => void
  onMonthlyChange: (v: number) => void
  onDelete: () => void
}) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelVal,     setLabelVal]     = useState(label)

  // local display values for each freq
  const [daily,   setDaily]   = useState(() => round(fromMonthly(monthly, 'daily')))
  const [month,   setMonth]   = useState(() => round(monthly))
  const [yearly,  setYearly]  = useState(() => round(fromMonthly(monthly, 'yearly')))

  // sync from parent when monthly changes externally
  useEffect(() => {
    setDaily(round(fromMonthly(monthly, 'daily')))
    setMonth(round(monthly))
    setYearly(round(fromMonthly(monthly, 'yearly')))
  }, [monthly])

  const handleChange = (val: number, freq: 'daily' | 'monthly' | 'yearly') => {
    const m = toMonthly(val, freq)
    setDaily(round(fromMonthly(m, 'daily')))
    setMonth(round(m))
    setYearly(round(fromMonthly(m, 'yearly')))
    onMonthlyChange(m)
  }

  const commitLabel = () => {
    setEditingLabel(false)
    onLabelChange(labelVal.trim() || label)
  }

  return (
    <div className="rounded-xl p-3 group" style={{ backgroundColor: D.bg }}>
      {/* Category name */}
      <div className="flex items-center justify-between mb-2">
        {editingLabel ? (
          <input autoFocus value={labelVal}
            onChange={e => setLabelVal(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
            className="flex-1 bg-transparent text-xs outline-none border-b"
            style={{ color: D.ink, borderColor: D.accent }} />
        ) : (
          <button onClick={() => { setEditingLabel(true); setLabelVal(label) }}
            className="text-xs font-medium text-left hover:opacity-70 transition-opacity"
            style={{ color: D.ink }} title="點擊重新命名">
            {label}
          </button>
        )}
        <button onClick={onDelete}
          className="text-xs opacity-0 group-hover:opacity-60 transition-opacity ml-2"
          style={{ color: D.muted }}>✕</button>
      </div>

      {/* 日 / 月 / 年 inputs */}
      <div className="grid grid-cols-3 gap-1.5">
        {([
          { label: '日', val: daily,  freq: 'daily'   as const },
          { label: '月', val: month,  freq: 'monthly' as const },
          { label: '年', val: yearly, freq: 'yearly'  as const },
        ] as const).map(({ label: fl, val, freq }) => (
          <div key={freq}>
            <p className="text-xs mb-0.5 text-center" style={{ color: D.muted, fontSize: 10 }}>{fl}</p>
            <input
              type="number" min={0} step={freq === 'daily' ? 10 : freq === 'monthly' ? 500 : 1000}
              value={val}
              onChange={e => handleChange(Number(e.target.value), freq)}
              className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none text-center"
              style={{ backgroundColor: D.surface, color: D.ink, border: `1px solid var(--subtle)` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main page ─── */
export default function BudgetPage() {
  const [income, setIncome] = useState(60000)
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS)

  useEffect(() => { setLayers(loadLayers()) }, [])

  const persistLayers = useCallback((next: Layer[]) => { setLayers(next); saveLayers(next) }, [])

  /* ── Layer helpers ── */
  const renameLayer = (lid: string, label: string) =>
    persistLayers(layers.map(l => l.id === lid ? { ...l, label } : l))

  const setSuggested = (lid: string, val: number) =>
    persistLayers(layers.map(l => l.id === lid ? { ...l, suggested: val } : l))

  const addCategory = (lid: string) =>
    persistLayers(layers.map(l => l.id === lid
      ? { ...l, categories: [...l.categories, { id: uid(), label: '新項目', monthly: 0 }] }
      : l))

  const updateCatLabel = (lid: string, cid: string, label: string) =>
    persistLayers(layers.map(l => l.id === lid
      ? { ...l, categories: l.categories.map(c => c.id === cid ? { ...c, label } : c) }
      : l))

  const updateCatMonthly = (lid: string, cid: string, monthly: number) =>
    persistLayers(layers.map(l => l.id === lid
      ? { ...l, categories: l.categories.map(c => c.id === cid ? { ...c, monthly } : c) }
      : l))

  const deleteCategory = (lid: string, cid: string) =>
    persistLayers(layers.map(l => l.id === lid
      ? { ...l, categories: l.categories.filter(c => c.id !== cid) }
      : l))

  /* ── Totals ── */
  const totalSpend  = layers.flatMap(l => l.categories).reduce((s, c) => s + c.monthly, 0)
  const remaining   = income - totalSpend
  const savingsRate = income > 0 ? (remaining / income) * 100 : 0

  /* ── ScenarioBar ── */
  const amountMap = Object.fromEntries(layers.flatMap(l => l.categories.map(c => [c.id, c.monthly])))
  const currentParams = { income, ...amountMap }
  const handleLoad = (params: Record<string, unknown>) => {
    if (typeof params.income === 'number') setIncome(params.income)
    persistLayers(layers.map(l => ({
      ...l,
      categories: l.categories.map(c =>
        typeof params[c.id] === 'number' ? { ...c, monthly: params[c.id] as number } : c
      ),
    })))
  }
  usePageParams('budget', currentParams, handleLoad)

  const handleExport = () => {
    const rows = layers.flatMap(l =>
      l.categories.map(c => [l.label, c.label, round(c.monthly), round(fromMonthly(c.monthly, 'daily')), round(fromMonthly(c.monthly, 'yearly'))])
    )
    const csv = [['層次','類別','月花費','日花費','年花費'], ...rows].map(r => r.join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '預算規劃.csv'; a.click()
  }

  const pieData = layers.map((l, i) => ({
    name: l.label,
    value: l.categories.reduce((s, c) => s + c.monthly, 0),
    color: LAYER_COLORS[i % LAYER_COLORS.length],
  }))

  /* ── Editing layer name state ── */
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [editingLayerLabel, setEditingLayerLabel] = useState('')

  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>預算規劃</h1>
        <button
          onClick={() => {
            const s = readStore()
            if (s.monthlySubscriptionTotal) {
              persistLayers(layers.map(l => ({
                ...l,
                categories: l.categories.map(c =>
                  c.id === 'subscription' ? { ...c, monthly: Math.round(s.monthlySubscriptionTotal!) } : c
                ),
              })))
            }
          }}
          className="text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.surface, color: D.muted }}>
          ↓ 從訂閱管理同步
        </button>
      </div>

      <div className="mb-4">
        <ScenarioBar page="budget" currentParams={currentParams} onLoad={handleLoad} onExport={handleExport} />
      </div>

      {/* Income + summary */}
      <div className="rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4" style={{ backgroundColor: D.surface }}>
        <label className="text-xs font-medium shrink-0" style={{ color: D.muted }}>每月收入 (NT$)</label>
        <input type="number" value={income} step={5000}
          onChange={e => setIncome(Number(e.target.value))}
          className="w-48 rounded-xl px-3 py-2 text-xs focus:outline-none"
          style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
        <div className="flex gap-4 ml-auto text-xs">
          <span style={{ color: D.muted }}>已分配 <b style={{ color: D.ink }}>{fmt(totalSpend)}</b></span>
          <span style={{ color: D.muted }}>剩餘 <b style={{ color: remaining >= 0 ? D.accent : D.danger }}>{fmt(remaining)}</b></span>
          <span style={{ color: D.muted }}>儲蓄率 <b style={{ color: D.accent }}>{pct(savingsRate)}</b></span>
        </div>
      </div>

      {/* Column header hint */}
      <div className="grid grid-cols-3 gap-1.5 mb-2 px-1 max-w-xs">
        {['日花費', '月花費', '年花費'].map(h => (
          <p key={h} className="text-center text-xs font-medium" style={{ color: D.muted, fontSize: 10 }}>{h}</p>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          {layers.map((layer, li) => {
            const layerTotal = layer.categories.reduce((s, c) => s + c.monthly, 0)
            const actualPct  = income > 0 ? (layerTotal / income) * 100 : 0
            const over       = actualPct > layer.suggested + 5
            const color      = LAYER_COLORS[li % LAYER_COLORS.length]

            return (
              <div key={layer.id} className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
                {/* Layer header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    {editingLayerId === layer.id ? (
                      <input autoFocus value={editingLayerLabel}
                        onChange={e => setEditingLayerLabel(e.target.value)}
                        onBlur={() => { renameLayer(layer.id, editingLayerLabel.trim() || layer.label); setEditingLayerId(null) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { renameLayer(layer.id, editingLayerLabel.trim() || layer.label); setEditingLayerId(null) }
                          if (e.key === 'Escape') setEditingLayerId(null)
                        }}
                        className="text-xs font-semibold bg-transparent outline-none border-b flex-1"
                        style={{ color: D.ink, borderColor: D.accent }} />
                    ) : (
                      <button onClick={() => { setEditingLayerId(layer.id); setEditingLayerLabel(layer.label) }}
                        className="text-xs font-semibold hover:opacity-70 transition-opacity"
                        style={{ color: D.ink }} title="點擊重新命名">
                        {layer.label}
                      </button>
                    )}
                    <span className="text-xs shrink-0" style={{ color: D.muted }}>{layer.sublabel}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs" style={{ color: D.muted }}>
                    <span>建議
                      <input type="number" value={layer.suggested} min={0} max={100} step={1}
                        onChange={e => setSuggested(layer.id, Number(e.target.value))}
                        className="w-10 ml-1 rounded px-1 py-0.5 text-xs text-center focus:outline-none"
                        style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />%
                    </span>
                    <span>實際 <b style={{ color: over ? D.danger : D.accent }}>{pct(actualPct)}</b></span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full mb-4" style={{ backgroundColor: D.bg }}>
                  <div className="h-1 rounded-full transition-all" style={{
                    width: `${Math.min(100, layer.suggested > 0 ? actualPct / layer.suggested * 100 : 0)}%`,
                    backgroundColor: color,
                  }} />
                </div>

                {/* Categories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {layer.categories.map(cat => (
                    <FreqInput key={cat.id}
                      label={cat.label}
                      monthly={cat.monthly}
                      onLabelChange={v => updateCatLabel(layer.id, cat.id, v)}
                      onMonthlyChange={v => updateCatMonthly(layer.id, cat.id, v)}
                      onDelete={() => deleteCategory(layer.id, cat.id)}
                    />
                  ))}

                  {/* Add category button */}
                  <button onClick={() => addCategory(layer.id)}
                    className="rounded-xl p-3 text-xs transition-opacity hover:opacity-70 flex items-center justify-center gap-1"
                    style={{ backgroundColor: D.bg, color: D.muted, border: `1px dashed var(--subtle)`, minHeight: 80 }}>
                    + 新增項目
                  </button>
                </div>

                <p className="text-xs mt-3 text-right" style={{ color: D.muted }}>
                  月小計：<b style={{ color: D.ink }}>{fmt(layerTotal)}</b>
                  　年小計：<b style={{ color: D.muted }}>{fmt(layerTotal * 12)}</b>
                </p>
              </div>
            )
          })}
        </div>

        {/* ── Right panel ── */}
        <div className="lg:w-72 shrink-0 space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>支出分布</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => fmt(Number(v))}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>建議 vs 實際</p>
            {layers.map((layer, li) => {
              const layerTotal = layer.categories.reduce((s, c) => s + c.monthly, 0)
              const actualPct  = income > 0 ? (layerTotal / income) * 100 : 0
              const diff = actualPct - layer.suggested
              const color = LAYER_COLORS[li % LAYER_COLORS.length]
              return (
                <div key={layer.id} className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: D.muted }}>
                    <span>{layer.label}</span>
                    <span style={{ color: Math.abs(diff) > 5 ? D.danger : D.accent }}>
                      {diff >= 0 ? '+' : ''}{pct(diff)}
                    </span>
                  </div>
                  <div className="relative h-1 rounded-full" style={{ backgroundColor: D.bg }}>
                    <div className="absolute h-1 rounded-full" style={{ width: `${layer.suggested}%`, backgroundColor: D.subtle }} />
                    <div className="absolute h-1 rounded-full" style={{ width: `${Math.min(100, actualPct)}%`, backgroundColor: color, opacity: 0.7 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Monthly / Annual summary */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>月 / 年 總覽</p>
            <div className="space-y-1.5">
              {[
                { label: '月收入',   value: fmt(income) },
                { label: '月支出',   value: fmt(totalSpend) },
                { label: '月結餘',   value: fmt(remaining),  accent: true },
                { label: '年收入',   value: fmt(income * 12) },
                { label: '年支出',   value: fmt(totalSpend * 12) },
                { label: '年結餘',   value: fmt(remaining * 12), accent: true },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-xs">
                  <span style={{ color: D.muted }}>{r.label}</span>
                  <span className="font-medium" style={{ color: r.accent ? D.accent : D.ink }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
