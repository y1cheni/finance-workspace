/**
 * Minimal RFC 4180-compliant CSV parser.
 * Handles quoted fields (with embedded commas and newlines), CRLF and LF line endings.
 * Returns an array of objects keyed by the header row.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = splitCsvRows(text.trim())
  if (lines.length < 2) return []

  const headers = parseRow(lines[0])
  const result: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    if (values.every(v => v === '')) continue // skip blank rows
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] ?? '').trim()
    })
    result.push(obj)
  }
  return result
}

/** Split raw CSV text into logical rows (handles quoted newlines). */
function splitCsvRows(text: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { current += '"'; i++ } // escaped quote
      else inQuote = !inQuote
    } else if ((ch === '\r' || ch === '\n') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++ // CRLF
      rows.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) rows.push(current)
  return rows
}

/** Parse a single CSV row into field values. */
function parseRow(row: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuote = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') { field += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(field); field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

/** Attempt to find a value from a row using multiple possible header aliases. */
export function pick(row: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== '') return row[a]
  }
  return ''
}

export function pickNum(row: Record<string, string>, aliases: string[]): number {
  return Number(pick(row, aliases)) || 0
}
