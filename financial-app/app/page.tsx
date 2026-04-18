'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const PRIMARY = '#96B3D1'

const FEATURES = [
  {
    title: '複利計算器',
    desc: '設定初始本金、定期定投與年化報酬率，即時預覽資產成長曲線，並比較不同利率下的最終結果。',
    chart: (
      <div className="relative h-28 flex items-end gap-1 px-1">
        {[30, 45, 55, 62, 72, 80, 88, 95].map((h, i) => (
          <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: i === 7 ? PRIMARY : `${PRIMARY}${Math.round(40 + i * 20).toString(16)}` }} />
        ))}
      </div>
    ),
  },
  {
    title: '退休規劃',
    desc: '輸入目前年齡、預計退休年齡與每月支出，計算退休目標金額、每月需存入多少，並模擬提領期間的資產消耗。',
    chart: (
      <div className="relative h-28 overflow-hidden">
        <svg viewBox="0 0 200 80" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.3" />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d="M0 80 Q50 60 100 30 Q150 5 200 2 L200 80 Z" fill="url(#g1)" />
          <path d="M0 80 Q50 60 100 30 Q150 5 200 2" fill="none" stroke={PRIMARY} strokeWidth="2" />
        </svg>
      </div>
    ),
  },
  {
    title: '財務報表',
    desc: '輸入資產負債現況與成長假設，自動生成多年期資產負債表與損益表，並以圖表視覺化淨值走勢。',
    chart: (
      <div className="relative h-28 flex items-end gap-0.5 px-1">
        {[
          { a: 60, b: 30 }, { a: 65, b: 28 }, { a: 70, b: 26 },
          { a: 78, b: 22 }, { a: 85, b: 18 }, { a: 90, b: 15 }, { a: 95, b: 10 },
        ].map((d, i) => (
          <div key={i} className="flex-1 flex flex-col-reverse gap-0.5">
            <div className="rounded-t" style={{ height: `${d.a}%`, backgroundColor: PRIMARY, opacity: 0.7 }} />
            <div className="rounded-t" style={{ height: `${d.b}%`, backgroundColor: '#374151', opacity: 0.15 }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: '自定義公式',
    desc: '不受限於制式模板，自行定義變數與公式，拉出任何你需要的財務圖表。即將推出。',
    chart: (
      <div className="h-28 flex items-center justify-center">
        <div className="font-mono text-xs text-gray-300 space-y-1.5">
          <div><span style={{ color: PRIMARY }}>x</span> = 本金 × (1 + r)^n</div>
          <div><span style={{ color: PRIMARY }}>IRR</span> = f(現金流, 期數)</div>
          <div><span style={{ color: PRIMARY }}>ROI</span> = (收益 - 成本) / 成本</div>
        </div>
      </div>
    ),
    soon: true,
  },
]

const GOOGLE_SVG = (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function LandingPage() {
  const router = useRouter()

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
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>

      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md" style={{ backgroundColor: PRIMARY }} />
            <span className="font-semibold text-gray-900 text-sm">FinTool</span>
          </div>
          <button
            onClick={handleLogin}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            登入
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 max-w-lg">
          <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PRIMARY }}>
            個人財務規劃工具
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
            把財務未來<br />看得清清楚楚
          </h1>
          <p className="text-gray-400 text-base leading-relaxed mb-10">
            複利計算、退休規劃、財務報表、自定義公式圖表。<br />
            一個工具，看懂你的錢。
          </p>
          <button
            onClick={handleLogin}
            className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            {GOOGLE_SVG}
            使用 Google 帳號免費開始
          </button>
          <p className="text-xs text-gray-300 mt-4">免費 · 不需信用卡 · 資料不外洩</p>
        </div>

        {/* Product mockup */}
        <div className="flex-1 w-full max-w-xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* fake nav bar */}
            <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-4">
              <div className="w-5 h-5 rounded" style={{ backgroundColor: PRIMARY, opacity: 0.7 }} />
              {['複利計算器', '退休規劃', '財務報表'].map(t => (
                <span key={t} className="text-xs text-gray-400">{t}</span>
              ))}
            </div>
            {/* fake content */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '最終餘額', value: 'NT$ 4,321,000' },
                  { label: '總投入本金', value: 'NT$ 2,400,000' },
                  { label: '累計利息', value: 'NT$ 1,921,000' },
                  { label: '實際 CAGR', value: '7.00%' },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                    <p className="text-xs font-bold" style={{ color: m.label === '最終餘額' ? PRIMARY : '#374151' }}>{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-3">複利成長曲線</p>
                <div className="flex items-end gap-0.5 h-24">
                  {Array.from({ length: 24 }, (_, i) => {
                    const h = 10 + Math.pow(i / 23, 1.6) * 90
                    return (
                      <div key={i} className="flex-1 rounded-t" style={{
                        height: `${h}%`,
                        backgroundColor: i % 2 === 0 ? PRIMARY : '#94A3B8',
                        opacity: 0.6 + (i / 23) * 0.4,
                      }} />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-center text-xs font-medium tracking-widest uppercase text-gray-300 mb-12">功能</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-800">{f.title}</p>
                {f.soon && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">即將推出</span>
                )}
              </div>
              <div className="flex-1">{f.chart}</div>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-12 mb-8">
        <div className="rounded-2xl px-10 py-14 text-center" style={{ backgroundColor: PRIMARY }}>
          <h2 className="text-2xl font-bold text-white mb-3">開始規劃你的財務未來</h2>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>免費使用，資料加密儲存，隨時存取你的財務情境。</p>
          <button
            onClick={handleLogin}
            className="inline-flex items-center gap-3 bg-white rounded-xl px-7 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            {GOOGLE_SVG}
            使用 Google 帳號免費開始
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded" style={{ backgroundColor: PRIMARY }} />
            <span className="text-sm font-semibold text-gray-400">FinTool</span>
          </div>
          <p className="text-xs text-gray-300">個人財務規劃工具</p>
        </div>
      </footer>
    </div>
  )
}
