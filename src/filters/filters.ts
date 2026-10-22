import type { GroupBy, Respondent } from '../data/respondents'
import {
  NO_VALUE_OPS,
  OPERATORS,
  formatDate,
  getProperty,
  operatorLabel,
  takesList,
  withinLabel,
  withinRange,
  type OperatorId,
  type PropType,
} from './properties'

/* ---------- Model: property + operator + value, in AND/OR groups (one level deep) ---------- */

export type Join = 'and' | 'or'

export interface Condition {
  kind: 'condition'
  id: string
  /** Null until a property is picked. */
  prop: string | null
  op: OperatorId
  /** Text, number, ISO date, "true"/"false", a "past-N" range, or a list of choices. */
  value: string | string[]
}

export interface Group {
  kind: 'group'
  id: string
  join: Join
  conditions: Condition[]
}

export type FilterItem = Condition | Group

export interface FilterTree {
  join: Join
  items: FilterItem[]
}

export interface Filters {
  /** Free-text search box: names, emails or IDs, comma-separated. */
  query: string
  tree: FilterTree
}

export const EMPTY_TREE: FilterTree = { join: 'and', items: [] }
export const EMPTY_FILTERS: Filters = { query: '', tree: EMPTY_TREE }

let seq = 0
export const newId = () => `f${++seq}`

export function defaultValue(type: PropType, operator: OperatorId): string | string[] {
  if (takesList(type, operator)) return []
  if (type === 'boolean') return 'true'
  if (operator === 'within') return 'past-30'
  return ''
}

export function newCondition(prop: string | null = null, operator?: OperatorId, value?: string | string[]): Condition {
  const type = prop ? getProperty(prop).type : 'text'
  const op = operator ?? OPERATORS[type][0].id
  return { kind: 'condition', id: newId(), prop, op, value: value ?? defaultValue(type, op) }
}

/** Switching operator keeps the value when it still fits (e.g. "is" → "is any of"). */
export function withOperator(c: Condition, operator: OperatorId): Condition {
  const type = getProperty(c.prop!).type
  const wantsList = takesList(type, operator)
  let value = c.value
  if (wantsList && !Array.isArray(value)) value = value ? [value] : []
  else if (!wantsList && Array.isArray(value)) value = value[0] ?? defaultValue(type, operator)
  if (type === 'date' && (operator === 'within') !== (c.op === 'within')) value = defaultValue(type, operator)
  return { ...c, op: operator, value }
}

export function cloneItem<T extends FilterItem>(item: T): T {
  if (item.kind === 'condition') return { ...item, id: newId(), value: Array.isArray(item.value) ? [...item.value] : item.value }
  return { ...item, id: newId(), conditions: item.conditions.map(cloneItem) }
}

/** Drops rows that never got a property (and groups left empty), e.g. when the panel closes. */
export function pruneEmpty(tree: FilterTree): FilterTree {
  const items = tree.items
    .map((item) => (item.kind === 'group' ? { ...item, conditions: item.conditions.filter((c) => c.prop !== null) } : item))
    .filter((item) => (item.kind === 'group' ? item.conditions.length > 0 : item.prop !== null))
  return items.length === tree.items.length && items.every((item, i) => item === tree.items[i]) ? tree : { ...tree, items }
}

/* ---------- Evaluation ---------- */

export function isComplete(c: Condition): boolean {
  if (!c.prop) return false
  if (NO_VALUE_OPS.has(c.op)) return true
  if (Array.isArray(c.value)) return c.value.length > 0
  if (getProperty(c.prop).type === 'number') return c.value.trim() !== '' && Number.isFinite(Number(c.value))
  return c.value.trim() !== ''
}

function isEmptyValue(v: unknown) {
  return v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

export function testCondition(r: Respondent, c: Condition): boolean {
  const prop = getProperty(c.prop!)
  const raw = prop.get(r)
  if (c.op === 'is_empty') return isEmptyValue(raw)
  if (c.op === 'not_empty') return !isEmptyValue(raw)
  const value = c.value

  switch (prop.type) {
    case 'text': {
      const s = String(raw ?? '').toLowerCase()
      const q = String(value).trim().toLowerCase()
      if (c.op === 'contains') return s.includes(q)
      if (c.op === 'not_contains') return !s.includes(q)
      if (c.op === 'starts_with') return s.startsWith(q)
      if (c.op === 'ends_with') return s.endsWith(q)
      return c.op === 'is' ? s === q : s !== q
    }
    case 'number': {
      if (raw === undefined) return c.op === 'neq'
      const n = Number(raw)
      const q = Number(value)
      return { eq: n === q, neq: n !== q, gt: n > q, gte: n >= q, lt: n < q, lte: n <= q }[c.op as 'eq'] ?? false
    }
    case 'date': {
      const d = raw as string | undefined
      if (!d) return c.op === 'is_not'
      const q = value as string
      if (c.op === 'within') {
        const range = withinRange(q)
        return range !== null && d >= range[0] && d <= range[1]
      }
      // ISO dates compare correctly as strings.
      return { is: d === q, is_not: d !== q, after: d > q, before: d < q, on_or_after: d >= q, on_or_before: d <= q }[c.op as 'is'] ?? false
    }
    case 'boolean': {
      const matches = Boolean(raw) === (value === 'true')
      return c.op === 'is' ? matches : !matches
    }
    case 'single': {
      const s = raw as string | undefined
      if (c.op === 'any_of') return s !== undefined && (value as string[]).includes(s)
      if (c.op === 'none_of') return s === undefined || !(value as string[]).includes(s)
      return c.op === 'is' ? s === value : s !== value
    }
    case 'multi': {
      const list = (raw as string[] | undefined) ?? []
      const hit = (value as string[]).some((v) => list.includes(v))
      return c.op === 'contains' ? hit : !hit
    }
  }
}

/** Groups and incomplete rows that have nothing to test yet are skipped. */
export function activeItems(tree: FilterTree): FilterItem[] {
  return tree.items.filter((item) => (item.kind === 'condition' ? isComplete(item) : item.conditions.some(isComplete)))
}

function combine(join: Join, tests: boolean[]) {
  return join === 'and' ? tests.every(Boolean) : tests.some(Boolean)
}

export function matchesTree(r: Respondent, tree: FilterTree): boolean {
  const items = activeItems(tree)
  if (!items.length) return true
  return combine(
    tree.join,
    items.map((item) =>
      item.kind === 'condition' ? testCondition(r, item) : combine(item.join, item.conditions.filter(isComplete).map((c) => testCondition(r, c))),
    ),
  )
}

export function searchTerms(query: string): string[] {
  return query.split(/[,;\n]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)
}

export function matchesFilters(r: Respondent, f: Filters): boolean {
  const terms = searchTerms(f.query)
  if (terms.length) {
    const hay = `${r.name} ${r.pid} ${r.email ?? ''} ${r.rio ?? ''}`.toLowerCase()
    if (!terms.some((t) => hay.includes(t))) return false
  }
  return matchesTree(r, f.tree)
}

/* ---------- Labels (chips, AI results) ---------- */

export function valueLabel(c: Condition): string {
  if (NO_VALUE_OPS.has(c.op)) return ''
  const prop = getProperty(c.prop!)
  const label = (v: string) => prop.options?.find((o) => o[0] === v)?.[1] ?? v
  if (Array.isArray(c.value)) {
    const names = c.value.map(label)
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
  }
  if (prop.type === 'boolean') return c.value === 'true' ? 'True' : 'False'
  if (prop.type === 'date') return c.op === 'within' ? withinLabel(c.value) : formatDate(c.value)
  return label(c.value)
}

export interface ChipSummary {
  prop: string
  op: string
  val: string
}

export function summarize(item: FilterItem): ChipSummary {
  if (item.kind === 'condition') {
    const prop = getProperty(item.prop!)
    return { prop: prop.label, op: operatorLabel(prop.type, item.op), val: valueLabel(item) }
  }
  const n = item.conditions.filter(isComplete).length
  return { prop: 'Group', op: item.join === 'and' ? 'matches all of' : 'matches any of', val: `${n} filter${n === 1 ? '' : 's'}` }
}

/* ---------- Saved views ---------- */

const where = (prop: string, operator: OperatorId, value: string | string[]) => newCondition(prop, operator, value)

export type ViewId = 'all' | 'attention' | 'live' | 'uk'
// Placeholder names: the prototype only shows that saved views can switch the list.
export const VIEWS: Record<ViewId, { label: string; tree: FilterTree }> = {
  all: { label: 'All respondents', tree: EMPTY_TREE },
  attention: { label: 'Saved view 1', tree: { join: 'and', items: [where('readiness', 'is', 'Something missing')] } },
  live: { label: 'Saved view 2', tree: { join: 'and', items: [where('live', 'is_not', 'Not assigned')] } },
  uk: { label: 'Saved view 3', tree: { join: 'and', items: [where('market', 'is', 'UK')] } },
}

/** A fresh copy of a view's filters, so edits never touch the saved view. */
export function viewTree(view: ViewId): FilterTree {
  const tree = VIEWS[view].tree
  return { join: tree.join, items: tree.items.map(cloneItem) }
}

/** Compares what the filters do, ignoring ids and rows that are still incomplete. */
function signature(tree: FilterTree) {
  const strip = (c: Condition) => [c.prop, c.op, c.value]
  const items = activeItems(tree)
  return JSON.stringify([
    items.length > 1 ? tree.join : '',
    items.map((item) => (item.kind === 'condition' ? strip(item) : [item.join, item.conditions.filter(isComplete).map(strip)])),
  ])
}

export function isViewDirty(view: ViewId, f: Filters): boolean {
  return signature(VIEWS[view].tree) !== signature(f.tree) || searchTerms(f.query).length > 0
}

/* ---------- Group by (lives in the filter panel footer) ---------- */

export const GROUP_BY_OPTIONS: Array<[GroupBy, string]> = [
  ['none', 'No grouping'],
  ['market', 'Market'],
  ['buyer', 'Buyer status'],
  ['via', 'Recruited via'],
]
