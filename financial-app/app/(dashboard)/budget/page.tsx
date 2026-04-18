'use client'
import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ScenarioBar from '@/components/ScenarioBar'

const PRIMARY = '#96B3D1'

const LAYERS = [
  {
    id: 'survive',
    label: '生存層',
    sublabel: '經常消費性 / 風險性',
    suggested: 55,
    color: '#96B3D1',
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
    color: '#7B9DB8',
    categories: [
      { id: 'invest',       label: '投資儲蓄',   default: 15000 },
      { id: 'debt',         label: '還債',       default: 2000  },
      { id: 'subscription', label: '訂閱工具',   default: 4000  },
      { id: 'edu',          label: '教育進修',   default: 2000  },
    ],
  },
  {
    id: 'luxury',
    label: '炫耀層',
    sublabel: '娛樂性',
    suggested: 15,
    color: '#B8CDD9',
    categories: [
      { id: 'play',     label: '娛樂',  default: 0    },
      { id: 'clothing', label: '服飾',  default: 2700 },
      { id: 'chore',    label: '雜支',  default: 2000 },
    ],
  },
]

function fmt(n: number) {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

function pct(n: number) { return `${n.toFixed(1)}%` }

export default function BudgetPage() {
  const [income, setIncome] = useState(60000)

  // flat state: category id → amount
  const allCats = LAYERS.flatMap(l => l.categories)
  const initAmts = Object.fromEntries(allCats.map(c => [c.id, c.default]))
  const [amounts, setAmounts] = useState<Record<string, number>>(initAmts)

  const set = (id: string, val: number) => setAmounts(prev => ({ ...prev, [id]: val }))

  const totalSpend = Object.values(amounts).reduce((a, b) => a + b, 0)
  const remaining  = income - totalSpend
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

  // pie data
  const pieData = LAYERS.map(l => ({
    name: l.label,
    value: l.categories.reduce((s, c) => s + (amounts[c.id] || 0), 0),
    color: l.color,
  }))

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">預算規劃</h1>

      <div className="mb-4">
        <ScenarioBar page="budget" currentParams={currentParams} onLoad={handleLoad} onExport={handleExport} />
      </div>

      {/* 月收入 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-600 shrink-0">每月收入 (NT$)</label>
        <input type="number" value={income} step={5000}
          onChange={e => setIncome(Number(e.target.value))}
          className="w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
        <div className="flex gap-4 ml-auto text-sm">
          <span className="text-gray-400">已分配 <b className="text-gray-700">{fmt(totalSpend)}</b></span>
          <span className="text-gray-400">剩餘 <b style={{ color: remaining >= 0 ? PRIMARY : '#EF4444' }}>{fmt(remaining)}</b></span>
          <span className="text-gray-400">儲蓄率 <b style={{ color: PRIMARY }}>{pct(savingsRate)}</b></span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左: 輸入 */}
        <div className="flex-1 space-y-4">
          {LAYERS.map(layer => {
            const layerTotal = layer.categories.reduce((s, c) => s + (amounts[c.id] || 0), 0)
            const actualPct  = income > 0 ? (layerTotal / income) * 100 : 0
            return (
              <div key={layer.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: layer.color }} />
                    <p className="text-sm font-semibold text-gray-800">{layer.label}</p>
                    <p className="text-xs text-gray-400">{layer.sublabel}</p>
                  </div>
                  <div className="text-xs text-gray-400">
                    實際 <b style={{ color: actualPct > layer.suggested + 5 ? '#EF4444' : PRIMARY }}>{pct(actualPct)}</b>
                    　建議 {pct(layer.suggested)}
                  </div>
                </div>
                {/* progress bar */}
                <div className="h-1 rounded-full mb-4" style={{ backgroundColor: '#F3F4F6' }}>
                  <div className="h-1 rounded-full transition-all" style={{
                    width: `${Math.min(100, actualPct / layer.suggested * 100)}%`,
                    backgroundColor: layer.color,
                  }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {layer.categories.map(cat => (
                    <div key={cat.id}>
                      <label className="text-xs text-gray-400 block mb-1">{cat.label}</label>
                      <input type="number" value={amounts[cat.id]} step={500} min={0}
                        onChange={e => set(cat.id, Number(e.target.value))}
                        className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1"
                        style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-right">小計：{fmt(layerTotal)}</p>
              </div>
            )
          })}
        </div>

        {/* 右: 圓餅圖 */}
        <div className="lg:w-72 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-4">支出分布</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ border: '1px solid #F3F4F6', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">建議 vs 實際</p>
            {LAYERS.map(layer => {
              const layerTotal = layer.categories.reduce((s, c) => s + (amounts[c.id] || 0), 0)
              const actualPct  = income > 0 ? (layerTotal / income) * 100 : 0
              const diff = actualPct - layer.suggested
              return (
                <div key={layer.id} className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{layer.label}</span>
                    <span style={{ color: Math.abs(diff) > 5 ? '#EF4444' : PRIMARY }}>
                      {diff >= 0 ? '+' : ''}{pct(diff)}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-gray-100">
                    <div className="absolute h-1.5 rounded-full" style={{
                      width: `${layer.suggested}%`,
                      backgroundColor: '#E5E7EB',
                    }} />
                    <div className="absolute h-1.5 rounded-full" style={{
                      width: `${Math.min(100, actualPct)}%`,
                      backgroundColor: layer.color,
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
