'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'
import { useTheme } from '@/components/ThemeProvider'
import { t } from '@/lib/i18n'
import type { User } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'yichenjasperliao@gmail.com'

const NAV_ICONS: Record<string, string> = {
  '/dashboard':     '⊞',
  '/compound':      '∿',
  '/retirement':    '◎',
  '/statements':    '▦',
  '/subscriptions': '↺',
  '/debts':         '⊖',
  '/budget':        '◈',
  '/tax':           '§',
  '/cashflow':      '⇅',
  '/goals':         '◉',
  '/portfolio':     '⬡',
  '/housing':       '⌂',
  '/formula':       'ƒ',
  '/admin':         '⊙',
}

/* ── Grouped nav with persistent order & custom labels ── */
interface NavGroup { id: string; label: string; hrefs: string[] }

const DEFAULT_GROUPS: NavGroup[] = [
  { id: 'overview', label: '總覽',     hrefs: ['/dashboard'] },
  { id: 'calc',     label: '計算工具', hrefs: ['/compound', '/retirement', '/budget', '/tax', '/goals', '/housing'] },
  { id: 'assets',   label: '資產負債', hrefs: ['/statements', '/portfolio', '/debts'] },
  { id: 'daily',    label: '日常管理', hrefs: ['/cashflow', '/subscriptions'] },
  { id: 'advanced', label: '進階',     hrefs: ['/formula'] },
]

const ALL_HREFS = DEFAULT_GROUPS.flatMap(g => g.hrefs)
const GROUPS_KEY = 'nav-groups-v3'

function loadGroups(): NavGroup[] {
  if (typeof window === 'undefined') return DEFAULT_GROUPS
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (!raw) return DEFAULT_GROUPS
    const stored: NavGroup[] = JSON.parse(raw)
    // ensure no page is lost
    const present = stored.flatMap(g => g.hrefs)
    const missing = ALL_HREFS.filter(h => !present.includes(h))
    if (missing.length && stored.length) stored[stored.length - 1].hrefs.push(...missing)
    return stored.length ? stored : DEFAULT_GROUPS
  } catch { return DEFAULT_GROUPS }
}

function saveGroups(groups: NavGroup[]) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

/* ── Component ── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user,      setUser]      = useState<User | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const { lang, setLang } = useLang()
  const { theme, toggle } = useTheme()
  const T = t[lang]

  /* nav groups */
  const [groups,       setGroups]       = useState<NavGroup[]>(DEFAULT_GROUPS)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)  // group id being renamed
  const [editingLabel, setEditingLabel] = useState('')

  /* drag state */
  const dragHref    = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ groupId: string; beforeHref: string | null } | null>(null)

  useEffect(() => { setGroups(loadGroups()) }, [])

  const persistGroups = (next: NavGroup[]) => { setGroups(next); saveGroups(next) }

  /* ── Rename group ── */
  const startRename = (g: NavGroup) => { setEditingGroup(g.id); setEditingLabel(g.label) }
  const commitRename = () => {
    if (!editingGroup) return
    persistGroups(groups.map(g => g.id === editingGroup ? { ...g, label: editingLabel.trim() || g.label } : g))
    setEditingGroup(null)
  }

  /* ── Drag handlers ── */
  const onDragStart = (href: string) => { dragHref.current = href }

  const onDragOverItem = (e: React.DragEvent, groupId: string, beforeHref: string) => {
    e.preventDefault()
    setDropTarget({ groupId, beforeHref })
  }
  const onDragOverGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    setDropTarget({ groupId, beforeHref: null })
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragHref.current || !dropTarget) { setDropTarget(null); return }
    const from = dragHref.current
    const { groupId, beforeHref } = dropTarget

    const next = groups.map(g => ({ ...g, hrefs: [...g.hrefs] }))

    // remove from source group
    for (const g of next) {
      const idx = g.hrefs.indexOf(from)
      if (idx !== -1) { g.hrefs.splice(idx, 1); break }
    }

    // insert into target group
    const target = next.find(g => g.id === groupId)
    if (target) {
      if (beforeHref === null) {
        target.hrefs.push(from)
      } else {
        const ti = target.hrefs.indexOf(beforeHref)
        target.hrefs.splice(ti === -1 ? target.hrefs.length : ti, 0, from)
      }
    }

    persistGroups(next)
    dragHref.current = null
    setDropTarget(null)
  }
  const onDragEnd = () => { dragHref.current = null; setDropTarget(null) }

  /* ── NAV labels ── */
  const NAV: Record<string, string> = {
    '/dashboard':     '總覽',
    '/compound':      T.nav.compound,
    '/retirement':    T.nav.retirement,
    '/statements':    T.nav.statements,
    '/subscriptions': T.nav.subscriptions,
    '/debts':         T.nav.debts,
    '/budget':        T.nav.budget,
    '/tax':           T.nav.tax,
    '/cashflow':      T.nav.cashflow,
    '/goals':         T.nav.goals,
    '/portfolio':     T.nav.portfolio,
    '/housing':       T.nav.housing,
    '/formula':       T.nav.formula,
  }

  /* ── Auth ── */
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
    await createClient().auth.signOut()
    router.replace('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
    </div>
  )

  const sidebarW = collapsed ? 56 : 224

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
            <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--ink)' }}>FinTool</span>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="transition-opacity hover:opacity-50 ml-auto"
            style={{ color: 'var(--ink)', fontSize: 16, opacity: 0.5 }}>
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto" onDrop={onDrop} onDragOver={e => e.preventDefault()}>
          {groups.map((group, gi) => (
            <div key={group.id} className={gi > 0 ? 'mt-4' : ''}>

              {/* Group label — click to rename */}
              {!collapsed && (
                <div
                  className="group flex items-center gap-1 px-3 mb-1"
                  onDragOver={e => onDragOverGroup(e, group.id)}
                  style={{ minHeight: 20 }}
                >
                  {editingGroup === group.id ? (
                    <input
                      autoFocus
                      value={editingLabel}
                      onChange={e => setEditingLabel(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingGroup(null) }}
                      className="flex-1 bg-transparent outline-none text-xs font-medium border-b"
                      style={{ color: 'var(--ink)', borderColor: 'var(--accent)', fontSize: 11 }}
                    />
                  ) : (
                    <>
                      <span
                        className="text-xs font-medium cursor-pointer select-none"
                        style={{ color: 'var(--ink)', opacity: 0.55, fontSize: 11, letterSpacing: '0.04em' }}
                        onClick={() => startRename(group)}
                        title="點擊重新命名"
                      >
                        {group.label}
                      </span>
                      <span className="opacity-0 group-hover:opacity-60 transition-opacity text-xs cursor-pointer"
                        style={{ color: 'var(--ink)', fontSize: 9 }}
                        onClick={() => startRename(group)}>✎</span>
                    </>
                  )}
                </div>
              )}

              {/* Nav items */}
              <div className="space-y-0.5">
                {group.hrefs.map(href => {
                  const label = NAV[href]
                  if (!label) return null
                  const active  = pathname === href
                  const isOver  = dropTarget?.groupId === group.id && dropTarget?.beforeHref === href
                  return (
                    <div key={href}
                      draggable
                      onDragStart={() => onDragStart(href)}
                      onDragOver={e => onDragOverItem(e, group.id, href)}
                      onDragEnd={onDragEnd}
                      style={{ borderRadius: '0.75rem' }}
                    >
                      {/* drop indicator */}
                      {isOver && (
                        <div className="h-0.5 mx-3 rounded-full mb-0.5" style={{ backgroundColor: 'var(--accent)' }} />
                      )}
                      <Link href={href} title={collapsed ? label : undefined}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-opacity hover:opacity-80 select-none"
                        style={{
                          backgroundColor: active ? 'var(--bg)' : 'transparent',
                          color: active ? 'var(--ink)' : 'var(--ink)',
                          opacity: active ? 1 : 0.5,
                        }}>
                        {!collapsed && (
                          <span className="shrink-0 text-xs opacity-30 cursor-grab" style={{ color: 'var(--ink)' }}>⠿</span>
                        )}
                        <span className="shrink-0 text-sm w-4 text-center">{NAV_ICONS[href]}</span>
                        {!collapsed && <span className="text-xs truncate font-medium">{label}</span>}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Admin */}
          {user?.email === ADMIN_EMAIL && (
            <div className="mt-4">
              {!collapsed && (
                <p className="text-xs px-3 mb-1 font-medium"
                  style={{ color: 'var(--ink)', opacity: 0.55, fontSize: 11, letterSpacing: '0.04em' }}>系統</p>
              )}
              <Link href="/admin" title={collapsed ? T.nav.admin : undefined}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: pathname === '/admin' ? 'var(--bg)' : 'transparent',
                  color: 'var(--ink)',
                  opacity: pathname === '/admin' ? 1 : 0.5,
                }}>
                <span className="shrink-0 text-sm w-4 text-center">{NAV_ICONS['/admin']}</span>
                {!collapsed && <span className="text-xs font-medium">{T.nav.admin}</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* Bottom controls */}
        <div className="shrink-0 px-3 pb-4 space-y-1">
          <button onClick={toggle}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ color: 'var(--ink)', opacity: 0.5 }}>
            <span className="shrink-0 w-4 text-center text-sm">{theme === 'dark' ? '☀' : '☽'}</span>
            {!collapsed && <span className="text-xs font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>}
          </button>

          <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ color: 'var(--ink)', opacity: 0.5 }}>
            <span className="shrink-0 w-4 text-center text-xs font-bold">{lang === 'zh' ? 'EN' : '中'}</span>
            {!collapsed && <span className="text-xs font-medium">{lang === 'zh' ? 'English' : '中文'}</span>}
          </button>

          <button onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ color: 'var(--ink)', opacity: 0.5 }}>
            <span className="shrink-0 w-4 text-center text-sm">→</span>
            {!collapsed && <span className="text-xs font-medium">{T.nav.signOut}</span>}
          </button>

          {!collapsed && user && (
            <div className="flex items-center gap-2 px-3 pt-2 border-t" style={{ borderColor: 'var(--subtle)' }}>
              {user.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-md" />
                : <div className="w-6 h-6 rounded-md" style={{ backgroundColor: 'var(--accent)', opacity: 0.3 }} />
              }
              <span className="text-xs truncate font-medium" style={{ color: 'var(--ink)', opacity: 0.6 }}>
                {user.user_metadata?.full_name ?? user.email}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-h-screen transition-all duration-200"
        style={{ marginLeft: sidebarW, padding: '2rem 2.5rem' }}>
        {children}
      </main>
    </div>
  )
}
