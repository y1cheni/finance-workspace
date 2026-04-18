'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase'

const PRIMARY = '#96B3D1'

interface Debt {
  id: string
  name: string
  debt_type: string
  original_amount: number
  remaining: number
  monthly_payment: number
  annual_rate: number
  end_date: string | null
}

const EMPTY: Omit<Debt, 'id'> = {
  name: '', debt_type: '信貸', original_amount: 0, remaining: 0,
  monthly_payment: 0, annual_rate: 0, end_date: null,
}

const TYPES = ['信貸', '房貸', '車貸', '學貸', '信用卡', '其他']

function fmt(n: number) {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

// 雪球法：最小餘額優先
function snowball(debts: Debt[], extraPayment: number) {
  let ds = debts.map(d => ({ ...d, rem: d.remaining }))
  let month = 0
  while (ds.some(d => d.rem > 0) && month < 600) {
    month++
    let extra = extraPayment
    ds = ds
      .sort((a, b) => a.rem - b.rem)
      .map(d => {
        if (d.rem <= 0) return d
        const interest = d.rem * (d.annual_rate / 100 / 12)
        let pay = d.monthly_payment + extra
        extra = Math.max(0, pay - d.rem - interest)
        d.rem = Math.max(0, d.rem + interest - pay)
        return d
      })
  }
  return month
}

// 雪崩法：最高利率優先
function avalanche(debts: Debt[], extraPayment: number) {
  let ds = debts.map(d => ({ ...d, rem: d.remaining }))
  let month = 0
  while (ds.some(d => d.rem > 0) && month < 600) {
    month++
    let extra = extraPayment
    ds = ds
      .sort((a, b) => b.annual_rate - a.annual_rate)
      .map(d => {
        if (d.rem <= 0) return d
        const interest = d.rem * (d.annual_rate / 100 / 12)
        let pay = d.monthly_payment + extra
        extra = Math.max(0, pay - d.rem - interest)
        d.rem = Math.max(0, d.rem + interest - pay)
        return d
      })
  }
  return month
}

export default function DebtsPage() {
  const [debts, setDebts]   = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [draft, setDraft]   = useState<Omit<Debt, 'id'>>(EMPTY)
  const [income, setIncome] = useState(60000)
  const [extra, setExtra]   = useState(0)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('debts').select('*').order('remaining', { ascending: false }).then(({ data }) => {
      setDebts((data ?? []) as Debt[])
      setLoading(false)
    })
  }, [])

  const openNew  = () => { setEditing(null); setDraft(EMPTY); setShowForm(true) }
  const openEdit = (d: Debt) => { setEditing(d); setDraft({ ...d }); setShowForm(true) }

  const save = async () => {
    if (!draft.name || draft.remaining <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editing) {
      await supabase.from('debts').update(draft).eq('id', editing.id)
      setDebts(prev => prev.map(d => d.id === editing.id ? { ...editing, ...draft } : d))
    } else {
      const { data } = await supabase.from('debts').insert({ ...draft, user_id: user.id }).select().single()
      if (data) setDebts(prev => [...prev, data as Debt])
    }
    setShowForm(false)
  }

  const del = async (id: string) => {
    await supabase.from('debts').delete().eq('id', id)
    setDebts(prev => prev.filter(d => d.id !== id))
  }

  const totalDebt    = debts.reduce((s, d) => s + d.remaining, 0)
  const totalPayment = debts.reduce((s, d) => s + d.monthly_payment, 0)
  const totalAssets  = 0  // placeholder — user enters manually if needed
  const dti          = income > 0 ? (totalPayment / income) * 100 : 0

  const sbMonths = debts.length > 0 ? snowball(debts, extra) : 0
  const avMonths = debts.length > 0 ? avalanche(debts, extra) : 0

  const chartData = debts.map(d => ({
    name: d.name,
    剩餘: d.remaining,
    原始: d.original_amount - d.remaining,
  }))

  if (loading) return <div className="min-h-[40vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200" style={{ borderTopColor: PRIMARY }} />
  </div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">負債管理</h1>
        <button onClick={openNew}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: PRIMARY }}>
          + 新增負債
        </button>
      </div>

      {/* 摘要 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '總負債餘額',  value: fmt(totalDebt),              primary: true  },
          { label: '每月還款合計', value: fmt(totalPayment),           primary: false },
          { label: 'DTI 比率',   value: `${dti.toFixed(1)}%`,         primary: false },
          { label: '負債筆數',   value: `${debts.length} 筆`,          primary: false },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400">{m.label}</p>
            <p className="text-lg font-bold mt-1" style={{
              color: m.label === 'DTI 比率'
                ? dti > 36 ? '#EF4444' : dti > 28 ? '#F59E0B' : PRIMARY
                : m.primary ? PRIMARY : '#374151'
            }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* DTI 說明 */}
      {dti > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex items-center gap-4">
          <label className="text-sm text-gray-500 shrink-0">每月收入（計算 DTI 用）</label>
          <input type="number" value={income} step={5000}
            onChange={e => setIncome(Number(e.target.value))}
            className="w-36 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
          <p className="text-xs text-gray-400 ml-2">
            {dti <= 28 ? 'DTI ≤ 28%：健康' : dti <= 36 ? 'DTI 28~36%：注意' : 'DTI > 36%：高風險，建議減少負債'}
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          {/* 列表 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['名稱', '類型', '剩餘金額', '每月還款', '年利率', '還清日', ''].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-xs text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {debts.map(d => (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-700">{d.name}</td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">{d.debt_type}</td>
                      <td className="py-2 pr-4 font-semibold" style={{ color: PRIMARY }}>{fmt(d.remaining)}</td>
                      <td className="py-2 pr-4 text-gray-600">{fmt(d.monthly_payment)}</td>
                      <td className="py-2 pr-4 text-gray-500">{d.annual_rate}%</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{d.end_date ?? '—'}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(d)} className="text-xs text-gray-400 hover:text-gray-700">編輯</button>
                          <button onClick={() => del(d.id)} className="text-xs text-gray-400 hover:text-red-500">刪除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {debts.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-300">尚無負債項目</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 圖表 */}
          {debts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">負債結構</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis type="number" tickFormatter={v => `${(v/10000).toFixed(0)}萬`}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ border: '1px solid #F3F4F6', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="剩餘" stackId="a" fill={PRIMARY} />
                  <Bar dataKey="原始" stackId="a" fill="#E5E7EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 還款策略 */}
        {debts.length > 0 && (
          <div className="lg:w-72 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">還款策略比較</p>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">每月額外還款 (NT$)</label>
                <input type="number" value={extra} step={1000}
                  onChange={e => setExtra(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="space-y-3 mt-4">
                {[
                  { name: '雪球法（餘額小→大）', months: sbMonths, desc: '先還最小筆，心理成就感強' },
                  { name: '雪崩法（利率高→低）', months: avMonths, desc: '先還利率最高，總利息最少' },
                ].map(s => (
                  <div key={s.name} className="p-3 rounded-xl" style={{ backgroundColor: '#F9FAFB' }}>
                    <p className="text-xs font-semibold text-gray-700">{s.name}</p>
                    <p className="text-lg font-bold mt-1" style={{ color: PRIMARY }}>
                      {s.months >= 600 ? '600+ 個月' : `${s.months} 個月`}
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        （{s.months < 600 ? `約 ${(s.months / 12).toFixed(1)} 年` : '請增加還款額'}）
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 表單 Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <p className="text-base font-semibold text-gray-900 mb-4">{editing ? '編輯負債' : '新增負債'}</p>
            <div className="mb-3">
              <label className="text-sm text-gray-600 block mb-1">名稱</label>
              <input type="text" value={draft.name}
                onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="mb-3">
              <label className="text-sm text-gray-600 block mb-1">類型</label>
              <select value={draft.debt_type} onChange={e => setDraft(p => ({ ...p, debt_type: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { label: '原始金額 (NT$)',  key: 'original_amount' },
              { label: '剩餘金額 (NT$)',  key: 'remaining'       },
              { label: '每月還款 (NT$)',  key: 'monthly_payment' },
              { label: '年利率 (%)',      key: 'annual_rate'     },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-sm text-gray-600 block mb-1">{f.label}</label>
                <input type="number" value={(draft as any)[f.key]}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            ))}
            <div className="mb-3">
              <label className="text-sm text-gray-600 block mb-1">預計還清日（選填）</label>
              <input type="date" value={draft.end_date ?? ''}
                onChange={e => setDraft(p => ({ ...p, end_date: e.target.value || null }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex gap-3 mt-4">
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
