'use client'
import { useRef, useState, useMemo } from 'react'
import { D } from '@/lib/design'
import { parseCsv } from '@/lib/csv-import'

export interface FieldDef {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'date'
  fixedValue?: string     // always use this literal value — no dropdown shown
  defaultValue?: string   // fallback if column not mapped or empty
  hint?: string
}

interface Props {
  title: string
  fields: FieldDef[]
  templateCsv: string
  templateFilename: string
  /** Lines to skip before the header row (e.g. 1 for M-flow CSV which has a pre-header total row) */
  skipRows?: number
  /** Return error string to skip this row; null = valid */
  validate?: (record: Record<string, string | number | null>, idx: number) => string | null
  onConfirm: (records: Record<string, string | number | null>[]) => Promise<void>
  onClose: () => void
}

// ── helpers ────────────────────────────────────────────────────────────────

function suggestMapping(fields: FieldDef[], headers: string[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const f of fields) {
    if (f.fixedValue !== undefined) continue
    let best = '', bestScore = -1
    for (const h of headers) {
      const hl = h.toLowerCase(), fl = f.key.toLowerCase(), ll = f.label.toLowerCase()
      let s = 0
      if (hl === fl || hl === ll) s = 10
      else if (hl.includes(fl) || fl.includes(hl)) s = 4
      else if (hl.includes(ll) || ll.includes(hl)) s = 3
      // partial character overlap (Chinese)
      else if ([...fl].some(c => hl.includes(c))) s = 1
      if (s > bestScore) { bestScore = s; best = h }
    }
    if (bestScore > 0) m[f.key] = best
  }
  return m
}

function coerceValue(raw: string, type?: FieldDef['type']): string | number | null {
  const v = raw.trim()
  if (!v) return null
  if (type === 'number') {
    const n = parseFloat(v.replace(/,/g, '').replace(/%/g, '').replace(/\(/g, '-').replace(/\)/g, ''))
    return isNaN(n) ? null : n
  }
  if (type === 'date') {
    // Strip timestamp: "2026-03-01 00:00:00" → "2026-03-01"
    return v.split(' ')[0]
  }
  return v
}

function applyRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
  fields: FieldDef[],
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {}
  for (const f of fields) {
    if (f.fixedValue !== undefined) { out[f.key] = f.fixedValue; continue }
    const col = mapping[f.key]
    const raw = col ? (row[col] ?? '') : ''
    const coerced = coerceValue(raw, f.type)
    out[f.key] = coerced ?? (f.defaultValue !== undefined ? f.defaultValue : null)
  }
  return out
}

// ── component ──────────────────────────────────────────────────────────────

export default function CsvImportModal({
  title, fields, templateCsv, templateFilename, skipRows, validate, onConfirm, onClose,
}: Props) {
  const [rows,    setRows]    = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [errors,  setErrors]  = useState<string[]>([])
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)
  const [skipped, setSkipped] = useState(0)

  const hasFile = rows.length > 0

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const processedText = skipRows
        ? text.split('\n').slice(skipRows).join('\n')
        : text
      const parsed = parseCsv(processedText)
      if (!parsed.length) return
      const hdrs = Object.keys(parsed[0])
      setRows(parsed); setHeaders(hdrs)
      setMapping(suggestMapping(fields, hdrs))
      setErrors([]); setDone(false); setSkipped(0)
    }
    reader.readAsText(file, 'utf-8')
  }

  const previewRows = useMemo(
    () => rows.slice(0, 4).map(r => applyRow(r, mapping, fields)),
    [rows, mapping, fields],
  )

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + templateCsv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = templateFilename; a.click()
  }

  async function handleConfirm() {
    const valid: Record<string, string | number | null>[] = []
    const errs: string[] = []

    rows.forEach((row, i) => {
      const mapped = applyRow(row, mapping, fields)
      let err: string | null = null

      for (const f of fields) {
        if (f.required && f.fixedValue === undefined) {
          const v = mapped[f.key]
          if (v === null || v === '' || v === undefined) {
            err = `「${f.label}」不能為空`; break
          }
        }
      }
      if (!err) err = validate?.(mapped, i) ?? null

      if (err) errs.push(`第 ${i + 2} 列：${err}`)
      else valid.push(mapped)
    })

    setErrors(errs)
    setSkipped(errs.length)

    if (valid.length === 0) return
    setSaving(true)
    try {
      await onConfirm(valid)
      setDone(true)
    } catch (e: any) {
      setErrors(prev => [...prev, e.message ?? '匯入時發生錯誤'])
    } finally {
      setSaving(false)
    }
  }

  const requiredMapped = fields
    .filter(f => f.required && f.fixedValue === undefined)
    .every(f => mapping[f.key])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col gap-4 overflow-hidden"
        style={{ backgroundColor: D.surface }}>

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <p className="text-sm font-semibold" style={{ color: D.ink }}>{title}</p>
          <button onClick={onClose} className="text-xs transition-opacity hover:opacity-50"
            style={{ color: D.muted }}>✕ 關閉</button>
        </div>

        {/* Upload row */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button onClick={downloadTemplate}
            className="text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ backgroundColor: D.bg, color: D.muted, border: `1px solid var(--subtle)` }}>
            ↓ 下載範本
          </button>
          <label className="cursor-pointer text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ backgroundColor: hasFile ? D.bg : D.ink, color: hasFile ? D.muted : D.bg,
              border: hasFile ? `1px solid var(--subtle)` : 'none' }}>
            {hasFile ? `✓ ${rows.length} 筆已載入` : '選擇 CSV 檔案'}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
          {hasFile && (
            <label className="cursor-pointer text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
              style={{ backgroundColor: D.ink, color: D.bg }}>
              重新選擇
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
          )}
        </div>

        {/* Main content */}
        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-semibold" style={{ color: D.accent }}>
              ✓ 成功匯入 {rows.length - skipped} 筆
            </p>
            {skipped > 0 && (
              <p className="text-xs" style={{ color: D.muted }}>已跳過 {skipped} 筆無效資料</p>
            )}
          </div>
        ) : hasFile ? (
          <div className="flex-1 overflow-auto space-y-5 pr-1">

            {/* ── Column mapping ── */}
            <div>
              <p className="text-xs font-medium mb-3" style={{ color: D.ink }}>
                欄位對應
                <span className="ml-2 font-normal" style={{ color: D.muted }}>
                  — 將你的 CSV 欄位對應到系統欄位
                </span>
              </p>
              <div className="grid grid-cols-1 gap-2">
                {fields.map(f => (
                  <div key={f.key} className="flex items-center gap-3">
                    {/* System field label */}
                    <div className="w-28 shrink-0 text-right">
                      <span className="text-xs" style={{ color: D.muted }}>
                        {f.label}
                        {f.required && <span style={{ color: D.danger }}> *</span>}
                      </span>
                    </div>

                    {/* Mapping control */}
                    {f.fixedValue !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-lg"
                          style={{ backgroundColor: D.bg, color: D.muted }}>
                          固定：{f.fixedValue}
                        </span>
                      </div>
                    ) : (
                      <select
                        value={mapping[f.key] ?? ''}
                        onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                        className="flex-1 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: D.bg, color: D.ink, border: `1px solid var(--subtle)` }}>
                        <option value="">— 略過{f.defaultValue !== undefined ? `（預設: ${f.defaultValue}）` : ''} —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    )}

                    {/* Hint */}
                    {f.hint && (
                      <span className="text-xs shrink-0 hidden sm:block" style={{ color: D.muted }}>
                        {f.hint}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Live preview ── */}
            {previewRows.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: D.ink }}>
                  即時預覽
                  <span className="ml-2 font-normal" style={{ color: D.muted }}>前 {previewRows.length} 筆</span>
                </p>
                <div className="rounded-xl overflow-auto" style={{ border: `1px solid var(--subtle)` }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: D.bg }}>
                        {fields.map(f => (
                          <th key={f.key} className="text-left px-3 py-2 font-medium whitespace-nowrap"
                            style={{ color: D.muted }}>{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} style={{ borderTop: `1px solid var(--subtle)` }}>
                          {fields.map(f => {
                            const v = row[f.key]
                            const missing = f.required && (v === null || v === '')
                            return (
                              <td key={f.key} className="px-3 py-1.5 whitespace-nowrap"
                                style={{ color: missing ? D.danger : v !== null ? D.ink : D.muted }}>
                                {v !== null ? String(v) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs" style={{ color: D.muted }}>上傳 CSV 後可在此對應欄位</p>
          </div>
        )}

        {/* Errors (collapsible) */}
        {errors.length > 0 && (
          <div className="rounded-xl p-3 text-xs space-y-1 overflow-auto max-h-24 shrink-0"
            style={{ backgroundColor: D.bg, border: `1px solid ${D.danger}` }}>
            {errors.slice(0, 6).map((e, i) => (
              <p key={i} style={{ color: D.danger }}>{e}</p>
            ))}
            {errors.length > 6 && (
              <p style={{ color: D.muted }}>…還有 {errors.length - 6} 筆錯誤（將被跳過）</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 shrink-0">
          {done ? (
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: D.accent, color: D.bg }}>
              完成
            </button>
          ) : (
            <>
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: D.bg, color: D.muted }}>
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!hasFile || saving || !requiredMapped}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ backgroundColor: D.ink, color: D.bg }}>
                {saving ? '匯入中…' : `匯入 ${rows.length} 筆`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
