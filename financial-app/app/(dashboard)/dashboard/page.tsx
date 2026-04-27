'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'

/* ─── Types ─── */
interface MonthlySummary { month: string; 收入: number; 支出: number }
interface GoalDef { id: string; label: string; goal: number; current: number; years: number; rate: number }

/* ─── Helpers ─── */
function fmt(n: number) { return `NT$ ${Math.abs(Math.round(n)).toLocaleString('zh-TW')}` }
function fmtShort(n: number) {
  const a = Math.abs(n)
  if (a >= 100_000_000) return `${(a / 100_000_000).toFixed(1)} 億`
  if (a >= 10_000)      return `${(a / 10_000).toFixed(1)} 萬`
  return a.toLocaleString('zh-TW')
}

function calcMonthly(fv: number, pv: number, years: number, rate: number): number {
  if (years <= 0) return 0
  const n = years * 12
  const r = rate / 100 / 12
  const pvGrown = pv * Math.pow(1 + r, n)
  const gap = fv - pvGrown
  if (gap <= 0) return 0
  if (r === 0) return gap / n
  return gap * r / (Math.pow(1 + r, n) - 1)
}

const PAGE_LINKS = [
  { href: '/compound',      icon: '∿', label: '複利計算器' },
  { href: '/retirement',    icon: '◎', label: '退休規劃'   },
  { href: '/statements',    icon: '▦', label: '財務報表'   },
  { href: '/budget',        icon: '◈', label: '預算管理'   },
  { href: '/cashflow',      icon: '⇅', label: '收支記錄'   },
  { href: '/goals',         icon: '◉', label: '目標儲蓄'   },
  { href: '/debts',         icon: '⊖', label: '負債管理'   },
  { href: '/portfolio',     icon: '⬡', label: '投資組合'   },
  { href: '/subscriptions', icon: '↺', label: '訂閱管理'   },
  { href: '/tax',           icon: '§', label: '稅務試算'   },
  { href: '/housing',       icon: '⌂', label: '房貸 & 養育' },
]

/* ─── Main ─── */
export default function DashboardPage() {
  const [loading, setLoading] = useState(true)

  /* Financial data */
  const [netWorth,     setNetWorth]     = useState<number | null>(null)
  const [totalAssets,  setTotalAssets]  = useState(0)
  const [totalLiab,    setTotalLiab]    = useState(0)
  const [monthIncome,  setMonthIncome]  = useState(0)
  const [monthExpense, setMonthExpense] = useState(0)
  const [subMonthly,   setSubMonthly]   = useState(0)
  const [debtTotal,    setDebtTotal]    = useState(0)
  const [portfolioVal, setPortfolioVal] = useState(0)
  const [monthlyChart, setMonthlyChart] = useState<MonthlySummary[]>([])
  const [goals,        setGoals]        = useState<GoalDef[]>([])
  const [recentTxns,   setRecentTxns]   = useState<{ date: string; category: string; amount: number; type: string }[]>([])
  const [upcomingSubs, setUpcomingSubs] = useState<{ name: string; days: number; date: string }[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('ftp-goals-v1')
        if (raw) setGoals(JSON.parse(raw))
      } catch {}
    }

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      const now    = new Date()
      const year   = now.getFullYear()
      const month  = now.getMonth() + 1
      const yyyyMM = `${year}-${String(month).padStart(2, '0')}`

      await Promise.allSettled([
        // Asset items → net worth
        supabase.from('asset_items').select('category, amount').then(({ data }) => {
          if (!data) return
          const assets = data.filter(r => r.category !== '負債').reduce((s, r) => s + r.amount, 0)
          const liabs  = data.filter(r => r.category === '負債').reduce((s, r) => s + r.amount, 0)
          setTotalAssets(assets)
          setTotalLiab(liabs)
          setNetWorth(assets - liabs)
        }),

        // Transactions → this month + chart
        supabase.from('transactions').select('date, type, category, amount').then(({ data }) => {
          if (!data) return
          const thisMonth = data.filter(t => t.date?.startsWith(yyyyMM))
          setMonthIncome(thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
          setMonthExpense(thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))

          // Recent 5 transactions
          const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
          setRecentTxns(sorted)

          // Monthly chart (last 6 months)
          const chart: MonthlySummary[] = []
          for (let i = 5; i >= 0; i--) {
            const d = new Date(year, month - 1 - i, 1)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = `${d.getMonth() + 1}月`
            const txns = data.filter(t => t.date?.startsWith(key))
            chart.push({
              month: label,
              收入: txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
              支出: txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
            })
          }
          setMonthlyChart(chart)
        }),

        // Subscriptions → monthly total + upcoming
        supabase.from('subscriptions').select('cost, currency, billing_cycle, active, name, next_charge_date').then(({ data }) => {
          if (!data) return
          const CYCLES: Record<string, number> = { monthly: 12, yearly: 1, weekly: 52, daily: 365 }
          const active = data.filter(s => s.active)
          const total = active.reduce((sum, s) => {
            const inTWD = s.currency === 'USD' ? s.cost * 32.5 : s.cost
            return sum + (inTWD * (CYCLES[s.billing_cycle] ?? 12)) / 12
          }, 0)
          setSubMonthly(total)

          const upcoming = data
            .filter(s => s.active && s.next_charge_date)
            .map(s => {
              const days = Math.round((new Date(s.next_charge_date!).getTime() - Date.now()) / 86400000)
              return { name: s.name, days, date: s.next_charge_date! }
            })
            .filter(s => s.days >= 0 && s.days <= 14)
            .sort((a, b) => a.days - b.days)
            .slice(0, 4)
          setUpcomingSubs(upcoming)
        }),

        // Debts → total remaining
        supabase.from('debts').select('remaining').then(({ data }) => {
          if (!data) return
          setDebtTotal(data.reduce((s, d) => s + d.remaining, 0))
        }),

        // Holdings → portfolio value
        supabase.from('holdings').select('quantity, current_price, currency').then(({ data }) => {
          if (!data) return
          const val = data.reduce((s, h) => {
            const inTWD = h.currency === 'USD' ? h.quantity * h.current_price * 32.5 : h.quantity * h.current_price
            return s + inTWD
          }, 0)
          setPortfolioVal(val)
        }),
      ])

      setLoading(false)
    })
  }, [])

  const monthNet = monthIncome - monthExpense
  const savingsRate = monthIncome > 0 ? (monthNet / monthIncome * 100) : 0

  const tooltipStyle = { backgroundColor: 'var(--surface)', border: 'none', borderRadius: 12, fontSize: 12 }

  if (loading) return (
    <div style={{ fontFamily: D.font }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-2xl p-4 h-20 animate-pulse" style={{ backgroundColor: D.surface }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: D.font }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: D.muted }}>總覽</p>
          {netWorth !== null ? (
            <h1 className="text-3xl font-bold" style={{ color: D.ink }}>{fmtShort(netWorth)} 淨資產</h1>
          ) : (
            <h1 className="text-xl font-bold" style={{ color: D.ink }}>財務總覽</h1>
          )}
        </div>
        <p className="text-xs" style={{ color: D.muted }}>
          {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '本月收入', value: fmt(monthIncome),  accent: false },
          { label: '本月支出', value: fmt(monthExpense), accent: false },
          { label: `本月淨額`,  value: fmt(monthNet),    accent: true, danger: monthNet < 0 },
          { label: '儲蓄率',   value: `${savingsRate.toFixed(1)}%`, accent: false },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.danger ? D.danger : m.accent ? D.accent : D.ink }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 收支趨勢 */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
          <p className="text-xs mb-4" style={{ color: D.muted }}>近 6 個月收支</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" strokeOpacity={0.4} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={tooltipStyle} />
              <Bar dataKey="收入" fill="var(--ink)"    fillOpacity={0.75} radius={[3,3,0,0]} />
              <Bar dataKey="支出" fill="var(--accent)" fillOpacity={0.5}  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 財務快照 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
          <p className="text-xs mb-4" style={{ color: D.muted }}>財務快照</p>
          <div className="space-y-3">
            {[
              { label: '總資產',   value: fmtShort(totalAssets), color: D.accent },
              { label: '總負債',   value: fmtShort(totalLiab),   color: D.danger },
              { label: '淨資產',   value: fmtShort(netWorth ?? 0), color: D.ink, bold: true },
              { label: '投資組合', value: fmtShort(portfolioVal), color: D.ink },
              { label: '負債餘額', value: fmtShort(debtTotal),    color: D.muted },
              { label: '訂閱月費', value: fmtShort(subMonthly),   color: D.muted },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-xs"
                style={{ borderBottom: r.bold ? `1px solid var(--subtle)` : undefined, paddingBottom: r.bold ? 8 : 0 }}>
                <span style={{ color: D.muted }}>{r.label}</span>
                <span className={r.bold ? 'font-bold text-sm' : 'font-medium'} style={{ color: r.color }}>
                  {r.value === fmtShort(0) && !['淨資產'].includes(r.label) ? '—' : r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Goals progress */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs" style={{ color: D.muted }}>目標進度</p>
            <Link href="/goals" className="text-xs transition-opacity hover:opacity-60" style={{ color: D.accent }}>管理 →</Link>
          </div>
          {goals.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs mb-2" style={{ color: D.muted }}>尚無目標</p>
              <Link href="/goals" className="text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.bg, color: D.muted }}>+ 新增目標</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 4).map(g => {
                const m  = calcMonthly(g.goal, g.current, g.years, g.rate)
                const pct = Math.min(100, (g.current / g.goal) * 100)
                const done = pct >= 100
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: D.ink }}>{g.label}</span>
                      <span style={{ color: done ? D.accent : D.muted }}>
                        {done ? '已達標 ✓' : `${fmt(Math.ceil(m))}/月`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: D.bg }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: D.accent }} />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: D.muted, opacity: 0.6 }}>
                      {pct.toFixed(0)}% · {g.years} 年 · {g.rate}% 報酬
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent transactions + upcoming subscriptions */}
        <div className="space-y-4">
          {recentTxns.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs" style={{ color: D.muted }}>最近交易</p>
                <Link href="/cashflow" className="text-xs transition-opacity hover:opacity-60" style={{ color: D.accent }}>全部 →</Link>
              </div>
              <div className="space-y-2">
                {recentTxns.map((t, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <div>
                      <span style={{ color: D.ink }}>{t.category}</span>
                      <span className="ml-2" style={{ color: D.muted, opacity: 0.6 }}>{t.date}</span>
                    </div>
                    <span style={{ color: t.type === 'income' ? D.accent : D.ink }}>
                      {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingSubs.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs" style={{ color: D.muted }}>14 日內到期訂閱</p>
                <Link href="/subscriptions" className="text-xs transition-opacity hover:opacity-60" style={{ color: D.accent }}>管理 →</Link>
              </div>
              <div className="space-y-1.5">
                {upcomingSubs.map((s, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span style={{ color: D.ink }}>{s.name}</span>
                    <span style={{ color: s.days === 0 ? D.danger : D.muted }}>
                      {s.days === 0 ? '今天' : `${s.days} 天後`} · {s.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick navigation */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
        <p className="text-xs mb-4" style={{ color: D.muted }}>快速入口</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {PAGE_LINKS.map(p => (
            <Link key={p.href} href={p.href}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-opacity hover:opacity-70"
              style={{ backgroundColor: D.bg }}>
              <span className="text-xl">{p.icon}</span>
              <span className="text-xs text-center leading-tight" style={{ color: D.muted }}>{p.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
