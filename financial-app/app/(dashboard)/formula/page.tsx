'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { D } from '@/lib/design'

/* ─── Types ─── */
interface Variable {
  id: string
  sym: string        // e.g. "r"
  name: string       // e.g. "年利率"
  unit: string       // e.g. "%"
  defaultVal: number
  min: number
  max: number
  step: number
}

interface Formula {
  id: string
  name: string
  description: string
  expression: string  // e.g. "P * Math.pow(1 + r/100, n)"
  variables: Variable[]
  chartVar: string    // which variable to use as x-axis
  createdAt: string
}

/* ─── Safe expression evaluator ─── */
function safeEval(expression: string, vars: Record<string, number>): number | null {
  try {
    // allow only safe chars: digits, operators, spaces, parens, dots, letters
    if (/[^0-9a-zA-Z_\s\+\-\*\/\(\)\.\^%,]/.test(expression)) return null
    // replace ^ with **
    const expr = expression.replace(/\^/g, '**')
    const fn = new Function(...Object.keys(vars), `"use strict"; return (${expr})`)
    const result = fn(...Object.values(vars))
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

/* ─── Storage ─── */
const STORAGE_KEY = 'fintool-formulas'

function loadFormulas(): Formula[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveFormulas(formulas: Formula[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formulas))
}

/* ─── Defaults ─── */
const EXAMPLE_FORMULAS: Formula[] = [
  {
    id: 'example-compound',
    name: '複利終值',
    description: '本金在年化報酬率 r% 下，經過 n 年後的終值',
    expression: 'P * Math.pow(1 + r / 100, n)',
    variables: [
      { id: 'v1', sym: 'P', name: '初始本金', unit: 'NT$', defaultVal: 1000000, min: 10000, max: 10000000, step: 50000 },
      { id: 'v2', sym: 'r', name: '年化報酬率', unit: '%', defaultVal: 7, min: 0, max: 20, step: 0.5 },
      { id: 'v3', sym: 'n', name: '年數', unit: '年', defaultVal: 20, min: 1, max: 50, step: 1 },
    ],
    chartVar: 'n',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'example-retirement',
    name: '退休目標金額',
    description: '依月支出與提領年數估算所需退休資產（4% 法則變形）',
    expression: 'monthly * 12 * years',
    variables: [
      { id: 'v1', sym: 'monthly', name: '退休後月支出', unit: 'NT$', defaultVal: 60000, min: 20000, max: 200000, step: 5000 },
      { id: 'v2', sym: 'years', name: '提領年數', unit: '年', defaultVal: 30, min: 10, max: 50, step: 1 },
    ],
    chartVar: 'years',
    createdAt: new Date().toISOString(),
  },
]

function newVar(): Variable {
  return { id: Date.now().toString(), sym: '', name: '', unit: '', defaultVal: 0, min: 0, max: 100, step: 1 }
}

function fmtResult(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 10000).toFixed(1)} 萬`
  if (Math.abs(n) >= 1_000)     return n.toLocaleString('zh-TW', { maximumFractionDigits: 1 })
  return n.toFixed(4).replace(/\.?0+$/, '')
}

/* ─── Main ─── */
export default function FormulaPage() {
  const [formulas, setFormulas]   = useState<Formula[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [values,   setValues]     = useState<Record<string, number>>({})
  const [editMode, setEditMode]   = useState(false)
  const [draft,    setDraft]      = useState<Formula | null>(null)
  const [exprError, setExprError] = useState('')

  /* Load from localStorage on mount */
  useEffect(() => {
    const stored = loadFormulas()
    const all = stored.length > 0 ? stored : EXAMPLE_FORMULAS
    setFormulas(all)
    if (all.length > 0) selectFormula(all[0], all)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectFormula(f: Formula, list?: Formula[]) {
    const all = list ?? formulas
    const found = all.find(x => x.id === f.id) ?? f
    setSelected(found.id)
    const defaults: Record<string, number> = {}
    found.variables.forEach(v => { defaults[v.sym] = v.defaultVal })
    setValues(defaults)
    setEditMode(false)
  }

  const currentFormula = formulas.find(f => f.id === selected) ?? null

  /* Result */
  const result = useMemo(() => {
    if (!currentFormula) return null
    return safeEval(currentFormula.expression, values)
  }, [currentFormula, values])

  /* Chart data — vary chartVar from min to max */
  const chartData = useMemo(() => {
    if (!currentFormula) return []
    const xVar = currentFormula.variables.find(v => v.sym === currentFormula.chartVar)
    if (!xVar) return []
    const steps = 40
    const stepSize = (xVar.max - xVar.min) / steps
    return Array.from({ length: steps + 1 }, (_, i) => {
      const xVal = xVar.min + i * stepSize
      const vars = { ...values, [xVar.sym]: xVal }
      const y = safeEval(currentFormula.expression, vars)
      return { [xVar.sym]: parseFloat(xVal.toFixed(2)), 結果: y !== null ? parseFloat(y.toFixed(2)) : null }
    })
  }, [currentFormula, values])

  /* Save formulas */
  const persistFormulas = useCallback((next: Formula[]) => {
    setFormulas(next)
    saveFormulas(next)
  }, [])

  /* Delete */
  const deleteFormula = (id: string) => {
    const next = formulas.filter(f => f.id !== id)
    persistFormulas(next)
    if (selected === id) {
      if (next.length > 0) selectFormula(next[0], next)
      else setSelected(null)
    }
  }

  /* Open new / edit */
  const openNew = () => {
    setDraft({
      id: Date.now().toString(),
      name: '',
      description: '',
      expression: '',
      variables: [newVar()],
      chartVar: '',
      createdAt: new Date().toISOString(),
    })
    setEditMode(true)
  }
  const openEdit = () => {
    if (!currentFormula) return
    setDraft(JSON.parse(JSON.stringify(currentFormula)))
    setEditMode(true)
  }

  /* Save draft */
  const saveDraft = () => {
    if (!draft) return
    if (!draft.name.trim() || !draft.expression.trim()) {
      setExprError('名稱與公式不可為空')
      return
    }
    // test expression
    const testVars: Record<string, number> = {}
    draft.variables.forEach(v => { testVars[v.sym || 'x'] = v.defaultVal })
    const testResult = safeEval(draft.expression, testVars)
    if (testResult === null) {
      setExprError('公式語法有誤，請確認符號與變數名稱')
      return
    }
    setExprError('')
    const existing = formulas.find(f => f.id === draft.id)
    const next = existing
      ? formulas.map(f => f.id === draft.id ? draft : f)
      : [...formulas, draft]
    persistFormulas(next)
    selectFormula(draft, next)
    setEditMode(false)
    setDraft(null)
  }

  /* ── EDITOR panel ── */
  if (editMode && draft) return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { setEditMode(false); setDraft(null) }}
          className="text-sm transition-opacity hover:opacity-50" style={{ color: D.muted }}>← 返回</button>
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>
          {draft.id && formulas.find(f => f.id === draft.id) ? '編輯公式' : '新增公式'}
        </h1>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Name & description */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
          <div className="mb-3">
            <label className="text-xs block mb-1" style={{ color: D.muted }}>公式名稱</label>
            <input value={draft.name} onChange={e => setDraft(d => d && ({ ...d, name: e.target.value }))}
              placeholder="例：複利終值" className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: D.muted }}>說明（選填）</label>
            <input value={draft.description} onChange={e => setDraft(d => d && ({ ...d, description: e.target.value }))}
              placeholder="這個公式計算什麼？" className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
          </div>
        </div>

        {/* Variables */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium" style={{ color: D.ink }}>變數定義</p>
            <button onClick={() => setDraft(d => d && ({ ...d, variables: [...d.variables, newVar()] }))}
              className="text-xs transition-opacity hover:opacity-70" style={{ color: D.accent }}>+ 新增變數</button>
          </div>
          <div className="space-y-3">
            {draft.variables.map((v, i) => (
              <div key={v.id} className="rounded-xl p-3" style={{ backgroundColor: D.bg }}>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: D.muted }}>符號（公式中用）</label>
                    <input value={v.sym} onChange={e => setDraft(d => d && ({ ...d, variables: d.variables.map((x, j) => j === i ? { ...x, sym: e.target.value } : x) }))}
                      placeholder="r" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      style={{ backgroundColor: D.surface, color: D.ink, border: `1px solid var(--subtle)` }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: D.muted }}>名稱</label>
                    <input value={v.name} onChange={e => setDraft(d => d && ({ ...d, variables: d.variables.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))}
                      placeholder="年利率" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      style={{ backgroundColor: D.surface, color: D.ink, border: `1px solid var(--subtle)` }} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {(['min', 'max', 'defaultVal', 'step'] as const).map(field => (
                    <div key={field}>
                      <label className="text-xs block mb-1" style={{ color: D.muted }}>
                        {field === 'defaultVal' ? '預設值' : field === 'step' ? '步進' : field}
                      </label>
                      <input type="number" value={(v as unknown as Record<string, number>)[field]}
                        onChange={e => setDraft(d => d && ({ ...d, variables: d.variables.map((x, j) => j === i ? { ...x, [field]: Number(e.target.value) } : x) }))}
                        className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: D.surface, color: D.ink, border: `1px solid var(--subtle)` }} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs" style={{ color: D.muted }}>單位</label>
                    <input value={v.unit} onChange={e => setDraft(d => d && ({ ...d, variables: d.variables.map((x, j) => j === i ? { ...x, unit: e.target.value } : x) }))}
                      placeholder="%" className="w-16 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      style={{ backgroundColor: D.surface, color: D.ink, border: `1px solid var(--subtle)` }} />
                  </div>
                  {draft.variables.length > 1 && (
                    <button onClick={() => setDraft(d => d && ({ ...d, variables: d.variables.filter((_, j) => j !== i) }))}
                      className="text-xs transition-opacity hover:opacity-50" style={{ color: D.muted }}>移除</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expression */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
          <label className="text-xs block mb-2" style={{ color: D.ink }}>公式表達式</label>
          <p className="text-xs mb-3" style={{ color: D.muted }}>
            使用上方定義的變數符號，支援 +、-、*、/、^（次方）、Math.pow()、Math.sqrt()、Math.log()
          </p>
          <input value={draft.expression}
            onChange={e => { setDraft(d => d && ({ ...d, expression: e.target.value })); setExprError('') }}
            placeholder='P * Math.pow(1 + r / 100, n)'
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none font-mono"
            style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid ${exprError ? '#ef4444' : 'var(--subtle)'}` }} />
          {exprError && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{exprError}</p>}

          {/* Chart variable */}
          <div className="mt-3">
            <label className="text-xs block mb-1" style={{ color: D.muted }}>圖表 X 軸（選一個變數做範圍圖）</label>
            <div className="flex flex-wrap gap-2">
              {draft.variables.filter(v => v.sym).map(v => (
                <button key={v.id} onClick={() => setDraft(d => d && ({ ...d, chartVar: v.sym }))}
                  className="px-3 py-1 rounded-lg text-xs transition-opacity hover:opacity-70"
                  style={{ backgroundColor: draft.chartVar === v.sym ? D.accent : D.bg, color: draft.chartVar === v.sym ? '#fff' : D.muted }}>
                  {v.sym} {v.name && `(${v.name})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setEditMode(false); setDraft(null) }}
            className="flex-1 py-2.5 rounded-xl text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.surface, color: D.muted }}>取消</button>
          <button onClick={saveDraft}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.accent, color: '#fff' }}>儲存公式</button>
        </div>
      </div>
    </div>
  )

  /* ── CALCULATOR view ── */
  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: D.ink }}>自定義公式</h1>
          <p className="text-xs mt-0.5" style={{ color: D.muted }}>建立並計算你自己的財務公式</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.accent, color: '#fff' }}>+ 新增公式</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Formula list ── */}
        <aside className="lg:w-56 shrink-0 space-y-1.5">
          {formulas.length === 0 && (
            <p className="text-xs px-3" style={{ color: D.muted }}>尚無公式，點右上「+ 新增公式」開始</p>
          )}
          {formulas.map(f => (
            <button key={f.id} onClick={() => selectFormula(f)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-opacity hover:opacity-70"
              style={{ backgroundColor: selected === f.id ? D.surface : 'transparent', color: selected === f.id ? D.ink : D.muted }}>
              <p className="text-xs font-medium truncate">{f.name}</p>
              {f.description && <p className="text-xs truncate mt-0.5 opacity-60">{f.description}</p>}
            </button>
          ))}
        </aside>

        {/* ── Calculator ── */}
        {currentFormula ? (
          <div className="flex-1 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold" style={{ color: D.ink }}>{currentFormula.name}</h2>
                {currentFormula.description && (
                  <p className="text-xs mt-0.5" style={{ color: D.muted }}>{currentFormula.description}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={openEdit}
                  className="px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-70"
                  style={{ backgroundColor: D.surface, color: D.muted }}>編輯</button>
                <button onClick={() => deleteFormula(currentFormula.id)}
                  className="px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-70"
                  style={{ backgroundColor: D.surface, color: '#ef4444' }}>刪除</button>
              </div>
            </div>

            {/* Expression display */}
            <div className="rounded-xl px-4 py-2.5" style={{ backgroundColor: D.surface }}>
              <span className="text-xs font-mono" style={{ color: D.muted }}>{currentFormula.expression}</span>
            </div>

            {/* Result */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs mb-1" style={{ color: D.muted }}>計算結果</p>
              <p className="text-3xl font-bold" style={{ color: result !== null ? D.accent : '#ef4444' }}>
                {result !== null ? fmtResult(result) : '⚠ 公式錯誤'}
              </p>
            </div>

            {/* Sliders */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs font-medium mb-4" style={{ color: D.muted }}>調整變數</p>
              <div className="space-y-3">
                {currentFormula.variables.map(v => (
                  <div key={v.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: D.ink }}>{v.name || v.sym} <span style={{ color: D.muted }}>({v.sym})</span></span>
                      <span className="font-medium" style={{ color: D.ink }}>{values[v.sym] ?? v.defaultVal} {v.unit}</span>
                    </div>
                    <input
                      type="range"
                      min={v.min} max={v.max} step={v.step}
                      value={values[v.sym] ?? v.defaultVal}
                      onChange={e => setValues(prev => ({ ...prev, [v.sym]: Number(e.target.value) }))}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <div className="flex justify-between text-xs mt-0.5" style={{ color: D.muted, opacity: 0.5 }}>
                      <span>{v.min} {v.unit}</span>
                      <span>{v.max} {v.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart */}
            {currentFormula.chartVar && chartData.length > 0 && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
                <p className="text-xs mb-4" style={{ color: D.muted }}>
                  結果 vs {currentFormula.variables.find(v => v.sym === currentFormula.chartVar)?.name ?? currentFormula.chartVar}
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                    <XAxis dataKey={currentFormula.chartVar} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => fmtResult(v)} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: unknown) => [fmtResult(Number(v)), '結果']}
                      contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="結果" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Variable summary table */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <p className="text-xs font-medium mb-3" style={{ color: D.muted }}>目前變數值</p>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                    {['符號', '名稱', '目前值', '範圍', '單位'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 font-medium" style={{ color: D.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentFormula.variables.map(v => (
                    <tr key={v.id} style={{ borderBottom: `1px solid var(--subtle)` }}>
                      <td className="py-1.5 pr-4 font-mono font-medium" style={{ color: D.accent }}>{v.sym}</td>
                      <td className="py-1.5 pr-4" style={{ color: D.ink }}>{v.name}</td>
                      <td className="py-1.5 pr-4 font-medium" style={{ color: D.ink }}>{values[v.sym] ?? v.defaultVal}</td>
                      <td className="py-1.5 pr-4" style={{ color: D.muted }}>{v.min} – {v.max}</td>
                      <td className="py-1.5" style={{ color: D.muted }}>{v.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: D.muted }}>
            <p className="text-sm">點擊左側公式，或新增一個開始</p>
          </div>
        )}
      </div>
    </div>
  )
}
