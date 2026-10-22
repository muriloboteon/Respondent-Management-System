import type { ColumnSizingState } from '@tanstack/react-table'
import { columns } from './respondentsTable'

/** Bump the version when column ids or default widths change incompatibly. */
const STORAGE_KEY = 'respondent-hub:column-sizing:v1'
type ColumnDefLike = { id?: string; columns?: readonly ColumnDefLike[] }
/** Leaf ids, including the sub-columns of grouped headers such as "Segments". */
const leafIds = (defs: readonly ColumnDefLike[]): string[] =>
  defs.flatMap((c) => (c.columns ? leafIds(c.columns) : c.id ? [c.id] : []))
const COLUMN_IDS = new Set(leafIds(columns))

/** Phones start with a narrower pinned column. */
export const DEFAULT_COLUMN_SIZING: ColumnSizingState =
  window.matchMedia('(max-width: 640px)').matches ? { respondent: 236 } : {}

function sameSizing(a: ColumnSizingState, b: ColumnSizingState) {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/** Saved widths for known columns, or the defaults when nothing valid is stored. */
export function loadColumnSizing(): ColumnSizingState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return DEFAULT_COLUMN_SIZING
    const sizing: ColumnSizingState = {}
    for (const [id, width] of Object.entries(parsed)) {
      if (COLUMN_IDS.has(id) && typeof width === 'number' && Number.isFinite(width) && width > 0) sizing[id] = width
    }
    return Object.keys(sizing).length ? sizing : DEFAULT_COLUMN_SIZING
  } catch {
    return DEFAULT_COLUMN_SIZING
  }
}

/** Stores widths the user changed; clears the entry when they match the defaults again. */
export function saveColumnSizing(sizing: ColumnSizingState) {
  try {
    if (sameSizing(sizing, DEFAULT_COLUMN_SIZING)) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(sizing))
  } catch {
    // Storage can be unavailable (private mode, blocked site data); widths then last for the session only.
  }
}
