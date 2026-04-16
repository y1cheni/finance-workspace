'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

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

      // Fetch aggregated usage from usage_logs joined with auth users
      // Since anon key can't read auth.users, we log email at insert time.
      // Here we aggregate by user_id.
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  if (allowed === false) return (
    <div className="min-h-[40vh] flex items-center justify-center text-red-500 font-semibold">
      403 — 你沒有管理員權限
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">🛠️ 管理後台</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: '總訪問次數', value: total,        color: 'text-blue-700'  },
          { label: '用戶數',     value: stats.length, color: 'text-green-600' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">用戶列表</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['姓名 / Email','訪問次數','最後上線','使用頁面'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <p className="font-medium">{s.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
                  </td>
                  <td className="py-2 pr-4 font-semibold text-blue-700">{s.visits}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">
                    {new Date(s.last_seen).toLocaleString('zh-TW')}
                  </td>
                  <td className="py-2 text-xs text-gray-500">{s.pages.join(', ')}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">尚無數據</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
