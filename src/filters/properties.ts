import {
  INTERVIEW_ROLES,
  INTERVIEW_SESSIONS,
  SEGMENTS,
  SOURCE_LABELS,
  TODAY,
  interviewSession,
  sourceLabel,
  timezoneLabel,
  type Respondent,
} from '../data/respondents'

/* ---------- Property types and their operators (same set as Rally) ---------- */

export type PropType = 'text' | 'number' | 'date' | 'boolean' | 'single' | 'multi'

export type OperatorId =
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'is' | 'is_not' | 'is_empty' | 'not_empty'
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'after' | 'before' | 'within' | 'on_or_after' | 'on_or_before'
  | 'any_of' | 'none_of'

export interface Operator {
  id: OperatorId
  label: string
}

const op = (id: OperatorId, label: string): Operator => ({ id, label })
const IS_EMPTY = op('is_empty', 'is empty')
const NOT_EMPTY = op('not_empty', 'is not empty')

export const OPERATORS: Record<PropType, Operator[]> = {
  text: [op('contains', 'contains'), op('not_contains', 'does not contain'), op('ends_with', 'ends with'), op('starts_with', 'starts with'), op('is', 'is'), op('is_not', 'is not'), IS_EMPTY, NOT_EMPTY],
  number: [op('eq', 'is equal to'), op('neq', 'is not equal to'), op('gt', 'is greater than'), op('gte', 'is greater than or equal to'), op('lt', 'is less than'), op('lte', 'is less than or equal to'), IS_EMPTY, NOT_EMPTY],
  date: [op('is', 'is'), op('is_not', 'is not'), op('after', 'is after'), op('before', 'is before'), op('within', 'is within'), op('on_or_after', 'is on or after'), op('on_or_before', 'is on or before'), IS_EMPTY, NOT_EMPTY],
  boolean: [op('is', 'is'), op('is_not', 'is not')],
  single: [op('is', 'is'), op('is_not', 'is not'), op('any_of', 'is any of'), op('none_of', 'is none of'), IS_EMPTY, NOT_EMPTY],
  multi: [op('contains', 'contains'), op('not_contains', 'does not contain'), IS_EMPTY, NOT_EMPTY],
}

/** Operators that take no value. */
export const NO_VALUE_OPS: ReadonlySet<OperatorId> = new Set(['is_empty', 'not_empty'])

/** Operators whose value is a list of choices. */
export function takesList(type: PropType, operator: OperatorId) {
  return type === 'multi' || operator === 'any_of' || operator === 'none_of'
}

export function operatorLabel(type: PropType, operator: OperatorId) {
  return OPERATORS[type].find((o) => o.id === operator)?.label ?? operator
}

/* ---------- Properties ---------- */

export type PropCategory = 'respondent' | 'segment'
type RawValue = string | number | boolean | string[] | undefined

export interface PropertyDef {
  id: string
  label: string
  type: PropType
  category: PropCategory
  /** Choices for select properties: [value, label]. */
  options?: Array<[string, string]>
  get: (r: Respondent) => RawValue
}

export const CATEGORY_LABELS: Record<PropCategory, string> = {
  respondent: 'Respondent properties',
  segment: 'Segments',
}

const opts = (...values: string[]): Array<[string, string]> => values.map((v) => [v, v])
/** Status cells show "—" when a step does not apply; filters treat that as empty. */
const status = (s: string) => (s === '—' ? undefined : s)

/** One property per table column, in the table's order and with the same names. */
export const PROPERTIES: PropertyDef[] = [
  { id: 'name', label: 'Respondent', type: 'text', category: 'respondent', get: (r) => r.name },
  { id: 'interview', label: 'Assign to Interview', type: 'single', category: 'respondent', options: opts(...INTERVIEW_SESSIONS.map((s) => s.name)), get: (r) => interviewSession(r)?.name },
  { id: 'role', label: 'Role', type: 'single', category: 'respondent', options: opts(...INTERVIEW_ROLES), get: (r) => r.role },
  { id: 'live', label: 'Self Captures', type: 'single', category: 'respondent', options: opts('Completed', 'Not completed'), get: (r) => r.liveDoc },
  { id: 'tech', label: 'Tech check', type: 'single', category: 'respondent', options: opts('Completed', 'Attempted', 'Not sent'), get: (r) => status(r.tech) },
  { id: 'consent', label: 'Consent form', type: 'single', category: 'respondent', options: opts('Signed', 'Not signed'), get: (r) => r.consent },
  { id: 'prior', label: 'Repeat Respondent', type: 'boolean', category: 'respondent', get: (r) => r.prior === 'Yes' },
  { id: 'fav', label: 'Favorite', type: 'boolean', category: 'respondent', get: (r) => r.fav },
  { id: 'pid', label: 'ID', type: 'text', category: 'respondent', get: (r) => r.pid },
  { id: 'email', label: 'Email', type: 'text', category: 'respondent', get: (r) => r.email },
  { id: 'phone', label: 'Phone', type: 'text', category: 'respondent', get: (r) => r.phone },
  { id: 'timezone', label: 'Timezone', type: 'text', category: 'respondent', get: (r) => timezoneLabel(r) ?? undefined },
  { id: 'source', label: 'Source', type: 'single', category: 'respondent', options: opts(...Object.values(SOURCE_LABELS)), get: (r) => sourceLabel(r) },
  ...SEGMENTS.map((s): PropertyDef => ({
    id: s.key,
    label: s.label,
    type: s.multi ? 'multi' : 'single',
    category: 'segment',
    options: opts(...s.options),
    get: (r) => (s.multi ? r.segments[s.key] : r.segments[s.key]?.[0]),
  })),
]

const BY_ID = new Map(PROPERTIES.map((p) => [p.id, p]))
export function getProperty(id: string): PropertyDef {
  const prop = BY_ID.get(id)
  if (!prop) throw new Error(`Unknown filter property: ${id}`)
  return prop
}

export const TYPE_LABELS: Record<PropType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / no',
  single: 'Single select',
  multi: 'Multi-select',
}

/* ---------- Dates ---------- */

/** "is within" presets; the AI filter can also produce any "past-N" / "next-N". */
export const WITHIN_PRESETS: Array<[string, string]> = [
  ['past-7', 'the past week'],
  ['past-30', 'the past month'],
  ['past-90', 'the past 3 months'],
  ['past-365', 'the past year'],
  ['next-7', 'the next week'],
  ['next-30', 'the next month'],
]

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Inclusive [from, to] range of a "past-N" / "next-N" value, relative to TODAY. */
export function withinRange(value: string): [string, string] | null {
  const m = /^(past|next)-(\d+)$/.exec(value)
  if (!m) return null
  const n = Number(m[2])
  return m[1] === 'past' ? [addDays(TODAY, -n), TODAY] : [TODAY, addDays(TODAY, n)]
}

export function withinLabel(value: string) {
  const preset = WITHIN_PRESETS.find((p) => p[0] === value)
  if (preset) return preset[1]
  const m = /^(past|next)-(\d+)$/.exec(value)
  return m ? `the ${m[1]} ${m[2]} days` : value
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
