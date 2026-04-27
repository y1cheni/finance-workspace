'use client'
import { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { D } from '@/lib/design'
import Slider from '@/components/Slider'
import FormulaPanel from '@/components/FormulaPanel'

/* ─── Mortgage helpers ─── */
function monthlyPayment(principal: number, annualRate: number, years: number) {
  if (annualRate === 0) return principal / (years * 12)
  const r = annualRate / 100 / 12
  const n = years * 12
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function fmt(n: number) {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}
function fmtW(n: number) {
  return `${(n / 10000).toFixed(0)} 萬`
}

/* ─── Child cost data (from Excel / 六都平均) ─── */
const CHILD_STAGES = [
  {
    key: 'nursery', label: '幼兒園', sub: '未滿 7 歲', annualBase: 162000,
    items: [
      { name: '私立幼兒園月費（育兒補助後）', monthly: 6000 },
      { name: '娃娃車接送', monthly: 1500 },
      { name: '才藝社團', monthly: 1500 },
      { name: '餐費（早晚）', monthly: 3000 },
      { name: '醫療保健', monthly: 1000 },
      { name: '玩具文具衣物', monthly: 500 },
    ],
    years: 6,
  },
  {
    key: 'primary', label: '小學', sub: '7–12 歲', annualBase: 230000,
    items: [
      { name: '學雜費＋午餐（分攤月）', monthly: 333 },
      { name: '安親補習', monthly: 8000 },
      { name: '才藝社團', monthly: 1500 },
      { name: '餐費（早晚）', monthly: 3000 },
      { name: '醫療保健', monthly: 417 },
      { name: '玩具文具衣物', monthly: 1000 },
    ],
    years: 6,
  },
  {
    key: 'secondary', label: '國高中', sub: '13–18 歲', annualBase: 202000,
    items: [
      { name: '學雜費＋午餐（分攤月）', monthly: 417 },
      { name: '補習費', monthly: 8000 },
      { name: '才藝社團', monthly: 2000 },
      { name: '餐費（早晚）', monthly: 3000 },
      { name: '零用錢', monthly: 3000 },
    ],
    years: 6,
  },
  {
    key: 'university', label: '大學', sub: '19–22 歲', annualBase: 238000,
    items: [
      { name: '學雜費（分攤月）', monthly: 2917 },
      { name: '才藝社團', monthly: 2000 },
      { name: '餐費', monthly: 6000 },
      { name: '零用錢', monthly: 3000 },
    ],
    years: 4,
  },
]

const HOUSING_COSTS = [
  { name: '管理費', monthly: 2000, annual: null },
  { name: '水電瓦斯網路', monthly: 2000, annual: null },
  { name: '日常修繕', monthly: 500, annual: null },
  { name: '房屋稅＋地價稅', monthly: null, annual: 6000 },
]

const FORMULAS = [
  {
    name: '每月房貸還款（等額本息）',
    formula: 'M = P × r(1+r)ⁿ / ((1+r)ⁿ − 1)',
    vars: [
      { sym: 'P', desc: '貸款本金' },
      { sym: 'r', desc: '月利率 = 年利率 ÷ 12' },
      { sym: 'n', desc: '還款月數 = 年數 × 12' },
    ],
  },
  {
    name: '總利息支出',
    formula: '總利息 = M × n − P',
  },
  {
    name: '住居總成本（年化）',
    formula: '年住居成本 = 年房貸 + 管理費 + 水電 + 修繕 + 稅金',
  },
]

/* ─── Rent vs Buy helpers ─── */
function rentVsBuyData(params: {
  housePrice: number; downPmt: number; principal: number
  monthlyMortgage: number; monthlyRunning: number; monthlyRent: number
  mortgageRate: number; appreciationRate: number; opportunityRate: number; years: number
}) {
  const { housePrice, downPmt, principal, monthlyMortgage, monthlyRunning,
          monthlyRent, mortgageRate, appreciationRate, opportunityRate, years } = params
  const mr = mortgageRate / 100 / 12
  const or = opportunityRate / 100 / 12
  let mortgageBal = principal
  let rentPortfolio = downPmt                            // invest down payment
  const monthlySurplus = (monthlyMortgage + monthlyRunning) - monthlyRent

  const rows: { year: string; 買房淨值: number; 租房淨值: number }[] = [
    { year: 'Y0', 買房淨值: Math.round(downPmt / 10000), 租房淨值: Math.round(downPmt / 10000) },
  ]
  for (let yr = 1; yr <= years; yr++) {
    for (let m = 0; m < 12; m++) {
      const interest = mortgageBal * mr
      mortgageBal = Math.max(0, mortgageBal - (monthlyMortgage - interest))
    }
    rentPortfolio = rentPortfolio * Math.pow(1 + or, 12)
    if (monthlySurplus >= 0) {
      rentPortfolio += monthlySurplus * ((Math.pow(1 + or, 12) - 1) / (or || 0.001))
    } else {
      rentPortfolio = Math.max(0, rentPortfolio + monthlySurplus * 12)
    }
    const homeValue = housePrice * 10000 * Math.pow(1 + appreciationRate / 100, yr)
    rows.push({
      year: `Y${yr}`,
      買房淨值: Math.round((homeValue - mortgageBal) / 10000),
      租房淨值: Math.round(Math.max(0, rentPortfolio) / 10000),
    })
  }
  return rows
}

/* ─── Main ─── */
export default function HousingPage() {
  /* Mortgage inputs */
  const [housePrice, setHousePrice] = useState(1500)    // 萬
  const [downPct,    setDownPct]    = useState(20)       // %
  const [rate,       setRate]       = useState(1.58)
  const [termYears,  setTermYears]  = useState(30)

  /* Housing running costs */
  const [mgmt,    setMgmt]    = useState(2000)
  const [utility, setUtility] = useState(2000)
  const [repair,  setRepair]  = useState(500)
  const [tax,     setTax]     = useState(6000) // annual

  /* Rent vs buy */
  const [monthlyRent,     setMonthlyRent]     = useState(20000)
  const [appreciationRate, setAppreciationRate] = useState(2)
  const [opportunityRate,  setOpportunityRate]  = useState(6)
  const [compareYears,     setCompareYears]     = useState(20)

  /* Child */
  const [numChildren, setNumChildren] = useState(1)
  const [stageToggles, setStageToggles] = useState<Record<string, boolean>>({
    nursery: true, primary: true, secondary: true, university: true,
  })

  /* Mortgage calc */
  const principal = useMemo(() => housePrice * 10000 * (1 - downPct / 100), [housePrice, downPct])
  const monthly   = useMemo(() => monthlyPayment(principal, rate, termYears), [principal, rate, termYears])
  const totalPay  = monthly * termYears * 12
  const totalInt  = totalPay - principal

  /* Running costs */
  const annualRunning = (mgmt + utility + repair) * 12 + tax
  const monthlyRunning = annualRunning / 12
  const annualTotal = monthly * 12 + annualRunning

  /* Amortization chart (every 5 years) */
  const amortData = useMemo(() => {
    const r = rate / 100 / 12
    let balance = principal
    const result = []
    for (let yr = 0; yr <= termYears; yr += 5) {
      result.push({ year: `Y${yr}`, 剩餘本金: Math.max(0, Math.round(balance / 10000)), 年: yr })
      for (let m = 0; m < 5 * 12 && balance > 0; m++) {
        const interest = balance * r
        const principalPart = monthly - interest
        balance = Math.max(0, balance - principalPart)
      }
    }
    return result
  }, [principal, rate, termYears, monthly])

  /* Child cost calc */
  const activeStages = CHILD_STAGES.filter(s => stageToggles[s.key])
  const childTotalPerChild = activeStages.reduce((sum, s) => sum + s.annualBase * s.years, 0)
  const childTotal = childTotalPerChild * numChildren

  const childChartData = CHILD_STAGES.map(s => ({
    name: s.label,
    六都平均年費: Math.round(s.annualBase / 10000 * 10) / 10,
    active: stageToggles[s.key],
  }))

  return (
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-1" style={{ color: D.ink }}>房貸 & 養育費試算</h1>
      <p className="text-xs mb-6" style={{ color: D.muted }}>房貸速查、住居成本、子女養育費六都平均估算</p>

      {/* ── Section 1: Mortgage ── */}
      <div className="mb-6">
        <p className="text-xs font-medium mb-3" style={{ color: D.muted }}>房貸計算器</p>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Inputs */}
          <div className="lg:w-64 shrink-0 rounded-2xl p-5 space-y-1" style={{ backgroundColor: D.surface }}>
            <Slider label="房價（萬）"    value={housePrice} min={500}  max={6000} step={100} format={v => `${v} 萬`}    onChange={setHousePrice} />
            <Slider label="頭期款比例"    value={downPct}    min={10}   max={50}   step={1}   format={v => `${v}%`}      onChange={setDownPct} />
            <Slider label="年利率"        value={rate}       min={0.5}  max={5}    step={0.01} format={v => `${v.toFixed(2)}%`} onChange={setRate} />
            <div className="pt-1">
              <p className="text-xs mb-2" style={{ color: D.muted }}>還款年期</p>
              <div className="flex gap-2">
                {[20, 30, 40].map(y => (
                  <button key={y} onClick={() => setTermYears(y)}
                    className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ backgroundColor: termYears === y ? D.ink : D.bg, color: termYears === y ? D.bg : D.muted }}>
                    {y} 年
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 space-y-4">
            {/* Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '貸款本金',   value: fmtW(principal) },
                { label: '每月還款',   value: fmt(monthly),  accent: true },
                { label: '總利息支出', value: fmtW(totalInt) },
                { label: '還款總額',   value: fmtW(totalPay) },
              ].map(m => (
                <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
                  <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
                  <p className="text-base font-bold" style={{ color: m.accent ? D.accent : D.ink }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Amortization chart */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>剩餘本金趨勢（萬）</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={amortData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}萬`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => `${v} 萬`} contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="剩餘本金" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Running costs */}
        <div className="rounded-2xl p-5 mt-4" style={{ backgroundColor: D.surface }}>
          <p className="text-xs font-medium mb-4" style={{ color: D.muted }}>住居維持費用</p>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-1">
              <Slider label="管理費（月）"     value={mgmt}    min={0} max={10000} step={500} format={fmt} onChange={setMgmt} />
              <Slider label="水電瓦斯網路（月）" value={utility} min={0} max={10000} step={500} format={fmt} onChange={setUtility} />
              <Slider label="日常修繕（月）"    value={repair}  min={0} max={5000}  step={100} format={fmt} onChange={setRepair} />
              <div className="pt-1">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>稅金（年） — 房屋稅＋地價稅</label>
                <input type="number" value={tax} step={1000}
                  onChange={e => setTax(Number(e.target.value))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>
            </div>
            <div className="lg:w-64 shrink-0">
              <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: D.bg }}>
                {[
                  { label: '月房貸',     value: fmt(monthly) },
                  { label: '月維持費',   value: fmt(monthlyRunning) },
                  { label: '月住居總支出', value: fmt(monthly + monthlyRunning), accent: true },
                  { label: '年住居總支出', value: fmtW(annualTotal) },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-xs" style={{ borderBottom: r.accent ? `1px solid var(--subtle)` : undefined, paddingBottom: r.accent ? 8 : 0 }}>
                    <span style={{ color: D.muted }}>{r.label}</span>
                    <span className="font-medium" style={{ color: r.accent ? D.accent : D.ink }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Child rearing ── */}
      <div className="mb-6">
        <p className="text-xs font-medium mb-3" style={{ color: D.muted }}>子女養育費試算（六都平均）</p>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-64 shrink-0 rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="mb-4">
              <p className="text-xs mb-2" style={{ color: D.muted }}>子女數</p>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setNumChildren(n)}
                    className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ backgroundColor: numChildren === n ? D.ink : D.bg, color: numChildren === n ? D.bg : D.muted }}>
                    {n} 人
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs mb-2" style={{ color: D.muted }}>計入學齡階段</p>
            <div className="space-y-2">
              {CHILD_STAGES.map(s => (
                <label key={s.key} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setStageToggles(t => ({ ...t, [s.key]: !t[s.key] }))}
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-opacity hover:opacity-70"
                    style={{ backgroundColor: stageToggles[s.key] ? D.accent : D.bg, border: `1px solid var(--subtle)` }}>
                    {stageToggles[s.key] && <span className="text-white text-xs leading-none">✓</span>}
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: D.ink }}>{s.label}</p>
                    <p className="text-xs" style={{ color: D.muted }}>{s.sub}・{s.years} 年</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
                <p className="text-xs mb-1" style={{ color: D.muted }}>每位子女總費用（選取階段）</p>
                <p className="text-base font-bold" style={{ color: D.ink }}>{fmtW(childTotalPerChild)}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
                <p className="text-xs mb-1" style={{ color: D.muted }}>{numChildren} 位子女合計</p>
                <p className="text-base font-bold" style={{ color: D.accent }}>{fmtW(childTotal)}</p>
              </div>
            </div>

            {/* Stage detail cards */}
            <div className="grid grid-cols-2 gap-3">
              {CHILD_STAGES.map(s => (
                <div key={s.key} className="rounded-2xl p-4" style={{ backgroundColor: D.surface, opacity: stageToggles[s.key] ? 1 : 0.4 }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{ color: D.ink }}>{s.label}</p>
                    <p className="text-xs" style={{ color: D.muted }}>{s.sub}</p>
                  </div>
                  <p className="text-sm font-bold mb-2" style={{ color: D.accent }}>年 {fmtW(s.annualBase)}</p>
                  <div className="space-y-0.5">
                    {s.items.map(item => (
                      <div key={item.name} className="flex justify-between text-xs">
                        <span className="truncate pr-2" style={{ color: D.muted }}>{item.name}</span>
                        <span style={{ color: D.ink }}>{item.monthly.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-4" style={{ color: D.muted }}>各階段年費用比較（萬）</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={childChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}萬`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => `${v} 萬/年`} contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="六都平均年費" fill="var(--accent)" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Rent vs Buy ── */}
      <div className="mb-6">
        <p className="text-xs font-medium mb-3" style={{ color: D.muted }}>租 vs 買：{compareYears} 年後財富比較</p>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Rent vs Buy inputs */}
          <div className="lg:w-64 shrink-0 rounded-2xl p-5 space-y-1" style={{ backgroundColor: D.surface }}>
            <Slider label="月租金" value={monthlyRent} min={5000} max={80000} step={1000}
              format={fmt} onChange={setMonthlyRent} />
            <Slider label="房價年增值率" value={appreciationRate} min={0} max={8} step={0.1}
              format={v => `${v.toFixed(1)}%/年`} onChange={setAppreciationRate} />
            <Slider label="投資機會成本" value={opportunityRate} min={0} max={15} step={0.1}
              format={v => `${v.toFixed(1)}%/年`} onChange={setOpportunityRate} />
            <Slider label="比較年限" value={compareYears} min={5} max={40} step={1}
              format={v => `${v} 年`} onChange={setCompareYears} />
            <p className="text-xs pt-2" style={{ color: D.muted }}>
              機會成本：若將頭期款改為投資，每年預期報酬率
            </p>
          </div>

          {/* Rent vs Buy chart */}
          <div className="flex-1 space-y-4">
            {(() => {
              const rvbData = rentVsBuyData({
                housePrice, downPmt: principal === 0 ? housePrice * 10000 * downPct / 100 : housePrice * 10000 * downPct / 100,
                principal, monthlyMortgage: monthly, monthlyRunning,
                mortgageRate: rate, appreciationRate, opportunityRate,
                monthlyRent, years: compareYears,
              })
              const lastRow = rvbData[rvbData.length - 1]
              const buyWins = lastRow.買房淨值 > lastRow.租房淨值
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '買房 — 月支出', value: fmt(monthly + monthlyRunning) },
                      { label: '租房 — 月支出', value: fmt(monthlyRent) },
                      { label: `${compareYears} 年後較優`,
                        value: buyWins ? '買房' : '租房',
                        accent: true },
                    ].map(m => (
                      <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
                        <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
                        <p className="text-base font-bold" style={{ color: m.accent ? D.accent : D.ink }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs" style={{ color: D.muted }}>淨值比較（萬）— 頭期款 {fmtW(housePrice * 10000 * downPct / 100)}</p>
                      {lastRow && (
                        <p className="text-xs" style={{ color: D.accent }}>
                          {compareYears}年後差距 {Math.abs(lastRow.買房淨值 - lastRow.租房淨值)} 萬（{buyWins ? '買房多' : '租房多'}）
                        </p>
                      )}
                    </div>
                    <p className="text-xs mb-4" style={{ color: D.muted, opacity: 0.6 }}>
                      租房：頭期款投入市場 + 月省差額再投資　買房：房屋淨值（市值 − 剩餘貸款）
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={rvbData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                        <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false}
                          interval="preserveStartEnd" />
                        <YAxis tickFormatter={v => `${v}萬`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => `${v} 萬`}
                          contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="買房淨值" stroke="var(--ink)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="租房淨值" stroke="var(--accent)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs mt-3" style={{ color: D.muted }}>
                      注意：此模型為簡化試算，不含仲介費、裝潢、稅費、空置期等一次性成本。
                    </p>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      <FormulaPanel formulas={FORMULAS} />
    </div>
  )
}
