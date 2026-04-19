'use client'
import { D } from '@/lib/design'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}

export default function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="mb-5">
      <div className="flex justify-between mb-1">
        <label className="text-xs" style={{ color: D.muted }}>{label}</label>
        <span className="text-xs font-semibold" style={{ color: D.ink }}>{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full appearance-none cursor-pointer slider-track"
        style={{
          height: '4px',
          borderRadius: '999px',
          outline: 'none',
          border: 'none',
          background: `linear-gradient(to right, var(--accent) ${pct}%, var(--subtle) ${pct}%)`,
        }}
      />
    </div>
  )
}
