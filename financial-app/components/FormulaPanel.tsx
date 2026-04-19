'use client'
import { useState } from 'react'
import { D } from '@/lib/design'

interface Formula {
  name: string
  formula: string
  vars?: { sym: string; desc: string }[]
}

interface FormulaPanelProps {
  formulas: Formula[]
}

export default function FormulaPanel({ formulas }: FormulaPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl" style={{ backgroundColor: D.surface }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 transition-opacity hover:opacity-70"
      >
        <span className="text-xs font-medium" style={{ color: D.muted }}>公式說明</span>
        <span className="text-xs" style={{ color: D.muted }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5" style={{ borderTop: `1px solid var(--subtle)` }}>
          {formulas.map((f, i) => (
            <div key={i} className="pt-4">
              <p className="text-xs font-semibold mb-2" style={{ color: D.ink }}>{f.name}</p>
              <div className="rounded-xl px-4 py-3 font-mono text-xs overflow-x-auto"
                style={{ backgroundColor: D.bg, color: D.accent, letterSpacing: '0.02em' }}>
                {f.formula}
              </div>
              {f.vars && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {f.vars.map(v => (
                    <p key={v.sym} className="text-xs" style={{ color: D.muted }}>
                      <span className="font-semibold" style={{ color: D.ink }}>{v.sym}</span> — {v.desc}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
