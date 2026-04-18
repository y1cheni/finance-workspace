'use client'
import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ScenarioBar from '@/components/ScenarioBar'
import { D } from '@/lib/design'

const LAYERS = [
  {
    id: 'survive',
    label: '生存層',
    sublabel: '經常消費性 / 風險性',
    suggested: 55,
    categories: [
      { id: 'eat',     label: '飲食',     default: 9000  },
      { id: 'live',    label: '居住',     default: 588   },
      { id: 'car',     label: '交通/車',  default: 6000  },
      { id: 'medical', label: '醫療保健', default: 3000  },
      { id: 'tax',     label: '稅費',     default: 0     },
    ],
  },
  {
    id: 'experience',
    label: '體驗層',
    sublabel: '財務性 / 教育性',
    suggested: 30,
    categories: [
      { id: 'invest',       label: '投資儲蓄', default: 15000 },
      { id: 'debt',         label: '還債',     default: 2000  },
      { id: 'subscription', label: '訂閱工具', default: 4000  },
      { id: 'edu',          label: '教育進修', default: 2000  },
    ],
  },
  {
    id: 'luxury',
    label: '炫耀層',
    sublabel: '娛樂性',
    suggested: 15,
    categories: [
      { id: 'play',     label: '娛樂', default: 0    },
      { id: 'clothing', label: '服飾', default: 2700 },
      { id: 'chore',    label: '雜支', default: 2000 },
    ],
  },
]

// layer colors using the design system palette
const LAYER_COLORS = ['var(--ink)', 'var(--accent)', 'var(--muted)']

function fmt(n: number) { return `NT$ ${Math.round(n).toLocaleString('zh-TW')}` }
function pct(n: number) { return `${n.toFixed(1)}%` }

export default function BudgetPage() {
  const [income, setIncome] = useState(60000)

  const allCats = LAYERS.flatMap(l => l.categories)
  const initAmts = Object.fromEntries(allCats.map(c => [c.id, c.default]))
  const [amounts, setAmounts] = useState<Record<string, number>>(initAmts)

  const set = (id: string, val: number) => setAmounts(prev => ({ ...prev, [id]: val }))

  const totalSpend  = Object.values(amounts).reduce((a, b) => a + b, 0)
  const remaining   = income - totalSpend
  const savingsRate = income > 0 ? (remaining / income) * 100 : 0

  const currentParams = { income, ...amounts }
  const handleLoad = (params: Record<string, unknown>) => {
    if (typeof params.income === 'number') setIncome(params.income)
    const next = { ...amounts }
    for (const k of Object.keys(amounts)) {
      if (typeof params[k] === 'number') next[k] = params[k] as number
    }
    setAmounts(next)
  }
  const handleExport = () => {
    const rows = LAYERS.flatMap(l =>
      l.categories.map(c => [l.label, c.label, amounts[c.id]])
    )
    const headers = ['層次', '類別', '金額']
    const csv = [headers, ...rows].map(r => r.join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = '預算規劃.csv'
    a.click()
  }

  const pieData = LAYERS.map((l, i) => ({
    name: l.label,
    value: l.categories.reduce((s, c) => s + (amounts[c.id] || 0), 0),
    color: LAYER_COLORS[i],
  }))

  return (
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: D.ink }}>預算規劃</h1>

      <div className="mb-4">
        <ScenarioBar page="budget" currentParams={currentParams} onLoad={handleLoad} onExport={handleExport} />
      </div>

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

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          {LAYERS.map((layer, li) => {
            const layerTotal = layer.categories.reduce((s, c) => s + (amounts[c.id] || 0), 0)
            const actualPct  = income > 0 ? (layerTotal / income) * 100 : 0
            const over       = actualPct > layer.suggested + 5
            return (
              <div key={layer.id} className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LAYER_COLORS[li] }} />
                    <p className="text-xs font-semibold" style={{ color: D.ink }}>{layer.label}</p>
                    <p className="text-xs" style={{ color: D.muted }}>{layer.sublabel}</p>
                  </div>
                  <div className="text-xs" style={{ color: D.muted }}>
                    實際 <b style={{ color: over ? D.danger : D.accent }}>{pct(actualPct)}</b>
                    　建議 {pct(layer.suggested)}
                  </div>
                </div>
                <div className="h-1 rounded-full mb-4" style={{ backgroundColor: D.bg }}>
                  <div className="h-1 rounded-full transition-all" style={{
                    width: `${Math.min(100, actualPct / layer.suggested * 100)}%`,
                    backgroundColor: LAYER_COLORS[li],
                  }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {layer.categories.map(cat => (
                    <div key={cat.id}>
                      <label className="text-xs block mb-1" style={{ color: D.muted }}>{cat.label}</label>
                      <input type="number" value={amounts[cat.id]} step={500} min={0}
                        onChange={e => set(cat.id, Number(e.target.value))}
                        className="w-full rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3 text-right" style={{ color: D.muted }}>小計：{fmt(layerTotal)}</p>
              </div>
            )
          })}
        </div>

        <div className="lg:w-72 shrink-0 space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>支出分布</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>建議 vs 實際</p>
            {LAYERS.map((layer, li) => {
              const layerTotal = layer.categories.reduce((s, c) => s + (amounts[c.id] || 0), 0)
              const actualPct  = income > 0 ? (layerTotal / income) * 100 : 0
              const diff = actualPct - layer.suggested
              return (
                <div key={layer.id} className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: D.muted }}>
                    <span>{layer.label}</span>
                    <span style={{ color: Math.abs(diff) > 5 ? D.danger : D.accent }}>
                      {diff >= 0 ? '+' : ''}{pct(diff)}
                    </span>
                  </div>
                  <div className="relative h-1 rounded-full" style={{ backgroundColor: D.bg }}>
                    <div className="absolute h-1 rounded-full" style={{
                      width: `${layer.suggested}%`,
                      backgroundColor: D.subtle,
                    }} />
                    <div className="absolute h-1 rounded-full" style={{
                      width: `${Math.min(100, actualPct)}%`,
                      backgroundColor: LAYER_COLORS[li],
                      opacity: 0.7,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
