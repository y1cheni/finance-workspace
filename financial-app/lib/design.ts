// Shared CSS-variable-based design tokens for all dashboard pages.
// Use these in style={{ }} props so dark mode works automatically.
export const D = {
  bg:       'var(--bg)',
  surface:  'var(--surface)',
  ink:      'var(--ink)',
  muted:    'var(--muted)',
  subtle:   'var(--subtle)',
  accent:   'var(--accent)',
  danger:   'var(--danger)',
  font:     'var(--font-mono), monospace',
} as const

// Card wrapper — rounded, surface bg, no border/shadow
export const card = {
  backgroundColor: 'var(--surface)',
  borderRadius: '1rem',
  padding: '1.25rem',
} as const

// Stat card
export const statCard = {
  backgroundColor: 'var(--surface)',
  borderRadius: '1rem',
  padding: '1rem',
} as const
