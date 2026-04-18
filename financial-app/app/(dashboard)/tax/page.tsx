'use client'
import { useState } from 'react'

const PRIMARY = '#96B3D1'

// 2025 Taiwan income tax brackets (申報 2025 年所得)
const BRACKETS = [
  { limit: 590_000,   rate: 0.05, deduct: 0        },
  { limit: 1_330_000, rate: 0.12, deduct: 41_300   },
  { limit: 2_660_000, rate: 0.20, deduct: 147_700  },
  { limit: 4_980_000, rate: 0.30, deduct: 413_700  },
  { limit: Infinity,  rate: 0.40, deduct: 911_700  },
]
const OVERSEAS_THRESHOLD = 6_700_000  // 海外所得免稅門檻

// 2025 扣除額
const STD_DEDUCTION   = 131_000  // 標準扣除額（單身）
const SALARY_DEDUCTION = 218_000  // 薪資所得特別扣除額
const BASIC_LIVING    = 202_000  // 基本生活費（每人）

function calcTax(netIncome: number) {
  for (const b of BRACKETS) {
    if (netIncome <= b.limit) return Math.max(0, netIncome * b.rate - b.deduct)
  }
  return 0
}

function fmt(n: number) {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

function pct(n: number) { return `${(n * 100).toFixed(2)}%` }

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold" style={{ color: highlight ? PRIMARY : '#374151' }}>{value}</span>
    </div>
  )
}

export default function TaxPage() {
  const [salary,     setSalary]     = useState(600_000)
  const [overseas,   setOverseas]   = useState(0)
  const [otherInc,   setOtherInc]   = useState(0)
  const [dependents, setDependents] = useState(0)
  const [useItemized, setItemized]  = useState(false)
  const [itemized,   setItemizedAmt] = useState(0)
  const [disability, setDisability] = useState(false)
  const [under6,     setUnder6]     = useState(0)
  const [rent,       setRent]       = useState(0)

  // 所得總額
  const totalIncome = salary + otherInc

  // 扣除額計算
  const basicDeduct   = useItemized ? itemized : STD_DEDUCTION
  const salaryDeduct  = Math.min(salary, SALARY_DEDUCTION)
  const disabiDeduct  = disability ? 218_000 : 0
  const childDeduct   = under6 * 150_000
  const rentDeduct    = Math.min(rent, 180_000)
  const dependDeduct  = dependents * 97_000
  const totalDeduct   = basicDeduct + salaryDeduct + disabiDeduct + childDeduct + rentDeduct + dependDeduct

  // 淨額
  const netIncome   = Math.max(0, totalIncome - totalDeduct)
  const tax         = calcTax(netIncome)
  const effectiveRate = totalIncome > 0 ? tax / totalIncome : 0

  // 海外所得判斷
  const overseasNote = overseas > 0
    ? overseas + totalIncome >= OVERSEAS_THRESHOLD
      ? `海外所得 ${fmt(overseas)} 超過免稅門檻，需合併計算最低稅負`
      : `海外所得 ${fmt(overseas)}，尚未達 ${fmt(OVERSEAS_THRESHOLD)} 門檻，本年免稅`
    : null

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">稅務試算</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左側輸入 */}
        <aside className="lg:w-72 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">所得來源</p>
            {[
              { label: '薪資所得 (NT$)',   val: salary,   set: setSalary   },
              { label: '其他所得 (NT$)',   val: otherInc, set: setOtherInc },
              { label: '海外所得 (NT$)',   val: overseas, set: setOverseas },
            ].map(({ label, val, set }) => (
              <div key={label} className="mb-3">
                <label className="text-sm font-medium text-gray-600 block mb-1">{label}</label>
                <input type="number" value={val} step={10000}
                  onChange={e => set(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                  style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
              </div>
            ))}

            <hr className="my-3 border-gray-100" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">扣除額</p>

            <div className="mb-3">
              <label className="text-sm font-medium text-gray-600 block mb-1">撫養人數</label>
              <input type="number" value={dependents} min={0} max={10}
                onChange={e => setDependents(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
            </div>

            <div className="mb-3">
              <label className="text-sm font-medium text-gray-600 block mb-1">6歲以下子女數</label>
              <input type="number" value={under6} min={0} max={5}
                onChange={e => setUnder6(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
            </div>

            <div className="mb-3">
              <label className="text-sm font-medium text-gray-600 block mb-1">房租支出 (NT$)</label>
              <input type="number" value={rent} step={1000}
                onChange={e => setRent(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
            </div>

            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={disability}
                onChange={e => setDisability(e.target.checked)}
                className="rounded" />
              <span className="text-sm text-gray-600">身心障礙扣除額</span>
            </label>

            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={useItemized}
                onChange={e => setItemized(e.target.checked)}
                className="rounded" />
              <span className="text-sm text-gray-600">使用列舉扣除額</span>
            </label>

            {useItemized && (
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-600 block mb-1">列舉扣除額合計 (NT$)</label>
                <input type="number" value={itemized} step={10000}
                  onChange={e => setItemizedAmt(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                  style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties} />
              </div>
            )}
          </div>
        </aside>

        {/* 右側結果 */}
        <div className="flex-1 space-y-4">
          {/* 摘要卡 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '應繳稅額',   value: fmt(tax),         primary: true  },
              { label: '有效稅率',   value: pct(effectiveRate), primary: false },
              { label: '課稅淨額',   value: fmt(netIncome),   primary: false },
              { label: '總扣除額',   value: fmt(totalDeduct), primary: false },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400">{m.label}</p>
                <p className="text-lg font-bold mt-1" style={{ color: m.primary ? PRIMARY : '#374151' }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* 計算明細 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">計算明細</p>
            <Row label="薪資所得" value={fmt(salary)} />
            <Row label="其他所得" value={fmt(otherInc)} />
            <Row label="所得總額" value={fmt(totalIncome)} />
            <div className="mt-2" />
            <Row label={useItemized ? '列舉扣除額' : `標準扣除額`} value={`−${fmt(basicDeduct)}`} />
            <Row label={`薪資特別扣除額（上限 ${fmt(SALARY_DEDUCTION)}）`} value={`−${fmt(salaryDeduct)}`} />
            {dependents > 0 && <Row label={`撫養扣除額 × ${dependents}`} value={`−${fmt(dependDeduct)}`} />}
            {under6 > 0     && <Row label={`幼兒學前扣除額 × ${under6}`} value={`−${fmt(childDeduct)}`} />}
            {rent > 0       && <Row label="房租支出扣除額" value={`−${fmt(rentDeduct)}`} />}
            {disability     && <Row label="身心障礙扣除額" value={`−${fmt(disabiDeduct)}`} />}
            <Row label="課稅淨額" value={fmt(netIncome)} highlight />
            <div className="mt-2" />
            <Row label="應繳稅額" value={fmt(tax)} highlight />
            <Row label="有效稅率" value={pct(effectiveRate)} />
          </div>

          {/* 稅率級距表 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">2025 累進稅率級距</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['課稅淨額', '稅率', '累進差額'].map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { range: '0 ～ 59 萬',    rate: '5%',  deduct: '—' },
                  { range: '59 ～ 133 萬',  rate: '12%', deduct: '41,300' },
                  { range: '133 ～ 266 萬', rate: '20%', deduct: '147,700' },
                  { range: '266 ～ 498 萬', rate: '30%', deduct: '413,700' },
                  { range: '498 萬以上',    rate: '40%', deduct: '911,700' },
                ].map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${netIncome <= [590000,1330000,2660000,4980000,Infinity][i] && (i===0 || netIncome > [0,590000,1330000,2660000,4980000][i]) ? 'bg-blue-50' : ''}`}>
                    <td className="py-1.5 pr-4 text-gray-600">{r.range}</td>
                    <td className="py-1.5 pr-4 font-semibold" style={{ color: PRIMARY }}>{r.rate}</td>
                    <td className="py-1.5 text-gray-500">{r.deduct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-3">藍色列為你目前適用的級距</p>
          </div>

          {/* 海外所得提示 */}
          {overseasNote && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{overseasNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
