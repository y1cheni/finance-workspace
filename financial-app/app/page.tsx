'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'
import { t } from '@/lib/i18n'

// ── Design tokens ──────────────────────────────────────────────
const BG      = '#F5F4EC'
const INK     = '#1A1A1A'
const ACCENT  = '#E8A020'
const MUTED   = '#AAAAAA'
const SURFACE = '#ECEAE0'   // slightly darker than BG for cards

// ── Helpers ────────────────────────────────────────────────────
const GOOGLE_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// ── Micro chart components ─────────────────────────────────────
function BarMini() {
  const vals = [18, 26, 33, 41, 50, 59, 69, 80, 88, 95]
  return (
    <div className="flex items-end gap-1 h-16">
      {vals.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{
          height: `${h}%`,
          backgroundColor: i === vals.length - 1 ? ACCENT : INK,
          opacity: 0.12 + i * 0.08,
        }} />
      ))}
    </div>
  )
}

function CurveMini() {
  return (
    <div className="h-16">
      <svg viewBox="0 0 120 40" className="w-full h-full" preserveAspectRatio="none">
        <path d="M0 38 C30 30 60 18 90 8 S110 2 120 1" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.25" />
        <path d="M0 40 C30 32 60 20 90 10 S110 4 120 3 L120 40 Z" fill={INK} opacity="0.07" />
      </svg>
    </div>
  )
}

function StackedMini() {
  return (
    <div className="flex items-end gap-0.5 h-16">
      {[55, 60, 65, 72, 78, 84, 90].map((a, i) => (
        <div key={i} className="flex-1 flex flex-col-reverse gap-0.5">
          <div className="rounded-sm" style={{ height: `${a}%`, backgroundColor: INK, opacity: 0.15 + i * 0.02 }} />
          <div className="rounded-sm" style={{ height: `${100 - a - 10}%`, backgroundColor: ACCENT, opacity: 0.25 + i * 0.03 }} />
        </div>
      ))}
    </div>
  )
}

function FormulaMini() {
  return (
    <div className="h-16 flex flex-col justify-center gap-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ color: MUTED }}><span style={{ color: ACCENT }}>x</span> = P × (1+r)^n</div>
      <div style={{ color: MUTED }}><span style={{ color: ACCENT }}>IRR</span> = f(cf, n)</div>
      <div style={{ color: MUTED }}><span style={{ color: ACCENT }}>ROI</span> = Δ / cost</div>
    </div>
  )
}

const CHARTS = [<BarMini key="b"/>, <CurveMini key="c"/>, <StackedMini key="s"/>, <FormulaMini key="f"/>]

// ── Page ───────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const { lang, setLang } = useLang()
  const T = t[lang]

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/compound')
    })
  }, [router])

  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/compound` },
    })
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG, color: INK, fontFamily: 'var(--font-mono)' }}>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-10" style={{ backgroundColor: BG }}>
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between">
          <span className="text-sm font-medium tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
            FinTool
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="text-xs transition-opacity hover:opacity-50"
              style={{ color: MUTED }}
            >
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
            <button
              onClick={handleLogin}
              className="text-xs px-4 py-2 rounded-lg transition-opacity hover:opacity-70"
              style={{ backgroundColor: INK, color: BG }}
            >
              {T.nav.getStarted}
            </button>
            <button
              onClick={handleLogin}
              className="text-xs transition-opacity hover:opacity-50"
              style={{ color: MUTED }}
            >
              {T.nav.signIn}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-8 pt-24 pb-20 flex flex-col lg:flex-row items-start gap-20">

        {/* Left: text only */}
        <div className="flex-1">
          <p className="text-xs mb-8 tracking-widest uppercase" style={{ color: MUTED }}>
            {T.landing.badge}
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-10 whitespace-pre-line" style={{ letterSpacing: '-0.02em' }}>
            {T.landing.headline}
          </h1>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: MUTED }}>
            {T.landing.sub}
          </p>
        </div>

        {/* Right: product mockup */}
        <div className="flex-1 w-full max-w-md pt-2">
          <div className="rounded-2xl p-6" style={{ backgroundColor: SURFACE }}>
            {/* fake nav */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-5 h-5 rounded-md" style={{ backgroundColor: INK, opacity: 0.15 }} />
              {[T.nav.compound, T.nav.retirement, T.nav.statements].map((label, i) => (
                <span key={label} className="text-xs" style={{ color: i === 0 ? INK : MUTED, opacity: i === 0 ? 0.8 : 1 }}>
                  {label}
                </span>
              ))}
            </div>
            {/* stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: lang === 'zh' ? '最終餘額' : 'Final Balance',    value: '4,321,000', accent: true  },
                { label: lang === 'zh' ? '總投入本金' : 'Total Principal', value: '2,400,000', accent: false },
                { label: lang === 'zh' ? '累計利息' : 'Interest',         value: '1,921,000', accent: false },
                { label: 'CAGR',                                           value: '7.00 %',    accent: false },
              ].map(m => (
                <div key={m.label} className="rounded-xl p-3" style={{ backgroundColor: BG }}>
                  <p className="text-xs mb-1" style={{ color: MUTED }}>{m.label}</p>
                  <p className="text-sm font-medium" style={{ color: m.accent ? ACCENT : INK, fontFamily: 'var(--font-mono)' }}>
                    {m.accent ? '' : ''}{m.value}
                  </p>
                </div>
              ))}
            </div>
            {/* mini chart */}
            <div className="rounded-xl p-4" style={{ backgroundColor: BG }}>
              <p className="text-xs mb-4" style={{ color: MUTED }}>
                {lang === 'zh' ? '複利成長曲線' : 'Compound Growth'}
              </p>
              <div className="flex items-end gap-0.5 h-20">
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{
                    height: `${8 + Math.pow(i / 19, 1.7) * 92}%`,
                    backgroundColor: i === 19 ? ACCENT : INK,
                    opacity: i === 19 ? 0.7 : 0.08 + (i / 19) * 0.18,
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-5xl mx-auto px-8">
        <div className="h-px" style={{ backgroundColor: INK, opacity: 0.08 }} />
      </div>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-8 py-24">
        <p className="text-xs tracking-widest uppercase mb-16" style={{ color: MUTED }}>
          {T.landing.featuresLabel}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {T.landing.features.map((f, i) => (
            <div key={f.title} className="rounded-2xl p-5" style={{ backgroundColor: SURFACE }}>
              <div className="flex items-center gap-2 mb-5">
                <p className="text-sm font-medium" style={{ color: INK }}>{f.title}</p>
                {'soon' in f && f.soon && (
                  <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: BG, color: MUTED }}>
                    {lang === 'zh' ? '即將' : 'soon'}
                  </span>
                )}
              </div>
              {CHARTS[i]}
              <p className="mt-5 text-xs leading-relaxed" style={{ color: MUTED }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-5xl mx-auto px-8">
        <div className="h-px" style={{ backgroundColor: INK, opacity: 0.08 }} />
      </div>

      {/* ── CTA ── */}
      <section className="max-w-5xl mx-auto px-8 py-24 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
        <div>
          <p className="text-2xl font-bold mb-2">{T.landing.ctaBannerTitle}</p>
          <p className="text-sm" style={{ color: MUTED }}>{T.landing.ctaBannerSub}</p>
        </div>
        <button
          onClick={handleLogin}
          className="shrink-0 flex items-center gap-3 px-6 py-3 rounded-xl transition-opacity hover:opacity-70"
          style={{ backgroundColor: INK, color: BG }}
        >
          {GOOGLE_SVG}
          <span className="text-sm">{T.landing.cta}</span>
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="max-w-5xl mx-auto px-8 pb-12 flex items-center justify-between">
        <span className="text-xs" style={{ color: MUTED }}>FinTool</span>
        <span className="text-xs" style={{ color: MUTED }}>{T.landing.footerTagline}</span>
      </footer>
    </div>
  )
}
