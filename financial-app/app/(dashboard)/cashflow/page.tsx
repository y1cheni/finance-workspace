'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase'

const PRIMARY   = '#96B3D1'
const SECONDARY = '#94A3B8'

const INCOME_CATS  = ['薪資', '獎金', '投資收益', '副業', '其他收入']
const EXPENSE_CATS = ['餐飲', '交通', '居住', '訂閱', '教育', '娛樂', '醫療', '服飾', '雜支']

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

function fmt(n: number) {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

export default function CashflowPage() {
  const [txns, setTxns]       = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft]     = useState(EMPTY_DRAFT)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
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

  // 月篩選
  const monthTxns = txns.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth
  })

  const monthIncome  = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthNet     = monthIncome - monthExpense
  const savingsRate  = monthIncome > 0 ? (monthNet / monthIncome) * 100 : 0

  // 年度月別趨勢
  const monthlyChart = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const mt = txns.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === viewYear && d.getMonth() + 1 === m
    })
    return {
      month: `${m}月`,
      收入: mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      支出: mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    }
  })

  // 類別分析（當月支出）
  const catExpense = EXPENSE_CATS.map(cat => ({
    cat,
    amount: monthTxns.filter(t => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0),
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)

  if (loading) return <div className="min-h-[40vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200" style={{ borderTopColor: PRIMARY }} />
  </div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">收支記錄</h1>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: PRIMARY }}>
          + 新增
        </button>
      </div>

      {/* 月份切換 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => {
          if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
          else setViewMonth(m => m - 1)
        }} className="px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-sm text-gray-500 hover:bg-gray-50">←</button>
        <span className="text-sm font-medium text-gray-700 w-24 text-center">{viewYear} / {String(viewMonth).padStart(2,'0')}</span>
        <button onClick={() => {
          if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
          else setViewMonth(m => m + 1)
        }} className="px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-sm text-gray-500 hover:bg-gray-50">→</button>
      </div>

      {/* 摘要 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '本月收入',  value: fmt(monthIncome),            primary: false },
          { label: '本月支出',  value: fmt(monthExpense),           primary: false },
          { label: '本月淨額',  value: fmt(monthNet),               primary: true  },
          { label: '儲蓄率',   value: `${savingsRate.toFixed(1)}%`, primary: false },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400">{m.label}</p>
            <p className="text-lg font-bold mt-1" style={{
              color: m.label === '本月淨額'
                ? monthNet >= 0 ? PRIMARY : '#EF4444'
                : m.primary ? PRIMARY : '#374151'
            }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          {/* 年趨勢 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-gray-700">{viewYear} 年度收支趨勢</p>
              <div className="flex gap-2">
                <button onClick={() => setViewYear(y => y - 1)} className="text-xs text-gray-400 hover:text-gray-700">← {viewYear-1}</button>
                <button onClick={() => setViewYear(y => y + 1)} className="text-xs text-gray-400 hover:text-gray-700">{viewYear+1} →</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ border: '1px solid #F3F4F6', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="收入" fill={PRIMARY} radius={[3,3,0,0]} />
                <Bar dataKey="支出" fill={SECONDARY} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 本月明細 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">本月明細</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['日期', '類型', '類別', '金額', '備注', ''].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-xs text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthTxns.map(t => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-500 text-xs">{t.date}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: t.type === 'income' ? '#D1FAE5' : '#FEE2E2',
                                   color: t.type === 'income' ? '#065F46' : '#991B1B' }}>
                          {t.type === 'income' ? '收入' : '支出'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{t.category}</td>
                      <td className="py-2 pr-4 font-semibold"
                        style={{ color: t.type === 'income' ? '#059669' : '#374151' }}>
                        {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                      </td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{t.note ?? '—'}</td>
                      <td className="py-2">
                        <button onClick={() => del(t.id)} className="text-xs text-gray-300 hover:text-red-400">刪除</button>
                      </td>
                    </tr>
                  ))}
                  {monthTxns.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-300">本月尚無記錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 類別分析 */}
        <div className="lg:w-64 shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">本月支出類別</p>
            {catExpense.length === 0
              ? <p className="text-xs text-gray-300 py-4 text-center">尚無支出</p>
              : catExpense.map(c => (
                <div key={c.cat} className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{c.cat}</span>
                    <span>{fmt(c.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full" style={{
                      width: `${Math.min(100, (c.amount / monthExpense) * 100)}%`,
                      backgroundColor: PRIMARY,
                    }} />
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* 新增 Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <p className="text-base font-semibold text-gray-900 mb-4">新增記錄</p>
            <div className="flex gap-2 mb-4">
              {(['expense', 'income'] as const).map(type => (
                <button key={type} onClick={() => setDraft(p => ({
                  ...p, type,
                  category: type === 'income' ? '薪資' : '餐飲',
                }))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={draft.type === type ? { backgroundColor: PRIMARY, color: 'white' } : { backgroundColor: '#F9FAFB', color: '#6B7280' }}>
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
                <label className="text-sm text-gray-600 block mb-1">{f.label}</label>
                <input type={f.type} value={(draft as any)[f.key] ?? ''}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            ))}
            <div className="mb-4">
              <label className="text-sm text-gray-600 block mb-1">類別</label>
              <select value={draft.category}
                onChange={e => setDraft(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {(draft.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-50 text-gray-600">取消</button>
              <button onClick={save}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: PRIMARY }}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
