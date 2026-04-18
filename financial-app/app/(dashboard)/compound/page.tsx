'use client'
import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { compoundSeries, cagr } from '@/lib/math-engine'
import ScenarioBar from '@/components/ScenarioBar'
import { downloadCSV } from '@/lib/csv-export'
import { D } from '@/lib/design'

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
        <label className="text-xs" style={{ color: D.muted }}>{label}</label>
        <span className="text-xs font-semibold" style={{ color: D.ink }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: D.accent }} />
    </div>
  )
}

export default function CompoundPage() {
  const [initial, setInitial] = useState(1_000_000)
  const [monthly, setMonthly] = useState(10_000)
  const [rate, setRate]       = useState(7)
  const [years, setYears]     = useState(20)
  const [freq, setFreq]       = useState('每月')

  const currentParams = { initial, monthly, rate, years, freq }
  const handleLoad = (p: Record<string, unknown>) => {
    if (typeof p.initial === 'number') setInitial(p.initial)
    if (typeof p.monthly === 'number') setMonthly(p.monthly)
    if (typeof p.rate    === 'number') setRate(p.rate)
    if (typeof p.years   === 'number') setYears(p.years)
    if (typeof p.freq    === 'string') setFreq(p.freq)
  }

  const compFreq   = FREQ_MAP[freq]
  const annualRate = rate / 100
  const data       = compoundSeries(initial, annualRate, years, monthly, compFreq)

  const step = Math.max(1, Math.floor(data.years.length / 100))
  const chartData = data.years
    .filter((_, i) => i % step === 0 || i === data.years.length - 1)
    .map((_, i) => {
      const idx = Math.min(i * step, data.years.length - 1)
      return { year: data.years[idx].toFixed(1), 本金: Math.round(data.contributions[idx]), 利息: Math.round(data.interest[idx]) }
    })

  const finalBalance  = data.balance[data.balance.length - 1]
  const totalContrib  = data.contributions[data.contributions.length - 1]
  const totalInterest = data.interest[data.interest.length - 1]
  const effectiveCagr = cagr(initial, finalBalance, years)

  const handleExport = () => {
    downloadCSV('複利計算.csv', ['年', '本金', '利息', '總餘額'],
      chartData.map(r => [r.year, r.本金, r.利息, r.本金 + r.利息]))
  }

  const sensitivityRows = RATES.map(r => {
    const d = compoundSeries(initial, r / 100, years, monthly, compFreq)
    const fb = d.balance[d.balance.length - 1]
    const tc = d.contributions[d.contributions.length - 1]
    return { rate: r, balance: fb, interest: fb - tc, multiple: tc > 0 ? fb / tc : 0 }
  })

  return (
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: D.ink }}>複利計算器</h1>

      <div className="mb-4">
        <ScenarioBar page="compound" currentParams={currentParams} onLoad={handleLoad} onExport={handleExport} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-60 shrink-0">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>參數設定</p>
            <Slider label="初始本金" value={initial} min={0} max={5_000_000} step={10_000} format={fmt} onChange={setInitial} />
            <Slider label="每月定投" value={monthly} min={0} max={200_000} step={1_000} format={fmt} onChange={setMonthly} />
            <Slider label="年化利率" value={rate} min={0} max={20} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setRate} />
            <Slider label="投資年限" value={years} min={1} max={50} step={1} format={v => `${v} 年`} onChange={setYears} />
            <p className="text-xs mb-2" style={{ color: D.muted }}>複利頻率</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.keys(FREQ_MAP).map(f => (
                <button key={f} onClick={() => setFreq(f)}
                  className="py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ backgroundColor: freq === f ? D.ink : D.bg, color: freq === f ? D.bg : D.muted }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '最終餘額',   value: fmt(finalBalance),                       accent: true  },
              { label: '總投入本金', value: fmt(totalContrib),                       accent: false },
              { label: '累計利息',   value: fmt(totalInterest),                      accent: false },
              { label: '實際 CAGR',  value: `${(effectiveCagr * 100).toFixed(2)}%`, accent: false },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
                <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
                <p className="text-base font-bold" style={{ color: m.accent ? D.accent : D.ink }}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>複利成長曲線 — {freq}複利，年利率 {rate.toFixed(1)}%</p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="year" label={{ value: '年', position: 'insideRight', offset: 10 }}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/10000).toFixed(0)}萬`}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="本金" stackId="1" stroke="var(--ink)" fill="var(--ink)" fillOpacity={0.08} strokeWidth={1.5} />
                <Area type="monotone" dataKey="利息" stackId="1" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>利率敏感度分析</p>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                  {['年化利率','最終餘額','利息收益','本金倍數'].map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-xs font-medium" style={{ color: D.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sensitivityRows.map(row => (
                  <tr key={row.rate} style={{ borderBottom: `1px solid var(--subtle)`, opacity: row.rate === rate ? 1 : 0.6 }}>
                    <td className="py-2 pr-4 font-semibold" style={{ color: row.rate === rate ? D.accent : D.ink }}>{row.rate}%</td>
                    <td className="py-2 pr-4" style={{ color: D.ink }}>{fmt(row.balance)}</td>
                    <td className="py-2 pr-4" style={{ color: D.muted }}>{fmt(row.interest)}</td>
                    <td className="py-2" style={{ color: D.muted }}>{row.multiple.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
