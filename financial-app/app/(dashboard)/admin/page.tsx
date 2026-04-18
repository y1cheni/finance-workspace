'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { D } from '@/lib/design'

interface UserStat {
  user_id: string
  email: string
  full_name: string
  visits: number
  last_seen: string
  pages: string[]
}

const ADMIN_EMAIL = 'yichenjasperliao@gmail.com'

export default function AdminPage() {
  const [stats, setStats]     = useState<UserStat[]>([])
  const [total, setTotal]     = useState(0)
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.email !== ADMIN_EMAIL) { setAllowed(false); return }
      setAllowed(true)

      const { data: logs } = await supabase
        .from('usage_logs')
        .select('user_id, page, created_at, email, full_name')
        .order('created_at', { ascending: false })

      if (!logs) return

      const map: Record<string, UserStat> = {}
      for (const row of logs) {
        if (!map[row.user_id]) {
          map[row.user_id] = {
            user_id:   row.user_id,
            email:     row.email ?? row.user_id,
            full_name: row.full_name ?? '',
            visits:    0,
            last_seen: row.created_at,
            pages:     [],
          }
        }
        map[row.user_id].visits++
        if (!map[row.user_id].pages.includes(row.page))
          map[row.user_id].pages.push(row.page)
      }

      const rows = Object.values(map).sort((a, b) => b.visits - a.visits)
      setStats(rows)
      setTotal(logs.length)
    })
  }, [])

  if (allowed === null) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: D.accent }} />
    </div>
  )

  if (allowed === false) return (
    <div className="min-h-[40vh] flex items-center justify-center text-xs" style={{ color: D.muted }}>
      403 — 無管理員權限
    </div>
  )

  return (
    <div style={{ fontFamily: D.font }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: D.ink }}>後台</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: '總訪問次數', value: total        },
          { label: '用戶數',     value: stats.length },
        ].map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: D.surface }}>
            <p className="text-xs mb-1" style={{ color: D.muted }}>{m.label}</p>
            <p className="text-2xl font-bold" style={{ color: D.accent }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5" style={{ backgroundColor: D.surface }}>
        <p className="text-xs mb-4" style={{ color: D.muted }}>用戶列表</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--subtle)` }}>
                {['姓名 / Email','訪問次數','最後上線','使用頁面'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-xs font-medium" style={{ color: D.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.user_id} style={{ borderBottom: `1px solid var(--subtle)` }}>
                  <td className="py-2 pr-4">
                    <p className="text-xs font-medium" style={{ color: D.ink }}>{s.full_name || '—'}</p>
                    <p className="text-xs" style={{ color: D.muted }}>{s.email}</p>
                  </td>
                  <td className="py-2 pr-4 font-semibold" style={{ color: D.accent }}>{s.visits}</td>
                  <td className="py-2 pr-4 text-xs" style={{ color: D.muted }}>
                    {new Date(s.last_seen).toLocaleString('zh-TW')}
                  </td>
                  <td className="py-2 text-xs" style={{ color: D.muted }}>{s.pages.join(', ')}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs" style={{ color: D.muted }}>尚無數據</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
