'use client'
import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
         Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import { compoundSeries, annuityPv, monthlySavingsNeeded, yearsToTarget } from '@/lib/math-engine'
import ScenarioBar from '@/components/ScenarioBar'
import { downloadCSV } from '@/lib/csv-export'

const PRIMARY   = '#96B3D1'
const SECONDARY = '#94A3B8'

function fmt(n: number) { return `NT$ ${n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}` }

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-gray-600">{label}</label>
        <span className="text-sm font-semibold text-gray-900">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: PRIMARY }} />
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

  const currentParams = { currentAge, retirementAge, lifeExp, savings, monthlyExp, annualReturn, inflation, mode }

  const handleLoad = (params: Record<string, unknown>) => {
    if (typeof params.currentAge    === 'number') setCurrentAge(params.currentAge)
    if (typeof params.retirementAge === 'number') setRetirementAge(params.retirementAge)
    if (typeof params.lifeExp       === 'number') setLifeExp(params.lifeExp)
    if (typeof params.savings       === 'number') setSavings(params.savings)
    if (typeof params.monthlyExp    === 'number') setMonthlyExp(params.monthlyExp)
    if (typeof params.annualReturn  === 'number') setAnnualReturn(params.annualReturn)
    if (typeof params.inflation     === 'number') setInflation(params.inflation)
    if (params.mode === 'fixed' || params.mode === '4pct') setMode(params.mode)
  }

  const handleExport = () => {
    const headers = ['年齡', '累計投入', '利息成長', '總資產']
    const rows = accData.map(r => [r.age, r.累計投入, r.利息成長, r.累計投入 + r.利息成長])
    downloadCSV('退休規劃.csv', headers, rows)
  }

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
        }
      })
  })() : []

  const drawData: { age: string; 資產餘額: number }[] = []
  let bal = target
  const mr = r / 12
  for (let m = 0; m <= yearsInR * 12; m++) {
    drawData.push({ age: (retAge + m / 12).toFixed(1), 資產餘額: Math.max(0, Math.round(bal)) })
    bal = Math.max(0, bal * (1 + mr) - monthlyExp)
  }
  const remaining = drawData[drawData.length - 1]['資產餘額']

  const scenarios = [5000, 10000, 20000, 30000, 50000, 80000, 100000].map(amt => {
    const d  = compoundSeries(savings, r, yearsToR, amt, 12)
    const fb = d.balance[d.balance.length - 1]
    const yr = yearsToTarget(target, savings, amt, r)
    return { amt, balance: fb, gap: fb - target, targetAge: currentAge + yr }
  })

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">退休規劃</h1>

      <div className="mb-4">
        <ScenarioBar page="retirement" currentParams={currentParams} onLoad={handleLoad} onExport={handleExport} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-68 shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">基本資料</p>
            <Slider label="目前年齡"     value={currentAge}    min={20} max={65} step={1}
              format={v => `${v} 歲`} onChange={setCurrentAge} />
            <Slider label="預計退休年齡" value={retirementAge} min={currentAge + 1} max={80} step={1}
              format={v => `${v} 歲`} onChange={setRetirementAge} />
            <Slider label="預期壽命"     value={lifeExp}       min={retAge + 1} max={100} step={1}
              format={v => `${v} 歲`} onChange={setLifeExp} />

            <hr className="my-3 border-gray-100" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">財務設定</p>
            <Slider label="目前存款"     value={savings}      min={0}      max={10_000_000} step={50_000}
              format={fmt} onChange={setSavings} />
            <Slider label="退休後月支出" value={monthlyExp}   min={10_000} max={200_000}    step={5_000}
              format={fmt} onChange={setMonthlyExp} />
            <Slider label="年化報酬率"   value={annualReturn} min={1}      max={15}          step={0.1}
              format={v => `${v.toFixed(1)}%`} onChange={setAnnualReturn} />
            <Slider label="通膨率"       value={inflation}    min={0}      max={6}            step={0.1}
              format={v => `${v.toFixed(1)}%`} onChange={setInflation} />

            <hr className="my-3 border-gray-100" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">提領方式</p>
            <div className="grid grid-cols-1 gap-1">
              {(['fixed', '4pct'] as const).map((v) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === v ? 'text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                  style={mode === v ? { backgroundColor: PRIMARY } : {}}
                >{v === 'fixed' ? '固定提領法' : '4% 法則'}</button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '退休目標金額', value: fmt(target),        primary: true  },
              { label: '每月需存入',   value: fmt(neededMonthly), primary: false },
              { label: '距退休年數',   value: `${yearsToR} 年`,   primary: false },
              { label: '退休後年數',   value: `${yearsInR} 年`,   primary: false },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400">{m.label}</p>
                <p className="text-lg font-bold mt-1 text-gray-900"
                   style={m.primary ? { color: PRIMARY } : {}}>{m.value}</p>
              </div>
            ))}
          </div>

          {yearsToR > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">資產累積曲線</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={accData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="age" label={{ value: '歲', position: 'insideRight', offset: 10 }}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v/10000).toFixed(0)}萬`}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ border: '1px solid #F3F4F6', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={target} stroke="#D1D5DB" strokeDasharray="6 3"
                    label={{ value: '退休目標', position: 'right', fontSize: 11, fill: '#9CA3AF' }} />
                  <Area type="monotone" dataKey="累計投入" stackId="1"
                    stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.15} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="利息成長" stackId="1"
                    stroke={SECONDARY} fill={SECONDARY} fillOpacity={0.2} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-4">退休提領模擬</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={drawData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="age" tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  label={{ value: '歲', position: 'insideRight', offset: 10 }}
                  axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/10000).toFixed(0)}萬`}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ border: '1px solid #F3F4F6', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#E5E7EB" strokeDasharray="4 2"
                  label={{ value: '資產耗盡', fill: '#9CA3AF', fontSize: 11 }} />
                <Area type="monotone" dataKey="資產餘額"
                  stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.15} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
            {remaining > 0
              ? <p className="mt-2 text-sm text-gray-500">{lifeExp} 歲時仍有 {fmt(remaining)} 剩餘</p>
              : <p className="mt-2 text-sm text-gray-500">依此條件資產將提前耗盡，建議增加月存款或調整目標</p>}
          </div>

          {yearsToR > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-medium text-gray-700 mb-3">情境比較</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['每月存入','退休時資產','vs 目標','達標年齡','足夠'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-xs text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map(s => (
                      <tr key={s.amt} className={`border-b border-gray-50 ${s.amt === Math.round(neededMonthly / 1000) * 1000 ? 'bg-gray-50' : ''}`}>
                        <td className="py-2 pr-4 font-medium text-gray-700">{fmt(s.amt)}</td>
                        <td className="py-2 pr-4 text-gray-600">{fmt(s.balance)}</td>
                        <td className="py-2 pr-4 text-gray-500">
                          {s.gap >= 0 ? '+' : '-'}{fmt(Math.abs(s.gap))}
                        </td>
                        <td className="py-2 pr-4 text-gray-500">
                          {s.targetAge === Infinity ? '—' : `${s.targetAge.toFixed(1)} 歲`}
                        </td>
                        <td className="py-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${s.balance >= target ? '' : 'bg-gray-300'}`}
                            style={s.balance >= target ? { backgroundColor: PRIMARY } : {}} />
                        </td>
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
