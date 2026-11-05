import {
  INTERVIEW_ROLES,
  INTERVIEW_SESSIONS,
  SEGMENTS,
  SOURCE_LABELS,
  interviewSession,
  limitPII,
  respondents,
  sourceLabel,
  type Respondent,
} from '@data/respondents'

/* ---------- Properties people can filter by ---------- */

/**
 * One value from a list, several values from a list, yes / no, free text (matched by "contains")
 * or a date (relative or absolute).
 */
export type PropType = 'single' | 'multi' | 'boolean' | 'text' | 'date'

export type PropCategory = 'respondent' | 'segment'

export interface PropertyDef {
  id: string
  label: string
  type: PropType
  category: PropCategory
  /** The table column it filters, for "Filter by …" in the column menu and on cells. */
  column?: string
  /** Choices for list and yes / no properties: [value, label]. Empty for text and dates. */
  options: Array<[string, string]>
  /** Some respondents have no value: list choices end with "Not set". */
  optional?: boolean
  get: (r: Respondent) => string | string[] | boolean | undefined
}

export const CATEGORY_LABELS: Record<PropCategory, string> = {
  respondent: 'Respondent',
  segment: 'Segments',
}

/** Stands for "no value" among a condition's values. */
export const NOT_SET = '__not_set'

const opts = (...values: string[]): Array<[string, string]> => values.map((v) => [v, v])
const YES_NO: Array<[string, string]> = [['true', 'Yes'], ['false', 'No']]
/** Status cells show "—" when a step does not apply; filters treat that as not set. */
const status = (s: string) => (s === '—' ? undefined : s)
/** The timezones in the sample, by name. */
const TIMEZONES = [...new Set(respondents.flatMap((r) => (r.timezone ? [r.timezone] : [])))].sort()
/** Panel recruits have no contact details; hidden PII can't be filtered (it would give the values away). */
const contact = (r: Respondent, field: 'email' | 'phone') => (r.src === 'rio' || limitPII ? undefined : r[field])

/** The table's columns, in the table's order and with the same names, plus the dates a respondent carries. */
export const PROPERTIES: PropertyDef[] = [
  { id: 'name', label: 'Respondent', type: 'text', category: 'respondent', column: 'respondent', options: [], get: (r) => r.name },
  { id: 'interview', label: 'Assign to Interview', type: 'single', category: 'respondent', column: 'interview', options: opts(...INTERVIEW_SESSIONS.map((s) => s.name)), optional: true, get: (r) => interviewSession(r)?.name },
  { id: 'role', label: 'Role', type: 'single', category: 'respondent', column: 'role', options: opts(...INTERVIEW_ROLES), optional: true, get: (r) => r.role },
  { id: 'live', label: 'Self Captures', type: 'single', category: 'respondent', column: 'live', options: opts('Completed', 'Not completed'), get: (r) => r.liveDoc },
  { id: 'tech', label: 'Tech check', type: 'single', category: 'respondent', column: 'tech', options: opts('Completed', 'Attempted', 'Not sent'), optional: true, get: (r) => status(r.tech) },
  { id: 'consent', label: 'Consent form', type: 'single', category: 'respondent', column: 'consent', options: opts('Signed', 'Not signed'), get: (r) => r.consent },
  { id: 'prior', label: 'Repeat Respondent', type: 'boolean', category: 'respondent', column: 'prior', options: YES_NO, get: (r) => r.prior === 'Yes' },
  { id: 'fav', label: 'Favorite', type: 'boolean', category: 'respondent', column: 'fav', options: YES_NO, get: (r) => r.fav },
  { id: 'pid', label: 'ID', type: 'text', category: 'respondent', column: 'pid', options: [], get: (r) => r.pid },
  ...(limitPII ? [] : [{ id: 'email', label: 'Email', type: 'text', category: 'respondent', column: 'email', options: [], get: (r) => contact(r, 'email') } satisfies PropertyDef]),
  { id: 'timezone', label: 'Timezone', type: 'single', category: 'respondent', column: 'timezone', options: opts(...TIMEZONES), optional: true, get: (r) => r.timezone },
  { id: 'source', label: 'Source', type: 'single', category: 'respondent', column: 'source', options: opts(...Object.values(SOURCE_LABELS)), get: (r) => sourceLabel(r) },
  { id: 'addedOn', label: 'Added on', type: 'date', category: 'respondent', options: [], get: (r) => r.addedOn },
  { id: 'lastActivity', label: 'Last activity', type: 'date', category: 'respondent', options: [], get: (r) => r.lastActivity },
  ...SEGMENTS.map((s): PropertyDef => ({
    id: s.key,
    label: s.label,
    type: s.multi ? 'multi' : 'single',
    category: 'segment',
    column: `seg${s.key.charAt(0).toUpperCase()}${s.key.slice(1)}`,
    options: opts(...s.options),
    optional: true,
    get: (r) => (s.multi ? r.segments[s.key] : r.segments[s.key]?.[0]),
  })),
]

const BY_ID = new Map(PROPERTIES.map((p) => [p.id, p]))
export function getProperty(id: string): PropertyDef {
  const prop = BY_ID.get(id)
  if (!prop) throw new Error(`Unknown filter property: ${id}`)
  return prop
}

/** False for ids that are no longer filterable (e.g. from an older saved view). */
export const hasProperty = (id: string) => BY_ID.has(id)

/** The filter for a table column, if the column can be filtered. */
export function propertyForColumn(columnId: string): PropertyDef | undefined {
  return PROPERTIES.find((p) => p.column === columnId)
}

/** The property's choices, with "Not set" last when some respondents have no value. */
export function choicesFor(prop: PropertyDef): Array<[string, string]> {
  return prop.optional ? [...prop.options, [NOT_SET, 'Not set']] : prop.options
}
