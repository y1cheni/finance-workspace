'use client'
import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
         Legend, ResponsiveContainer } from 'recharts'
import { generateStatements } from '@/lib/statement-engine'
import ScenarioBar from '@/components/ScenarioBar'
import { downloadCSV } from '@/lib/csv-export'
import { D } from '@/lib/design'
import Slider from '@/components/Slider'
import FormulaPanel from '@/components/FormulaPanel'

function fmt(n: number) { return `NT$ ${n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}` }

const FORMULAS = [
  {
    name: '淨資產（Net Worth）',
    formula: 'NW = 總資產 − 總負債',
    vars: [
      { sym: '總資產', desc: '現金 + 投資 + 不動產 + 其他' },
      { sym: '總負債', desc: '各類貸款餘額合計' },
    ],
  },
  {
    name: '儲蓄率',
    formula: '儲蓄率 = (總收入 − 總支出) / 總收入 × 100%',
  },
  {
    name: '負債比（Debt-to-Assets）',
    formula: 'D/A = 總負債 / 總資產 × 100%',
    vars: [
      { sym: 'D/A < 30%', desc: '健康' },
      { sym: 'D/A 30~50%', desc: '注意' },
      { sym: 'D/A > 50%', desc: '高風險' },
    ],
  },
  {
    name: '投資收益（年化）',
    formula: '投資收益 = 投資組合 × 年化報酬率',
  },
]

function NumberInput({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <label className="text-xs block mb-1" style={{ color: D.muted }}>{label}</label>
      <input type="number" value={value} step={10000}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
        style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
    </div>
  )
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

  const currentParams = { cash, investments, realEstate, otherAssets, liabilities, income, expenses, invRet, reGrowth, incGrowth, expGrowth, paydown, projYears }

  const handleLoad = (params: Record<string, unknown>) => {
    if (typeof params.cash        === 'number') setCash(params.cash)
    if (typeof params.investments === 'number') setInvestments(params.investments)
    if (typeof params.realEstate  === 'number') setRealEstate(params.realEstate)
    if (typeof params.otherAssets === 'number') setOtherAssets(params.otherAssets)
    if (typeof params.liabilities === 'number') setLiabilities(params.liabilities)
    if (typeof params.income      === 'number') setIncome(params.income)
    if (typeof params.expenses    === 'number') setExpenses(params.expenses)
    if (typeof params.invRet      === 'number') setInvRet(params.invRet)
    if (typeof params.reGrowth    === 'number') setReGrowth(params.reGrowth)
    if (typeof params.incGrowth   === 'number') setIncGrowth(params.incGrowth)
    if (typeof params.expGrowth   === 'number') setExpGrowth(params.expGrowth)
    if (typeof params.paydown     === 'number') setPaydown(params.paydown)
    if (typeof params.projYears   === 'number') setProjYears(params.projYears)
  }

  const handleExport = () => {
    if (activeTab === 'bs') {
      const headers = ['年', '現金', '投資', '不動產', '總資產', '負債', '淨值', '負債比%']
      const rows = records.map(r => [r.year, r.cash, r.investments, r.realEstate, r.totalAssets, r.liabilities, r.netWorth, r.debtToAssets])
      downloadCSV('資產負債表.csv', headers, rows)
    } else {
      const headers = ['年', '薪資收入', '投資收益', '總收入', '總支出', '淨收入', '儲蓄率%']
      const rows = records.map(r => [r.year, r.annualIncome, r.investmentIncome, r.totalIncome, r.annualExpenses, r.netIncome, r.savingsRate])
      downloadCSV('損益表.csv', headers, rows)
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
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: D.ink }}>財務報表</h1>

      <div className="mb-4">
        <ScenarioBar page="statements" currentParams={currentParams} onLoad={handleLoad} onExport={handleExport} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-60 shrink-0">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>資產負債（現況）</p>
            <NumberInput label="現金 / 存款 (NT$)" value={cash}        onChange={setCash} />
            <NumberInput label="投資組合 (NT$)"     value={investments} onChange={setInvestments} />
            <NumberInput label="不動產 (NT$)"       value={realEstate}  onChange={setRealEstate} />
            <NumberInput label="其他資產 (NT$)"     value={otherAssets} onChange={setOtherAssets} />
            <NumberInput label="負債 (NT$)"         value={liabilities} onChange={setLiabilities} />

            <div className="my-4" style={{ borderTop: `1px solid var(--subtle)` }} />
            <p className="text-xs mb-3" style={{ color: D.muted }}>每月收支</p>
            <Slider label="每月收入" value={income}   min={20_000} max={500_000} step={5_000}
              format={fmt} onChange={setIncome} />
            <Slider label="每月支出" value={expenses} min={10_000} max={300_000} step={5_000}
              format={fmt} onChange={setExpenses} />

            <div className="my-4" style={{ borderTop: `1px solid var(--subtle)` }} />
            <p className="text-xs mb-3" style={{ color: D.muted }}>成長假設（年化）</p>
            <Slider label="投資報酬率"       value={invRet}    min={0} max={20} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setInvRet} />
            <Slider label="不動產增值"       value={reGrowth}  min={0} max={10} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setReGrowth} />
            <Slider label="收入成長率"       value={incGrowth} min={0} max={10} step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setIncGrowth} />
            <Slider label="支出成長（通膨）" value={expGrowth} min={0} max={8}  step={0.1} format={v => `${v.toFixed(1)}%`} onChange={setExpGrowth} />
            <NumberInput label="每年還款本金 (NT$)" value={paydown} onChange={setPaydown} />
            <Slider label="預測年限" value={projYears} min={5} max={40} step={1}
              format={v => `${v} 年`} onChange={setProjYears} />
          </div>
        </aside>

        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '目前淨值',             value: fmt(today.netWorth),                 accent: true  },
              { label: `${projYears} 年後淨值`, value: fmt(final.netWorth),                accent: false },
              { label: '目前儲蓄率',           value: `${today.savingsRate.toFixed(1)}%`,  accent: false },
              { label: '目前負債比',           value: `${today.debtToAssets.toFixed(1)}%`, accent: false },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
                <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
                <p className="text-base font-bold" style={{ color: m.accent ? D.accent : D.ink }}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>資產結構與淨值（B/S）</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={bsChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Math.abs(Number(v)))}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="現金"   stackId="a" fill="var(--ink)"    fillOpacity={0.7} />
                <Bar dataKey="投資"   stackId="a" fill="var(--ink)"    fillOpacity={0.5} />
                <Bar dataKey="不動產" stackId="a" fill="var(--ink)"    fillOpacity={0.3} />
                <Bar dataKey="其他"   stackId="a" fill="var(--muted)"  fillOpacity={0.3} />
                <Line type="monotone" dataKey="淨值" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-4" style={{ color: D.muted }}>損益表（P/L）趨勢</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={plChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}萬`}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="總收入" stroke="var(--ink)"    strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="總支出" stroke="var(--muted)"  strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="淨收入" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="flex gap-2 mb-4">
              {(['bs', 'pl'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ backgroundColor: activeTab === tab ? D.ink : D.bg, color: activeTab === tab ? D.bg : D.muted }}
                >{tab === 'bs' ? '資產負債表' : '損益表'}</button>
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
    </div>
  )
}
