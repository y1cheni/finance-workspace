'use client'
import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
         Legend, ResponsiveContainer } from 'recharts'
import { generateStatements } from '@/lib/statement-engine'

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

function NumberInput({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <input type="number" value={value} step={10000}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

const COLORS: Record<string, string> = {
  現金: '#636EFA', 投資: '#EF553B', 不動產: '#00CC96', 其他: '#AB63FA', 負債: '#FFA15A',
}

export default function StatementsPage() {
  const [cash,        setCash]        = useState(500_000)
  const [investments, setInvestments] = useState(1_000_000)
  const [realEstate,  setRealEstate]  = useState(3_000_000)
  const [otherAssets, setOtherAssets] = useState(0)
  const [liabilities, setLiabilities] = useState(2_000_000)
  const [income,      setIncome]      = useState(80_000)
  const [expenses,    setExpenses]    = useState(50_000)
  const [invRet,      setInvRet]      = useState(7)
  const [reGrowth,    setReGrowth]    = useState(3)
  const [incGrowth,   setIncGrowth]   = useState(2)
  const [expGrowth,   setExpGrowth]   = useState(2)
  const [paydown,     setPaydown]     = useState(200_000)
  const [projYears,   setProjYears]   = useState(20)
  const [activeTab,   setActiveTab]   = useState<'bs' | 'pl'>('bs')

  const records = generateStatements({
    cash, investments, realEstate, otherAssets, liabilities,
    monthlyIncome: income, monthlyExpenses: expenses,
    investmentReturn: invRet / 100, realEstateGrowth: reGrowth / 100,
    incomeGrowth: incGrowth / 100, expenseGrowth: expGrowth / 100,
    liabilityPaydown: paydown, years: projYears,
  })

  const today = records[0]
  const final = records[records.length - 1]

  const bsChartData = records.map(r => ({
    year: `Y${r.year}`,
    現金: r.cash, 投資: r.investments, 不動產: r.realEstate, 其他: r.otherAssets,
    負債: -r.liabilities, 淨值: r.netWorth,
  }))

  const plChartData = records.map(r => ({
    year: `Y${r.year}`,
    總收入: r.totalIncome, 總支出: r.annualExpenses, 淨收入: r.netIncome,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">📋 財務報表視覺化</h1>
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Controls */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">資產負債（現況）</h2>
            <NumberInput label="現金 / 存款 (NT$)" value={cash}        onChange={setCash} />
            <NumberInput label="投資組合 (NT$)"     value={investments} onChange={setInvestments} />
            <NumberInput label="不動產 (NT$)"       value={realEstate}  onChange={setRealEstate} />
            <NumberInput label="其他資產 (NT$)"     value={otherAssets} onChange={setOtherAssets} />
            <NumberInput label="負債 (NT$)"         value={liabilities} onChange={setLiabilities} />

            <hr className="my-3 border-gray-100" />
            <h2 className="font-semibold text-gray-800 mb-3">每月收支</h2>
            <Slider label="每月收入" value={income}   min={20_000} max={500_000} step={5_000}
              format={fmt} onChange={setIncome} />
            <Slider label="每月支出" value={expenses} min={10_000} max={300_000} step={5_000}
              format={fmt} onChange={setExpenses} />

            <hr className="my-3 border-gray-100" />
            <h2 className="font-semibold text-gray-800 mb-3">成長假設（年化）</h2>
            <Slider label="投資報酬率"       value={invRet}    min={0} max={20} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setInvRet} />
            <Slider label="不動產增值"       value={reGrowth}  min={0} max={10} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setReGrowth} />
            <Slider label="收入成長率"       value={incGrowth} min={0} max={10} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setIncGrowth} />
            <Slider label="支出成長（通膨）" value={expGrowth} min={0} max={8}  step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setExpGrowth} />
            <NumberInput label="每年還款本金 (NT$)" value={paydown} onChange={setPaydown} />
            <Slider label="預測年限" value={projYears} min={5} max={40} step={1}
              format={v => `${v} 年`} onChange={setProjYears} />
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 space-y-5">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '目前淨值',             value: fmt(today.netWorth),                 color: 'text-blue-700'   },
              { label: `${projYears} 年後淨值`, value: fmt(final.netWorth),                color: 'text-green-600'  },
              { label: '目前儲蓄率',           value: `${today.savingsRate.toFixed(1)}%`,  color: 'text-purple-600' },
              { label: '目前負債比',           value: `${today.debtToAssets.toFixed(1)}%`, color: 'text-orange-500' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className={`text-lg font-bold mt-1 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* B/S chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">資產結構與淨值（B/S）</h2>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={bsChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmt(Math.abs(Number(v)))} />
                <Legend />
                {Object.keys(COLORS).map(k => (
                  <Bar key={k} dataKey={k} stackId="a" fill={COLORS[k]} />
                ))}
                <Line type="monotone" dataKey="淨值" stroke="#111" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* P/L chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">損益表（P/L）趨勢</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={plChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="總收入" stroke="#00CC96" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="總支出" stroke="#EF553B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="淨收入" stroke="#636EFA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tables */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex gap-2 mb-4">
              {(['bs', 'pl'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>{t === 'bs' ? '📊 資產負債表' : '📈 損益表'}</button>
              ))}
            </div>
            <div className="overflow-x-auto">
              {activeTab === 'bs' ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['年','現金','投資','不動產','總資產','負債','淨值','負債比'].map(h => (
                        <th key={h} className="text-left py-2 pr-3 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.year} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 pr-3 font-medium">{r.year}</td>
                        <td className="py-1.5 pr-3">{fmt(r.cash)}</td>
                        <td className="py-1.5 pr-3">{fmt(r.investments)}</td>
                        <td className="py-1.5 pr-3">{fmt(r.realEstate)}</td>
                        <td className="py-1.5 pr-3 font-medium">{fmt(r.totalAssets)}</td>
                        <td className="py-1.5 pr-3 text-orange-500">{fmt(r.liabilities)}</td>
                        <td className="py-1.5 pr-3 text-blue-700 font-medium">{fmt(r.netWorth)}</td>
                        <td className="py-1.5">{r.debtToAssets}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['年','薪資收入','投資收益','總收入','總支出','淨收入','儲蓄率'].map(h => (
                        <th key={h} className="text-left py-2 pr-3 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.year} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 pr-3 font-medium">{r.year}</td>
                        <td className="py-1.5 pr-3">{fmt(r.annualIncome)}</td>
                        <td className="py-1.5 pr-3 text-green-600">{fmt(r.investmentIncome)}</td>
                        <td className="py-1.5 pr-3">{fmt(r.totalIncome)}</td>
                        <td className="py-1.5 pr-3 text-red-500">{fmt(r.annualExpenses)}</td>
                        <td className="py-1.5 pr-3 text-blue-700 font-medium">{fmt(r.netIncome)}</td>
                        <td className="py-1.5">{r.savingsRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
