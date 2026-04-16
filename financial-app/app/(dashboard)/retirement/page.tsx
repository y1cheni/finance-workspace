'use client'
import { useState } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
         Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import { compoundSeries, annuityPv, monthlySavingsNeeded, yearsToTarget } from '@/lib/math-engine'

function fmt(n: number) { return `NT$ ${n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}` }

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
    </div>
  )
}

export default function RetirementPage() {
  const [currentAge,    setCurrentAge]    = useState(30)
  const [retirementAge, setRetirementAge] = useState(60)
  const [lifeExp,       setLifeExp]       = useState(85)
  const [savings,       setSavings]       = useState(500_000)
  const [monthlyExp,    setMonthlyExp]    = useState(60_000)
  const [annualReturn,  setAnnualReturn]  = useState(7)
  const [inflation,     setInflation]     = useState(2)
  const [mode,          setMode]          = useState<'fixed' | '4pct'>('fixed')

  const retAge   = Math.max(retirementAge, currentAge + 1)
  const yearsToR = retAge - currentAge
  const yearsInR = lifeExp - retAge
  const months   = yearsToR * 12
  const r        = annualReturn / 100
  const inf      = inflation / 100
  const realR    = (1 + r) / (1 + inf) - 1
  const mRealR   = realR / 12

  const target = mode === '4pct'
    ? (monthlyExp * 12) / 0.04
    : (mRealR > 0 ? annuityPv(monthlyExp, mRealR, yearsInR * 12) : monthlyExp * yearsInR * 12)

  const neededMonthly = monthlySavingsNeeded(target, savings, r, months)

  // Accumulation chart
  const accData = yearsToR > 0 ? (() => {
    const d = compoundSeries(savings, r, yearsToR, neededMonthly, 12)
    const step = Math.max(1, Math.floor(d.years.length / 80))
    return d.years
      .filter((_, i) => i % step === 0 || i === d.years.length - 1)
      .map((_, i) => {
        const idx = Math.min(i * step, d.years.length - 1)
        return {
          age: (currentAge + d.years[idx]).toFixed(0),
          累計投入: Math.round(d.contributions[idx]),
          利息成長: Math.round(d.interest[idx]),
          總資產: Math.round(d.balance[idx]),
        }
      })
  })() : []

  // Drawdown chart
  const drawData: { age: string; 資產餘額: number }[] = []
  let bal = target
  const mr = r / 12
  for (let m = 0; m <= yearsInR * 12; m++) {
    drawData.push({ age: (retAge + m / 12).toFixed(1), 資產餘額: Math.max(0, Math.round(bal)) })
    bal = Math.max(0, bal * (1 + mr) - monthlyExp)
  }
  const remaining = drawData[drawData.length - 1]['資產餘額']

  // Scenarios
  const scenarios = [5000, 10000, 20000, 30000, 50000, 80000, 100000].map(amt => {
    const d  = compoundSeries(savings, r, yearsToR, amt, 12)
    const fb = d.balance[d.balance.length - 1]
    const yr = yearsToTarget(target, savings, amt, r)
    return { amt, balance: fb, gap: fb - target, targetAge: currentAge + yr }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">🎯 退休規劃反推</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Controls */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-1">
            <h2 className="font-semibold text-gray-800 mb-3">基本資料</h2>
            <Slider label="目前年齡"     value={currentAge}    min={20} max={65} step={1}
              format={v => `${v} 歲`} onChange={setCurrentAge} />
            <Slider label="預計退休年齡" value={retirementAge} min={currentAge + 1} max={80} step={1}
              format={v => `${v} 歲`} onChange={setRetirementAge} />
            <Slider label="預期壽命"     value={lifeExp}       min={retAge + 1} max={100} step={1}
              format={v => `${v} 歲`} onChange={setLifeExp} />

            <hr className="my-3 border-gray-100" />
            <h2 className="font-semibold text-gray-800 mb-3">財務設定</h2>
            <Slider label="目前存款" value={savings}    min={0} max={10_000_000} step={50_000}
              format={fmt} onChange={setSavings} />
            <Slider label="退休後月支出" value={monthlyExp} min={10_000} max={200_000} step={5_000}
              format={fmt} onChange={setMonthlyExp} />
            <Slider label="年化報酬率" value={annualReturn} min={1} max={15} step={0.1}
              format={v => `${v.toFixed(1)}%`} onChange={setAnnualReturn} />
            <Slider label="通膨率" value={inflation} min={0} max={6} step={0.1}
              format={v => `${v.toFixed(1)}%`} onChange={setInflation} />

            <hr className="my-3 border-gray-100" />
            <h2 className="font-semibold text-gray-800 mb-2">提領方式</h2>
            <div className="grid grid-cols-1 gap-1">
              {(['fixed', '4pct'] as const).map((v) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{v === 'fixed' ? '固定提領法' : '4% 法則'}</button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '退休目標金額', value: fmt(target),           color: 'text-blue-700'  },
              { label: '每月需存入',   value: fmt(neededMonthly),    color: 'text-red-600'   },
              { label: '距退休年數',   value: `${yearsToR} 年`,      color: 'text-gray-700'  },
              { label: '退休後年數',   value: `${yearsInR} 年`,      color: 'text-purple-600'},
            ].map(m => (
              <div key={m.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className={`text-lg font-bold mt-1 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Accumulation */}
          {yearsToR > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">資產累積曲線</h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={accData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="age" label={{ value: '歲', position: 'insideRight', offset: 10 }}
                    tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v/10000).toFixed(0)}萬`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Legend />
                  <ReferenceLine y={target} stroke="#16a34a" strokeDasharray="6 3"
                    label={{ value: '退休目標', position: 'right', fontSize: 11, fill: '#16a34a' }} />
                  <Area type="monotone" dataKey="累計投入" stackId="1" stroke="#636EFA" fill="rgba(99,110,250,0.3)" />
                  <Area type="monotone" dataKey="利息成長" stackId="1" stroke="#EF553B" fill="rgba(239,85,59,0.3)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Drawdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">退休提領模擬</h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={drawData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="age" tick={{ fontSize: 10 }}
                  label={{ value: '歲', position: 'insideRight', offset: 10 }} />
                <YAxis tickFormatter={v => `${(v/10000).toFixed(0)}萬`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2"
                  label={{ value: '資產耗盡', fill: '#ef4444', fontSize: 11 }} />
                <Area type="monotone" dataKey="資產餘額" stroke="#00CC96" fill="rgba(0,204,150,0.25)" />
              </AreaChart>
            </ResponsiveContainer>
            {remaining > 0
              ? <p className="mt-2 text-sm text-green-600 font-medium">✅ {lifeExp} 歲時仍有 {fmt(remaining)} 剩餘</p>
              : <p className="mt-2 text-sm text-red-500 font-medium">⚠️ 資產不足，建議增加月存款或調整目標</p>}
          </div>

          {/* Scenarios */}
          {yearsToR > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">情境比較</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['每月存入','退休時資產','vs 目標','達標年齡','足夠？'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map(s => (
                      <tr key={s.amt} className={`border-b border-gray-50 ${s.amt === Math.round(neededMonthly / 1000) * 1000 ? 'bg-blue-50' : ''}`}>
                        <td className="py-2 pr-4 font-medium">{fmt(s.amt)}</td>
                        <td className="py-2 pr-4">{fmt(s.balance)}</td>
                        <td className={`py-2 pr-4 ${s.gap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {s.gap >= 0 ? '▲ ' : '▼ '}{fmt(Math.abs(s.gap))}
                        </td>
                        <td className="py-2 pr-4">
                          {s.targetAge === Infinity ? '無法達標' : `${s.targetAge.toFixed(1)} 歲`}
                        </td>
                        <td className="py-2">{s.balance >= target ? '✅' : '❌'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
