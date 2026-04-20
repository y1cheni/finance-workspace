'use client'
import { useRef, useState } from 'react'
import { D } from '@/lib/design'
import { parseCsv } from '@/lib/csv-import'

export interface CsvImportModalProps {
  title: string
  /** Example CSV content for the downloadable template */
  templateCsv: string
  templateFilename: string
  /**
   * Validate + transform parsed rows into typed records.
   * Return an error string if a row is invalid, or a transformed object.
   */
  transform: (row: Record<string, string>, index: number) => { ok: true; data: unknown } | { ok: false; error: string }
  /** Called with the successfully-transformed records when user confirms */
  onConfirm: (records: unknown[]) => Promise<void>
  onClose: () => void
}

export default function CsvImportModal({
  title, templateCsv, templateFilename, transform, onConfirm, onClose,
}: CsvImportModalProps) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [rows,   setRows]   = useState<Record<string, string>[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCsv(text)
      setRows(parsed)
      setErrors([])
      setDone(false)
    }
    reader.readAsText(file, 'utf-8')
  }

  function downloadTemplate() {
    const bom = '\uFEFF'
    const blob = new Blob([bom + templateCsv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = templateFilename
    a.click()
  }

  async function handleConfirm() {
    const validRecords: unknown[] = []
    const errs: string[] = []
    rows.forEach((row, i) => {
      const result = transform(row, i)
      if (result.ok) validRecords.push(result.data)
      else errs.push(`第 ${i + 2} 列：${result.error}`)
    })
    if (errs.length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      await onConfirm(validRecords)
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col gap-4 overflow-hidden"
        style={{ backgroundColor: D.surface }}>

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <p className="text-sm font-semibold" style={{ color: D.ink }}>{title}</p>
          <button onClick={onClose} className="text-xs transition-opacity hover:opacity-50"
            style={{ color: D.muted }}>✕ 關閉</button>
        </div>

        {/* Template download + file picker */}
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={downloadTemplate}
            className="text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.bg, color: D.muted, border: `1px solid var(--subtle)` }}>
            ↓ 下載範本 CSV
          </button>
          <label className="cursor-pointer text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.ink, color: D.bg }}>
            選擇 CSV 檔案
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
          {rows.length > 0 && (
            <span className="text-xs" style={{ color: D.muted }}>已解析 {rows.length} 筆</span>
          )}
        </div>

        {/* Preview table */}
        {rows.length > 0 && !done && (
          <div className="flex-1 overflow-auto rounded-xl" style={{ border: `1px solid var(--subtle)` }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: D.bg }}>
                  {headers.map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap"
                      style={{ color: D.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid var(--subtle)` }}>
                    {headers.map(h => (
                      <td key={h} className="px-3 py-1.5 whitespace-nowrap" style={{ color: D.ink }}>
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="text-xs px-3 py-2" style={{ color: D.muted }}>…僅顯示前 50 列預覽</p>
            )}
          </div>
        )}

        {/* Success state */}
        {done && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: D.accent }}>✓ 成功匯入 {rows.length} 筆資料</p>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="rounded-xl p-3 text-xs space-y-1 overflow-auto max-h-32"
            style={{ backgroundColor: D.bg, color: D.danger, border: `1px solid ${D.danger}` }}>
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        {/* Actions */}
        {!done && (
          <div className="flex gap-3 shrink-0">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
              style={{ backgroundColor: D.bg, color: D.muted }}>
              取消
            </button>
            <button onClick={handleConfirm} disabled={rows.length === 0 || saving}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ backgroundColor: D.ink, color: D.bg }}>
              {saving ? '匯入中…' : `確認匯入 ${rows.length} 筆`}
            </button>
          </div>
        )}
        {done && (
          <button onClick={onClose}
            className="py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.accent, color: D.bg }}>
            完成
          </button>
        )}
      </div>
    </div>
  )
}
