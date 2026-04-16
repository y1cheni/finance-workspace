'use client'
import { useState, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { compoundSeries, cagr } from '@/lib/math-engine'

const FREQ_MAP: Record<string, number> = { 每月: 12, 每季: 4, 每年: 1, 每日: 365 }
const RATES = [2, 4, 6, 7, 8, 10, 12, 15]

function fmt(n: number) { return `NT$ ${n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}` }

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="mb-5">
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  )
}

export default function CompoundPage() {
  const [initial, setInitial]         = useState(1_000_000)
  const [monthly, setMonthly]         = useState(10_000)
  const [rate, setRate]               = useState(7)
  const [years, setYears]             = useState(20)
  const [freq, setFreq]               = useState('每月')

  const compFreq = FREQ_MAP[freq]
  const annualRate = rate / 100

  const data = compoundSeries(initial, annualRate, years, monthly, compFreq)

  // Downsample for chart (max 100 points)
  const step = Math.max(1, Math.floor(data.years.length / 100))
  const chartData = data.years
    .filter((_, i) => i % step === 0 || i === data.years.length - 1)
    .map((y, i) => {
      const idx = Math.min(i * step, data.years.length - 1)
      return {
        year: data.years[idx].toFixed(1),
        本金: Math.round(data.contributions[idx]),
        利息: Math.round(data.interest[idx]),
        總餘額: Math.round(data.balance[idx]),
      }
    })

  const finalBalance  = data.balance[data.balance.length - 1]
  const totalContrib  = data.contributions[data.contributions.length - 1]
  const totalInterest = data.interest[data.interest.length - 1]
  const effectiveCagr = cagr(initial, finalBalance, years)

  // Sensitivity table
  const sensitivityRows = RATES.map(r => {
    const d  = compoundSeries(initial, r / 100, years, monthly, compFreq)
    const fb = d.balance[d.balance.length - 1]
    const tc = d.contributions[d.contributions.length - 1]
    return { rate: r, balance: fb, interest: fb - tc, multiple: tc > 0 ? fb / tc : 0 }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">💰 複利計算器</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar controls */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">參數設定</h2>

            <Slider label="初始本金" value={initial} min={0} max={5_000_000} step={10_000}
              format={fmt} onChange={setInitial} />
            <Slider label="每月定投" value={monthly} min={0} max={200_000} step={1_000}
              format={fmt} onChange={setMonthly} />
            <Slider label="年化利率" value={rate} min={0} max={20} step={0.1}
              format={v => `${v.toFixed(1)}%`} onChange={setRate} />
            <Slider label="投資年限" value={years} min={1} max={50} step={1}
              format={v => `${v} 年`} onChange={setYears} />

            <div className="mb-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">複利頻率</label>
              <div className="grid grid-cols-2 gap-1">
                {Object.keys(FREQ_MAP).map(f => (
                  <button key={f} onClick={() => setFreq(f)}
                    className={`py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      freq === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>{f}</button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 space-y-5">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '最終餘額',    value: fmt(finalBalance),                   color: 'text-blue-700'  },
              { label: '總投入本金',  value: fmt(totalContrib),                   color: 'text-gray-700'  },
              { label: '累計利息',    value: fmt(totalInterest),                  color: 'text-green-600' },
              { label: '實際 CAGR',   value: `${(effectiveCagr * 100).toFixed(2)}%`, color: 'text-purple-600' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className={`text-lg font-bold mt-1 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">
              複利成長曲線（{freq}複利，年利率 {rate.toFixed(1)}%）
            </h2>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" label={{ value: '年', position: 'insideRight', offset: 10 }}
                  tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${(v/10000).toFixed(0)}萬`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend />
                <Area type="monotone" dataKey="本金"  stackId="1" stroke="#636EFA" fill="rgba(99,110,250,0.3)" />
                <Area type="monotone" dataKey="利息"  stackId="1" stroke="#EF553B" fill="rgba(239,85,59,0.3)"  />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sensitivity table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">利率敏感度分析</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['年化利率','最終餘額','利息收益','本金倍數'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivityRows.map(row => (
                    <tr key={row.rate}
                      className={`border-b border-gray-50 ${row.rate === rate ? 'bg-blue-50' : ''}`}>
                      <td className="py-2 pr-4 font-medium">{row.rate}%</td>
                      <td className="py-2 pr-4">{fmt(row.balance)}</td>
                      <td className="py-2 pr-4 text-green-600">{fmt(row.interest)}</td>
                      <td className="py-2 pr-4">{row.multiple.toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
