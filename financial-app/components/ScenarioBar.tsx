'use client'
import { useEffect, useState } from 'react'
import { listScenarios, saveScenario, deleteScenario, type Scenario } from '@/lib/scenarios'
import { useLang } from '@/components/LanguageProvider'
import { t } from '@/lib/i18n'

const PRIMARY = '#96B3D1'

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
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="text"
          placeholder={S.namePlaceholder}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 w-36"
          style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: PRIMARY }}
        >
          {saving ? S.saving : S.save}
        </button>
      </div>

      {scenarios.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {S.load} ({scenarios.length})
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-100 rounded-xl shadow-lg min-w-48 py-1">
              {scenarios.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 group">
                  <button
                    className="text-sm text-gray-700 text-left flex-1 truncate"
                    onClick={() => { onLoad(s.params); setOpen(false) }}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-gray-300 hover:text-red-400 ml-3 text-xs transition-colors opacity-0 group-hover:opacity-100"
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
        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
      >
        {S.export}
      </button>
    </div>
  )
}
