'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/compound',   label: '複利計算器' },
  { href: '/retirement', label: '退休規劃'   },
  { href: '/statements', label: '財務報表'   },
]

const ADMIN_EMAIL = 'yichenjasperliao@gmail.com'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
      else { setUser(data.user); setLoading(false) }
    })
  }, [router])

  useEffect(() => {
    if (!loading && user) {
      fetch('/api/log-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pathname }),
      }).catch(() => {})
    }
  }, [pathname, loading, user])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200" style={{ borderTopColor: '#96B3D1' }} />
    </div>
  )

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-13 py-3">
            <div className="flex items-center gap-6">
              <span className="font-semibold text-gray-900 text-sm tracking-wide hidden sm:block">FinTool</span>
              <nav className="flex gap-0.5">
                {NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === href
                        ? 'text-gray-900 bg-gray-100'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                {user?.email === ADMIN_EMAIL && (
                  <Link
                    href="/admin"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/admin'
                        ? 'text-gray-900 bg-gray-100'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    後台
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {user?.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="avatar"
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span className="text-xs text-gray-400 hidden sm:block">
                {user?.user_metadata?.full_name ?? user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-gray-300 hover:text-gray-600 transition-colors"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
