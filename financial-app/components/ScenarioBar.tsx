'use client'
import { useEffect, useState } from 'react'
import { listScenarios, saveScenario, deleteScenario, type Scenario } from '@/lib/scenarios'
import { useLang } from '@/components/LanguageProvider'
import { t } from '@/lib/i18n'
import { D } from '@/lib/design'

interface ScenarioBarProps {
  page: string
  currentParams: Record<string, unknown>
  onLoad: (params: Record<string, unknown>) => void
  onExport: () => void
}

export default function ScenarioBar({ page, currentParams, onLoad, onExport }: ScenarioBarProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [name, setName]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [open, setOpen]           = useState(false)
  const { lang } = useLang()
  const S = t[lang].scenario

  useEffect(() => {
    listScenarios(page).then(setScenarios)
  }, [page])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await saveScenario(page, name.trim(), currentParams)
    const updated = await listScenarios(page)
    setScenarios(updated)
    setName('')
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await deleteScenario(id)
    setScenarios(s => s.filter(x => x.id !== id))
  }

  return (
    <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ backgroundColor: D.surface }}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="text"
          placeholder={S.namePlaceholder}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="rounded-xl px-3 py-1.5 text-xs w-36 focus:outline-none"
          style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-70"
          style={{ backgroundColor: D.ink, color: D.bg }}
        >
          {saving ? S.saving : S.save}
        </button>
      </div>

      {scenarios.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.bg, color: D.muted }}
          >
            {S.load} ({scenarios.length})
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 z-20 rounded-2xl min-w-48 py-1"
              style={{ backgroundColor: D.surface, border: `1px solid var(--subtle)` }}>
              {scenarios.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 group transition-opacity hover:opacity-70">
                  <button
                    className="text-xs text-left flex-1 truncate"
                    style={{ color: D.ink }}
                    onClick={() => { onLoad(s.params); setOpen(false) }}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="ml-3 text-xs transition-opacity opacity-0 group-hover:opacity-100"
                    style={{ color: D.muted }}
                  >
                    {S.delete}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onExport}
        className="px-3 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
        style={{ backgroundColor: D.bg, color: D.muted }}
      >
        {S.export}
      </button>
    </div>
  )
}
