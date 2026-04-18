'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'
import { useTheme } from '@/components/ThemeProvider'
import { t } from '@/lib/i18n'
import type { User } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'yichenjasperliao@gmail.com'

const NAV_ICONS: Record<string, string> = {
  '/compound':      '∿',
  '/retirement':    '◎',
  '/statements':    '▦',
  '/subscriptions': '↺',
  '/debts':         '⊖',
  '/budget':        '◈',
  '/tax':           '§',
  '/cashflow':      '⇅',
  '/admin':         '⊙',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const { lang, setLang } = useLang()
  const { theme, toggle } = useTheme()
  const T = t[lang]

  const NAV = [
    { href: '/compound',      label: T.nav.compound      },
    { href: '/retirement',    label: T.nav.retirement    },
    { href: '/statements',    label: T.nav.statements    },
    { href: '/subscriptions', label: T.nav.subscriptions },
    { href: '/debts',         label: T.nav.debts         },
    { href: '/budget',        label: T.nav.budget        },
    { href: '/tax',           label: T.nav.tax           },
    { href: '/cashflow',      label: T.nav.cashflow      },
  ]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/')
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

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
    </div>
  )

  const sidebarW = collapsed ? 56 : 220

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-mono), monospace' }}>

      {/* ── Sidebar ── */}
      <aside
        className="fixed top-0 left-0 h-full z-20 flex flex-col transition-all duration-200"
        style={{ width: sidebarW, backgroundColor: 'var(--surface)' }}
      >
        {/* Logo + collapse */}
        <div className="flex items-center justify-between px-4 h-14 shrink-0">
          {!collapsed && (
            <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--ink)' }}>
              FinTool
            </span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="transition-opacity hover:opacity-50 ml-auto"
            style={{ color: 'var(--muted)', fontSize: 16 }}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto space-y-0.5">
          {NAV.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 px-3 py-2 rounded-xl transition-opacity hover:opacity-70"
                style={{
                  backgroundColor: active ? 'var(--bg)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  opacity: active ? 1 : undefined,
                }}
              >
                <span className="shrink-0 text-base w-4 text-center">{NAV_ICONS[href]}</span>
                {!collapsed && <span className="text-xs truncate">{label}</span>}
              </Link>
            )
          })}

          {user?.email === ADMIN_EMAIL && (
            <Link
              href="/admin"
              title={collapsed ? T.nav.admin : undefined}
              className="flex items-center gap-3 px-3 py-2 rounded-xl transition-opacity hover:opacity-70"
              style={{
                backgroundColor: pathname === '/admin' ? 'var(--bg)' : 'transparent',
                color: pathname === '/admin' ? 'var(--ink)' : 'var(--muted)',
              }}
            >
              <span className="shrink-0 text-base w-4 text-center">{NAV_ICONS['/admin']}</span>
              {!collapsed && <span className="text-xs">{T.nav.admin}</span>}
            </Link>
          )}
        </nav>

        {/* Bottom: avatar + controls */}
        <div className="shrink-0 px-3 pb-4 space-y-1">
          {/* Dark mode */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-opacity hover:opacity-50"
            style={{ color: 'var(--muted)' }}
          >
            <span className="shrink-0 w-4 text-center text-base">{theme === 'dark' ? '☀' : '☽'}</span>
            {!collapsed && <span className="text-xs">{theme === 'dark' ? 'Light' : 'Dark'}</span>}
          </button>

          {/* Lang toggle */}
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-opacity hover:opacity-50"
            style={{ color: 'var(--muted)' }}
          >
            <span className="shrink-0 w-4 text-center text-xs font-bold">
              {lang === 'zh' ? 'EN' : '中'}
            </span>
            {!collapsed && <span className="text-xs">{lang === 'zh' ? 'English' : '中文'}</span>}
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-opacity hover:opacity-50"
            style={{ color: 'var(--muted)' }}
          >
            <span className="shrink-0 w-4 text-center text-base">→</span>
            {!collapsed && <span className="text-xs">{T.nav.signOut}</span>}
          </button>

          {/* User avatar */}
          {!collapsed && user && (
            <div className="flex items-center gap-2 px-3 pt-2 border-t" style={{ borderColor: 'var(--subtle)' }}>
              {user.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-md" />
                : <div className="w-6 h-6 rounded-md" style={{ backgroundColor: 'var(--accent)', opacity: 0.3 }} />
              }
              <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                {user.user_metadata?.full_name ?? user.email}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        className="flex-1 min-h-screen transition-all duration-200"
        style={{ marginLeft: sidebarW, padding: '2rem 2.5rem' }}
      >
        {children}
      </main>
    </div>
  )
}
