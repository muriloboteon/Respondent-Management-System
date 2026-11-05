import { TODAY, type Respondent } from '@data/respondents'
import { NOT_SET, choicesFor, getProperty, type PropType, type PropertyDef } from './properties'

/* ---------- Model: one chip per property, every chip must hold (AND) ---------- */

/**
 * How a condition compares, by property type. Lists and yes / no: the value is one of the chosen
 * values, or none of them. Text: contains, or doesn't contain, the typed text. Dates: within the
 * last N days, before or after a date, or between two dates.
 */
export type Mode = 'is' | 'is_not' | 'contains' | 'not_contains' | 'in_last' | 'before' | 'after' | 'between'

export const MODES: Record<PropType, Array<[Mode, string]>> = {
  single: [['is', 'is'], ['is_not', 'is not']],
  multi: [['is', 'is'], ['is_not', 'is not']],
  boolean: [['is', 'is']],
  text: [['contains', 'contains'], ['not_contains', 'doesn’t contain']],
  date: [['in_last', 'is in the last'], ['before', 'is before'], ['after', 'is after'], ['between', 'is between']],
}

/** "is in the last …" choices, in days. */
export const LAST_DAYS: Array<[string, string]> = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', '12 months']]

export interface Condition {
  id: string
  prop: string
  mode: Mode
  /**
   * Lists: the chosen option values ("true" / "false" for yes / no; NOT_SET stands for no value).
   * Text: [typed text]. Dates: [days] for "in the last", [ISO date] for before / after, [from, to] for between.
   */
  values: string[]
}

export interface Filters {
  /** Free-text search box: names, emails or IDs, comma-separated. */
  query: string
  conditions: Condition[]
}

export const EMPTY_FILTERS: Filters = { query: '', conditions: [] }

let seq = 0
const newId = () => `f${++seq}`

/** The values a mode starts with: dates start at "the last 30 days", the rest empty. */
function startValues(mode: Mode): string[] {
  if (mode === 'in_last') return ['30']
  if (mode === 'between') return ['', '']
  if (mode === 'before' || mode === 'after') return ['']
  return []
}

export function newCondition(prop: string, values?: string[], mode?: Mode): Condition {
  const m = mode ?? MODES[getProperty(prop).type][0][0]
  return { id: newId(), prop, mode: m, values: values ?? startValues(m) }
}

/** Switching mode keeps the values where they still fit (is / is not, contains / doesn't contain, before / after). */
export function withMode(c: Condition, mode: Mode): Condition {
  const kind = (m: Mode) => (m === 'before' || m === 'after' ? 'date' : m)
  const keep = getProperty(c.prop).type !== 'date' || kind(mode) === kind(c.mode)
  return { ...c, mode, values: keep ? c.values : startValues(mode) }
}

/** A copy with a new id: stored or saved filters always get fresh ids when applied. */
export const cloneCondition = (c: Condition): Condition => ({ ...c, id: newId(), values: [...c.values] })

/** Adds a condition, or replaces the one already on its property (one chip per property). */
export function applyCondition(conditions: Condition[], next: Condition): Condition[] {
  const at = conditions.findIndex((c) => c.id === next.id || c.prop === next.prop)
  return at < 0 ? [...conditions, next] : conditions.map((c, i) => (i === at ? next : c))
}

/* ---------- Evaluation ---------- */

/** A condition still missing its values (no choice, empty text, an unset date) doesn't filter. */
export function isComplete(c: Condition) {
  const type = getProperty(c.prop).type
  if (type === 'text' || type === 'date') return c.values.length > 0 && c.values.every((v) => v.trim() !== '')
  return c.values.length > 0
}

export function activeConditions(conditions: Condition[]) {
  return conditions.filter(isComplete)
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function testCondition(r: Respondent, c: Condition): boolean {
  const prop = getProperty(c.prop)
  const raw = prop.get(r)
  if (prop.type === 'text') {
    const hit = String(raw ?? '').toLowerCase().includes(c.values[0].trim().toLowerCase())
    return c.mode === 'not_contains' ? !hit : hit
  }
  if (prop.type === 'date') {
    // ISO dates compare correctly as strings; respondents without the date never match.
    const d = raw as string | undefined
    if (!d) return false
    const [a, b] = c.values
    if (c.mode === 'in_last') return d >= addDays(TODAY, -Number(a)) && d <= TODAY
    if (c.mode === 'before') return d < a
    if (c.mode === 'after') return d > a
    return d >= (a < b ? a : b) && d <= (a < b ? b : a)
  }
  let hit: boolean
  if (prop.type === 'boolean') {
    hit = c.values.includes(String(Boolean(raw)))
  } else {
    const have = Array.isArray(raw) ? raw : raw === undefined || raw === '' ? [] : [String(raw)]
    hit = have.length ? have.some((v) => c.values.includes(v)) : c.values.includes(NOT_SET)
  }
  return c.mode === 'is' ? hit : !hit
}

export function matchesConditions(r: Respondent, conditions: Condition[]): boolean {
  return activeConditions(conditions).every((c) => testCondition(r, c))
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
  return matchesConditions(r, f.conditions)
}

/**
 * What "Filter by …" offers on a cell: the cell's own values as [value, label] (each tag of a
 * multi-value cell, "Not set" for an empty one). Dates aren't table cells.
 */
export function cellFilterValues(prop: PropertyDef, r: Respondent): Array<[string, string]> {
  const raw = prop.get(r)
  if (prop.type === 'text') return typeof raw === 'string' && raw ? [[raw, raw]] : []
  if (prop.type === 'date') return []
  const choices = choicesFor(prop)
  const label = (v: string) => choices.find((o) => o[0] === v)?.[1] ?? v
  if (prop.type === 'boolean') return [[String(Boolean(raw)), label(String(Boolean(raw)))]]
  const have = Array.isArray(raw) ? raw : raw === undefined || raw === '' ? [] : [String(raw)]
  if (!have.length) return prop.optional ? [[NOT_SET, 'Not set']] : []
  return have.map((v) => [v, label(v)])
}

/* ---------- Labels (chips) ---------- */

export interface ChipSummary {
  prop: string
  op: string
  val: string
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * "Role: Main", "Respondent Age: 25–34, 35–44 +1", "Favorite: Yes": `op` is empty for "is". Everything else
 * reads it out: "Role is not Backup", "Email contains “gmail”", "Added on in the last 30 days".
 */
export function summarize(c: Condition): ChipSummary {
  const prop = getProperty(c.prop)
  if (prop.type === 'text') {
    return { prop: prop.label, op: c.mode === 'not_contains' ? 'doesn’t contain' : 'contains', val: `“${c.values[0] ?? ''}”` }
  }
  if (prop.type === 'date') {
    const [a, b] = c.values
    if (c.mode === 'in_last') return { prop: prop.label, op: 'in the last', val: LAST_DAYS.find((d) => d[0] === a)?.[1] ?? `${a} days` }
    if (c.mode === 'between') return { prop: prop.label, op: 'between', val: a && b ? `${formatDate(a < b ? a : b)} – ${formatDate(a < b ? b : a)}` : '' }
    return { prop: prop.label, op: c.mode === 'before' ? 'before' : 'after', val: a ? formatDate(a) : '' }
  }
  const choices = choicesFor(prop)
  const names = c.values.map((v) => choices.find((o) => o[0] === v)?.[1] ?? v)
  const op = c.mode === 'is' ? '' : names.length > 1 ? 'is none of' : 'is not'
  const val = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
  return { prop: prop.label, op, val }
}

/* ---------- Saved views ---------- */

export type ViewId = 'all' | 'attention' | 'live' | 'uk'
// Placeholder names: the prototype only shows that saved views can switch the list.
export const VIEWS: Record<ViewId, { label: string; conditions: Condition[] }> = {
  all: { label: 'All respondents', conditions: [] },
  attention: { label: 'Saved view 1', conditions: [newCondition('consent', ['Not signed'])] },
  live: { label: 'Saved view 2', conditions: [newCondition('live', ['Completed'])] },
  uk: { label: 'Saved view 3', conditions: [newCondition('environment', ['Urban'])] },
}

/** A fresh copy of a view's filters, so edits never touch the saved view. */
export function viewConditions(view: ViewId): Condition[] {
  return VIEWS[view].conditions.map(cloneCondition)
}

/** Compares what the filters do, ignoring ids, value order and chips still without values. */
function signature(conditions: Condition[]) {
  return JSON.stringify(activeConditions(conditions).map((c) => [c.prop, c.mode, [...c.values].sort()]))
}

/** Like `signature`, also ignoring the order of the chips (one chip per property). */
export function conditionsKey(conditions: Condition[]) {
  return JSON.stringify(
    activeConditions(conditions)
      .map((c) => [c.prop, c.mode, [...c.values].sort()] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
  )
}

/* ---------- Metrics (the strip above the table) ---------- */

export type MetricId = 'all' | 'attention' | 'live' | 'done'
/**
 * Placeholder metrics: which numbers to show is still to be decided with product, so the
 * labels are generic (like "Saved view 1"). Each one is a filter on "All respondents", like a
 * status tab with a count; the filters behind them are only examples. Edit this list to change
 * the strip; `attention` paints the number in the warning color.
 */
export const METRICS: Array<{ id: MetricId; label: string; conditions: Condition[]; attention?: boolean }> = [
  { id: 'all', label: 'All respondents', conditions: [] },
  { id: 'attention', label: 'Metric 1 (to be defined)', conditions: [newCondition('consent', ['Not signed'])] },
  { id: 'live', label: 'Metric 2 (to be defined)', conditions: [newCondition('live', ['Not completed'])] },
  { id: 'done', label: 'Metric 3 (to be defined)', conditions: [newCondition('live', ['Completed'])] },
]

/** A fresh copy of a metric's filters. */
export function metricConditions(id: MetricId): Condition[] {
  return METRICS.find((m) => m.id === id)!.conditions.map(cloneCondition)
}

/** The metric whose filter is applied as-is on "All respondents", if any. */
export function activeMetric(view: ViewId, f: Filters): MetricId | null {
  if (view !== 'all' || searchTerms(f.query).length > 0) return null
  const current = signature(f.conditions)
  return METRICS.find((m) => signature(m.conditions) === current)?.id ?? null
}
