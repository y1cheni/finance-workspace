'use client'
import { useEffect, useState } from 'react'
import {
  ComposedChart, BarChart, Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'
import CsvImportModal from '@/components/CsvImportModal'

const INCOME_CATS  = ['薪資', '獎金', '投資收益', '副業', '其他收入']
const EXPENSE_CATS = ['餐飲', '交通', '居住', '訂閱', '教育', '娛樂', '醫療', '服飾', '雜支']
const CAT_COLORS   = ['#1c1c1e','#4f9cf9','#8b5cf6','#f59e0b','#10b981','#ef4444','#6366f1','#f97316','#06b6d4']

interface Txn {
  id: string
  date: string
  type: 'income' | 'expense'
  category: string
  amount: number
  note: string | null
}

const EMPTY_DRAFT = {
  date: new Date().toISOString().slice(0, 10),
  type: 'expense' as 'income' | 'expense',
  category: '餐飲',
  amount: 0,
  note: '',
}

function fmt(n: number) { return `NT$ ${Math.round(n).toLocaleString('zh-TW')}` }

export default function CashflowPage() {
  const [txns, setTxns]           = useState<Txn[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [draft, setDraft]           = useState(EMPTY_DRAFT)
  const [viewYear, setViewYear]   = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('transactions').select('*').order('date', { ascending: false }).then(({ data }) => {
      setTxns((data ?? []) as Txn[])
      setLoading(false)
    })
  }, [])

  const save = async () => {
    if (draft.amount <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('transactions')
      .insert({ ...draft, user_id: user.id, note: draft.note || null })
      .select().single()
    if (data) setTxns(prev => [data as Txn, ...prev])
    setShowForm(false)
    setDraft(EMPTY_DRAFT)
  }

  const del = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(prev => prev.filter(t => t.id !== id))
  }

  const monthTxns = txns.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth
  })

  const monthIncome  = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthNet     = monthIncome - monthExpense
  const savingsRate  = monthIncome > 0 ? (monthNet / monthIncome) * 100 : 0

  const monthlyChart = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const mt = txns.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === viewYear && d.getMonth() + 1 === m
    })
    const inc = mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return {
      month: `${m}月`,
      收入: inc,
      支出: exp,
      淨額: inc - exp,
      儲蓄率: inc > 0 ? Math.round((inc - exp) / inc * 100) : 0,
    }
  })

  const catExpense = EXPENSE_CATS.map(cat => ({
    cat,
    amount: monthTxns.filter(t => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0),
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: D.accent }} />
    </div>
  )

  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: D.ink }}>收支記錄</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.surface, color: D.muted, border: `1px solid var(--subtle)` }}>
            ↑ 匯入 CSV
          </button>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.ink, color: D.bg }}>
            + 新增
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => {
          if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
          else setViewMonth(m => m - 1)
        }} className="px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.surface, color: D.muted }}>←</button>
        <span className="text-xs font-medium w-24 text-center" style={{ color: D.ink }}>
          {viewYear} / {String(viewMonth).padStart(2,'0')}
        </span>
        <button onClick={() => {
          if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
          else setViewMonth(m => m + 1)
        }} className="px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.surface, color: D.muted }}>→</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '本月收入', value: fmt(monthIncome),            accent: false },
          { label: '本月支出', value: fmt(monthExpense),           accent: false },
          { label: '本月淨額', value: fmt(monthNet),               accent: true, danger: monthNet < 0 },
          { label: '儲蓄率',  value: `${savingsRate.toFixed(1)}%`, accent: false },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.danger ? D.danger : m.accent ? D.accent : D.ink }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          {/* 年度收支趨勢 + 淨額折線 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs" style={{ color: D.muted }}>{viewYear} 年度收支趨勢</p>
              <div className="flex gap-2">
                <button onClick={() => setViewYear(y => y - 1)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.muted }}>← {viewYear-1}</button>
                <button onClick={() => setViewYear(y => y + 1)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.muted }}>{viewYear+1} →</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="var(--subtle)" />
                <Bar dataKey="收入" fill="var(--ink)"    fillOpacity={0.75} radius={[3,3,0,0]} />
                <Bar dataKey="支出" fill="var(--accent)" fillOpacity={0.5}  radius={[3,3,0,0]} />
                <Line type="monotone" dataKey="淨額" stroke="var(--accent)" strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--accent)' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 儲蓄率趨勢 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs" style={{ color: D.muted }}>{viewYear} 各月儲蓄率（%）</p>
              <p className="text-xs font-semibold" style={{ color: savingsRate >= 20 ? D.accent : D.muted }}>
                本月 {savingsRate.toFixed(1)}%
              </p>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => `${v}%`}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                <ReferenceLine y={20} stroke="var(--accent)" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: '20%', fontSize: 10, fill: 'var(--muted)', position: 'right' }} />
                <Bar dataKey="儲蓄率" radius={[3,3,0,0]}>
                  {monthlyChart.map((entry, i) => (
                    <Cell key={i} fill={entry.儲蓄率 >= 20 ? 'var(--accent)' : entry.儲蓄率 >= 0 ? 'var(--muted)' : 'var(--danger)'}
                      fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 本月明細 */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>本月明細</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                    {['日期', '類型', '類別', '金額', '備注', ''].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-xs font-medium" style={{ color: D.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthTxns.map(t => (
                    <tr key={t.id} style={{ borderBottom: `1px solid var(--subtle)` }}>
                      <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{t.date}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: t.type === 'income' ? 'var(--bg)' : 'var(--subtle)',
                            color: t.type === 'income' ? D.accent : D.muted,
                          }}>
                          {t.type === 'income' ? '收入' : '支出'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: D.ink }}>{t.category}</td>
                      <td className="py-2 pr-4 font-semibold text-xs"
                        style={{ color: t.type === 'income' ? D.accent : D.ink }}>
                        {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>{t.note ?? '—'}</td>
                      <td className="py-2">
                        <button onClick={() => del(t.id)} className="text-xs transition-opacity hover:opacity-50" style={{ color: D.danger }}>刪除</button>
                      </td>
                    </tr>
                  ))}
                  {monthTxns.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-xs" style={{ color: D.muted }}>本月尚無記錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 右側：支出類別圓餅圖 */}
        <div className="lg:w-64 shrink-0 space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-3" style={{ color: D.muted }}>本月支出類別</p>
            {catExpense.length === 0
              ? <p className="text-xs py-4 text-center" style={{ color: D.muted }}>尚無支出</p>
              : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={catExpense.map(c => ({ name: c.cat, value: c.amount }))}
                        cx="50%" cy="50%" outerRadius={70} innerRadius={32} dataKey="value" paddingAngle={2}>
                        {catExpense.map((_, i) => (
                          <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmt(Number(v))}
                        contentStyle={{ backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {catExpense.map((c, i) => (
                      <div key={c.cat} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                          <span style={{ color: D.muted }}>{c.cat}</span>
                        </div>
                        <div className="text-right">
                          <span style={{ color: D.ink }}>{fmt(c.amount)}</span>
                          <span className="ml-1" style={{ color: D.muted, opacity: 0.6 }}>
                            {((c.amount / monthExpense) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            }
          </div>
        </div>
      </div>

      {showImport && (
        <CsvImportModal
          title="匯入收支記錄"
          templateCsv={[
            '日期,類型,類別,金額,備注',
            '2026-04-01,expense,餐飲,350,午餐',
            '2026-04-05,income,薪資,60000,四月薪資',
          ].join('\n')}
          templateFilename="收支記錄範本.csv"
          fields={[
            { key: 'date',     label: '日期', required: true,  type: 'date'   },
            { key: 'type',     label: '類型', type: 'text', defaultValue: 'expense',
              hint: 'income/expense 或 收入/支出' },
            { key: 'category', label: '類別', type: 'text', defaultValue: '雜支' },
            { key: 'amount',   label: '金額', required: true,  type: 'number' },
            { key: 'note',     label: '備注', type: 'text' },
          ]}
          validate={(rec) => {
            if ((rec.amount as number) <= 0) return '金額必須大於 0'
            return null
          }}
          onConfirm={async (records) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const TYPE_MAP: Record<string, string> = {
              income: 'income', expense: 'expense', 收入: 'income', 支出: 'expense',
            }
            const rows = records.map(r => ({
              date:     (r.date as string).split(' ')[0],
              type:     TYPE_MAP[r.type as string] ?? 'expense',
              category: (r.category as string) || '雜支',
              amount:   r.amount as number,
              note:     (r.note as string) || null,
              user_id:  user.id,
            }))
            const { data } = await supabase.from('transactions').insert(rows).select()
            if (data) setTxns(prev => [...(data as Txn[]), ...prev])
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: D.surface }}>
            <p className="text-sm font-semibold mb-4" style={{ color: D.ink }}>新增記錄</p>
            <div className="flex gap-2 mb-4">
              {(['expense', 'income'] as const).map(type => (
                <button key={type} onClick={() => setDraft(p => ({
                  ...p, type,
                  category: type === 'income' ? '薪資' : '餐飲',
                }))}
                  className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                  style={draft.type === type
                    ? { backgroundColor: D.ink, color: D.bg }
                    : { backgroundColor: D.bg, color: D.muted }}>
                  {type === 'income' ? '收入' : '支出'}
                </button>
              ))}
            </div>
            {[
              { label: '日期', key: 'date', type: 'date' },
              { label: '金額 (NT$)', key: 'amount', type: 'number' },
              { label: '備注（選填）', key: 'note', type: 'text' },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-xs block mb-1" style={{ color: D.muted }}>{f.label}</label>
                <input type={f.type} value={(draft as any)[f.key] ?? ''}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }} />
              </div>
            ))}
            <div className="mb-4">
              <label className="text-xs block mb-1" style={{ color: D.muted }}>類別</label>
              <select value={draft.category}
                onChange={e => setDraft(p => ({ ...p, category: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                {(draft.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.bg, color: D.muted }}>取消</button>
              <button onClick={save}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.ink, color: D.bg }}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
