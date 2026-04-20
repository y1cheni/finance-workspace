'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Per-user, per-page param persistence via localStorage.
 * Key pattern: `ftp-{userId}-{page}`
 *
 * Usage:
 *   usePageParams('retirement', currentParams, onLoad)
 *   - currentParams: the current values object to save
 *   - onLoad: called once on mount with the stored values (if any)
 */
export function usePageParams(
  page: string,
  params: Record<string, unknown>,
  onLoad: (stored: Record<string, unknown>) => void,
) {
  const userIdRef  = useRef<string | null>(null)
  const didLoad    = useRef(false)
  const onLoadRef  = useRef(onLoad)
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep onLoad ref current so we don't need it as an effect dep
  onLoadRef.current = onLoad

  // 1. On mount: resolve userId then load stored params once
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? 'anonymous'
      userIdRef.current = uid
      const raw = localStorage.getItem(`ftp-${uid}-${page}`)
      if (raw) {
        try {
          const stored = JSON.parse(raw)
          onLoadRef.current(stored)
        } catch {
          // ignore malformed cache
        }
      }
      didLoad.current = true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // 2. Debounced auto-save whenever params change (after first load)
  const paramsJson = JSON.stringify(params)
  useEffect(() => {
    if (!didLoad.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const uid = userIdRef.current
      if (!uid) return
      localStorage.setItem(`ftp-${uid}-${page}`, paramsJson)
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsJson, page])
}
