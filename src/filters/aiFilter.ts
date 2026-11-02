import { SEGMENTS, SOURCE_LABELS } from '../data/respondents'
import { newCondition, type Condition } from './filters'
import type { OperatorId } from './properties'

/*
 * Simulated "AI Filter": the prototype has no model behind it, so this reads the
 * description with keyword rules over the sample data's vocabulary and returns the
 * same kind of conditions a person would build by hand.
 */

export const AI_EXAMPLES = [
  'Urban respondents who haven’t signed the consent form',
  'Self captures completed but tech check not done',
  'Backup respondents aged 18-31',
  'Favorites who are repeat respondents',
]

const NEG = /\b(not|no|never|without|missing|pending|unsigned|haven'?t|hasn'?t|didn'?t|isn'?t|aren'?t|yet to|incomplete|outstanding)\b/i

const cond = (prop: string, op: OperatorId, value: string | string[] = '') => newCondition(prop, op, value)

/** The clause holding a keyword, so "completed X but not Y" reads X and Y apart. */
function clauseWith(text: string, re: RegExp): string | null {
  const clauses = text.split(/[,;.]|\bbut\b|\band\b|\bwho\b|\bwhose\b|\bwith\b|\bthat\b|\bor\b/i)
  return clauses.find((c) => re.test(c)) ?? null
}

// Other words for segment values; "never" and "other" are too common to read as one.
const SEGMENT_ALIASES: Record<string, string[] | null> = {
  man: ['man', 'men', 'male'],
  woman: ['woman', 'women', 'female'],
  never: null,
  other: null,
}

/** Matches a segment value as whole words, so "urban" doesn't match "suburban". */
function segmentValuePattern(value: string): RegExp | null {
  const words = value in SEGMENT_ALIASES ? SEGMENT_ALIASES[value] : [value]
  if (!words) return null
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(?<![\\w-])(${escaped.join('|')})(?![\\w-])`, 'i')
}

const RULES: Array<(text: string) => Condition | null> = [
  ...SEGMENTS.map((s) => (t: string) => {
    const found = s.options.filter((o) => segmentValuePattern(o)?.test(t))
    if (!found.length) return null
    if (s.multi) return cond(s.key, 'contains', found)
    return found.length === 1 ? cond(s.key, 'is', found[0]) : cond(s.key, 'any_of', found)
  }),
  (t) => (/\b(agency|uploaded|upload)\b/i.test(t) ? cond('source', 'is', SOURCE_LABELS.upload) : null),
  (t) => {
    const roles = [/\bmain\b/i.test(t) && 'Main', /\bbackups?\b/i.test(t) && 'Backup'].filter((v): v is string => Boolean(v))
    if (!roles.length) return null
    return roles.length === 1 ? cond('role', 'is', roles[0]) : cond('role', 'any_of', roles)
  },
  (t) => {
    const c = clauseWith(t, /\b(live|idis?|sessions?|self[-\s]?captures?)\b/i)
    if (c === null) return null
    // A self capture is either recorded or not; there is no assigned step.
    return cond('live', 'is', NEG.test(c) || /unassigned/i.test(c) ? 'Not completed' : 'Completed')
  },
  (t) => {
    const c = clauseWith(t, /\bconsent\b/i)
    if (c === null) return null
    return cond('consent', 'is', NEG.test(c) ? 'Not signed' : 'Signed')
  },
  (t) => {
    const c = clauseWith(t, /\btech(nical)?[-\s]?checks?\b/i)
    if (c === null) return null
    return NEG.test(c) || /attempt|fail/i.test(c) ? cond('tech', 'any_of', ['Attempted', 'Not sent']) : cond('tech', 'is', 'Completed')
  },
  (t) => {
    const c = clauseWith(t, /\b(favou?rites?|starred)\b/i)
    if (c === null) return null
    return cond('fav', 'is', NEG.test(c) ? 'false' : 'true')
  },
  (t) => {
    if (/first[-\s]time|never (taken part|participated)|new participants?/i.test(t)) return cond('prior', 'is', 'false')
    return /taken part before|participated before|returning|repeat (participants?|respondents?)/i.test(t) ? cond('prior', 'is', 'true') : null
  },
]

/** Conditions read from a plain-language description (empty when nothing matched). */
export function generateFilters(description: string): Condition[] {
  const text = description.replace(/[’‘]/g, "'")
  return RULES.map((rule) => rule(text)).filter((c): c is Condition => c !== null)
}
