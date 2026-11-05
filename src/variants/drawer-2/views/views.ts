import type { ColumnOrderState, ColumnPinningState, ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { activeConditions, cloneCondition, conditionsKey, type Condition, type Mode } from '../filters/filters'
import { hasProperty } from '../filters/properties'
import { columns } from '../table/respondentsTable'

/* ---------- What a view stores ---------- */

/**
 * A named, reusable setup of the table. Column widths are not part of it: they are remembered
 * per user on their own (see columnSizingStorage), and the search box stays out too.
 */
export interface ViewState {
  conditions: Condition[]
  columnVisibility: ColumnVisibilityState
  /** Empty keeps the definition order. */
  columnOrder: ColumnOrderState
  columnPinning: ColumnPinningState
  sorting: SortingState
}

export interface SavedView {
  id: string
  name: string
  state: ViewState
  /** Shared with the team: read-only, owned by someone else. */
  owner?: string
}

/** Respondent is always pinned first; people can pin more columns after it. */
export const DEFAULT_COLUMN_PINNING: ColumnPinningState = { start: ['respondent'], end: [] }
export const DEFAULT_SORTING: SortingState = [{ id: 'respondent', desc: false }]

/** The table as it first opens: the starting point of "All respondents". */
export const DEFAULT_VIEW_STATE: ViewState = {
  conditions: [],
  columnVisibility: {},
  columnOrder: [],
  columnPinning: DEFAULT_COLUMN_PINNING,
  sorting: DEFAULT_SORTING,
}

/** "All respondents": always there, can't be renamed or deleted; it remembers its own changes. */
export const DEFAULT_VIEW_NAME = 'All respondents'

export const VIEW_NAME_MAX = 60

/* ---------- Comparing setups ---------- */

const COLUMN_IDS: string[] = (columns as readonly { id?: string }[]).flatMap((c) => (c.id ? [c.id] : []))
const KNOWN_COLUMNS = new Set(COLUMN_IDS)

/** The order as drawn: known ids in the stored order, then any column it leaves out, in definition order. */
function fullOrder(order: ColumnOrderState) {
  const known = order.filter((id) => KNOWN_COLUMNS.has(id))
  return [...known, ...COLUMN_IDS.filter((id) => !known.includes(id))]
}

/**
 * What the setup looks like, so two states that draw the same table compare equal: filters without
 * ids or value order, hidden columns as a set, the order of the unpinned columns (pinned ones follow
 * the pinning), and the sort.
 */
function viewKey(s: ViewState) {
  const pinned = s.columnPinning.start
  return JSON.stringify([
    conditionsKey(s.conditions),
    COLUMN_IDS.filter((id) => s.columnVisibility[id] === false),
    fullOrder(s.columnOrder).filter((id) => !pinned.includes(id)),
    pinned,
    s.sorting.map((x) => [x.id, x.desc]),
  ])
}

export const sameViewState = (a: ViewState, b: ViewState) => viewKey(a) === viewKey(b)

/* ---------- Describing setups (the Manage views modal) ---------- */

const COLUMN_LABELS = new Map(
  (columns as readonly { id?: string; header?: unknown }[]).flatMap((c) => (c.id ? [[c.id, String(c.header ?? c.id)] as const] : [])),
)
export const columnLabel = (id: string) => COLUMN_LABELS.get(id) ?? id
export const COLUMN_COUNT = COLUMN_IDS.length

const hiddenIds = (s: ViewState) => COLUMN_IDS.filter((id) => s.columnVisibility[id] === false)

/** What a view shows, in words: filters stay as conditions (shown as chips), the rest as text. */
export function describeState(s: ViewState) {
  const hidden = hiddenIds(s)
  const sort = s.sorting[0]
  return {
    conditions: activeConditions(s.conditions),
    shown: COLUMN_COUNT - hidden.length,
    hidden: hidden.map(columnLabel),
    pinned: s.columnPinning.start.filter((id) => id !== 'respondent').map(columnLabel),
    orderChanged: fullOrder(s.columnOrder).join() !== COLUMN_IDS.join(),
    sort: sort ? `${columnLabel(sort.id)}, ${sort.desc ? 'descending' : 'ascending'}` : 'None',
  }
}

/** A copy to store: only filters that do something, nothing shared with the live table state. */
export function snapshot(s: ViewState): ViewState {
  return {
    conditions: activeConditions(s.conditions).map((c) => ({ ...c, values: [...c.values] })),
    columnVisibility: { ...s.columnVisibility },
    columnOrder: [...s.columnOrder],
    columnPinning: { start: [...s.columnPinning.start], end: [...s.columnPinning.end] },
    sorting: s.sorting.map((x) => ({ ...x })),
  }
}

/** A copy to apply to the table: filters get fresh ids, so they never clash with ones on screen. */
export function forTable(s: ViewState): ViewState {
  const copy = snapshot(s)
  return { ...copy, conditions: copy.conditions.map(cloneCondition) }
}

/* ---------- Reading stored setups ---------- */

const MODES: readonly Mode[] = ['is', 'is_not', 'contains', 'not_contains', 'in_last', 'before', 'after', 'between']
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

function parseCondition(v: unknown): Condition | null {
  if (!isObject(v) || typeof v.prop !== 'string' || !hasProperty(v.prop)) return null
  if (!MODES.includes(v.mode as Mode) || !isStringList(v.values)) return null
  return { id: typeof v.id === 'string' ? v.id : '', prop: v.prop, mode: v.mode as Mode, values: v.values }
}

/**
 * A stored setup, cleaned up for the current table: unknown columns and filter properties are
 * dropped, and anything malformed falls back to the default. Null when it isn't a setup at all.
 */
export function parseViewState(v: unknown): ViewState | null {
  if (!isObject(v)) return null
  const conditions = Array.isArray(v.conditions) ? v.conditions.map(parseCondition).filter((c): c is Condition => c !== null) : []
  const columnVisibility: ColumnVisibilityState = {}
  if (isObject(v.columnVisibility)) {
    for (const [id, shown] of Object.entries(v.columnVisibility)) {
      if (KNOWN_COLUMNS.has(id) && typeof shown === 'boolean') columnVisibility[id] = shown
    }
  }
  const columnOrder = isStringList(v.columnOrder) ? v.columnOrder.filter((id) => KNOWN_COLUMNS.has(id)) : []
  const pinning = isObject(v.columnPinning) && isStringList(v.columnPinning.start) ? v.columnPinning.start.filter((id) => KNOWN_COLUMNS.has(id)) : []
  const columnPinning = { start: ['respondent', ...pinning.filter((id) => id !== 'respondent')], end: [] }
  const sorting = Array.isArray(v.sorting)
    ? v.sorting.filter((x): x is { id: string; desc: boolean } => isObject(x) && typeof x.id === 'string' && KNOWN_COLUMNS.has(x.id) && typeof x.desc === 'boolean')
    : []
  return {
    conditions,
    columnVisibility,
    columnOrder,
    columnPinning,
    sorting: sorting.length ? sorting.slice(0, 1).map(({ id, desc }) => ({ id, desc })) : DEFAULT_SORTING,
  }
}

export function parseSavedView(v: unknown): SavedView | null {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null
  const state = parseViewState(v.state)
  return state ? { id: v.id, name: v.name, state } : null
}

/* ---------- Names ---------- */

const nameKey = (name: string) => name.trim().toLocaleLowerCase()

/** The inline error for a view name, or null when it can be used. `exceptId`: the view being renamed. */
export function viewNameError(name: string, myViews: SavedView[], exceptId?: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter a name for the view.'
  if (trimmed.length > VIEW_NAME_MAX) return `Use ${VIEW_NAME_MAX} characters or fewer.`
  if (myViews.some((v) => v.id !== exceptId && nameKey(v.name) === nameKey(trimmed))) return 'You already have a view with this name.'
  return null
}

/** "UK pool (copy)", then "UK pool (copy 2)" and so on, kept within the name limit. */
export function copyName(name: string, myViews: SavedView[]) {
  const taken = new Set(myViews.map((v) => nameKey(v.name)))
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? ' (copy)' : ` (copy ${n})`
    const candidate = `${name.slice(0, VIEW_NAME_MAX - suffix.length).trimEnd()}${suffix}`
    if (!taken.has(nameKey(candidate))) return candidate
  }
}

export const newViewId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
