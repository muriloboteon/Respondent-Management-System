import { TODAY } from '../data/respondents'
import { newCondition, type Condition } from './filters'
import { addDays, type OperatorId } from './properties'

/*
 * Simulated "AI Filter": the prototype has no model behind it, so this reads the
 * description with keyword rules over the sample data's vocabulary and returns the
 * same kind of conditions a person would build by hand.
 */

export const AI_EXAMPLES = [
  'UK respondents who haven’t signed the consent form',
  'Completed the diary but not the AI interview',
  'Not active in the last 7 days',
  'Added in the past 30 days with at least 1 activity completed',
]

const NEG = /\b(not|no|never|without|missing|pending|unsigned|haven'?t|hasn'?t|didn'?t|isn'?t|aren'?t|yet to|incomplete|outstanding)\b/i
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }

const cond = (prop: string, op: OperatorId, value: string | string[] = '') => newCondition(prop, op, value)

/** The clause holding a keyword, so "completed X but not Y" reads X and Y apart. */
function clauseWith(text: string, re: RegExp): string | null {
  const clauses = text.split(/[,;.]|\bbut\b|\band\b|\bwho\b|\bwhose\b|\bwith\b|\bthat\b|\bor\b/i)
  return clauses.find((c) => re.test(c)) ?? null
}

/** Status of a method (diary, AI interview) from the words around it. */
function methodRule(prop: string, re: RegExp) {
  return (text: string): Condition | null => {
    const c = clauseWith(text, re)
    if (c === null) return null
    if (/not started|haven'?t started|yet to start/i.test(c)) return cond(prop, 'is', 'Not started')
    if (/in progress|ongoing/i.test(c)) return cond(prop, 'is', 'In progress')
    if (/partial|dropped|stopped/i.test(c)) return cond(prop, 'is', 'Partial')
    if (/not assigned|unassigned/i.test(c)) return cond(prop, 'is', 'Not assigned')
    if (NEG.test(c)) return cond(prop, 'is_not', 'Completed')
    if (/complet|finish|done/i.test(c)) return cond(prop, 'is', 'Completed')
    return cond(prop, 'is_not', 'Not assigned')
  }
}

function days(n: string | undefined, unit: string) {
  return (n ? Number(n) : 1) * UNIT_DAYS[unit.toLowerCase()]
}

const RULES: Array<(text: string) => Condition | null> = [
  (t) => {
    const markets: string[] = []
    if (/\b(uk|united kingdom|britain|british|england)\b/i.test(t)) markets.push('UK')
    if (/\bUSA?\b/.test(t) || /\b(united states|america|american)\b/i.test(t)) markets.push('US')
    if (!markets.length) return null
    return markets.length === 1 ? cond('market', 'is', markets[0]) : cond('market', 'any_of', markets)
  },
  (t) => {
    if (/\bnon[-\s]?buyers?\b/i.test(t)) return cond('buyer', 'is', 'Non-buyer')
    const c = clauseWith(t, /\bbuyers?\b/i)
    if (c === null) return null
    return cond('buyer', 'is', /\b(not|no)\s+buyers?\b/i.test(c) ? 'Non-buyer' : 'Buyer')
  },
  (t) => {
    const types = [/\bonline\b/i.test(t) && 'Online', /\bin[-\s]?store\b/i.test(t) && 'In-store'].filter((v): v is string => Boolean(v))
    return types.length ? cond('shopper', 'contains', types) : null
  },
  (t) => (/\b(agency|uploaded|upload)\b/i.test(t) ? cond('via', 'is', 'Agency upload') : null),
  (t) => {
    if (/needs attention|something missing|missing (something|info|steps?)|not ready|blocked/i.test(t)) return cond('readiness', 'is', 'Something missing')
    return /\bready\b/i.test(t) ? cond('readiness', 'is', 'Ready') : null
  },
  methodRule('diary', /\bdiar(y|ies)\b/i),
  methodRule('ai', /\bai[-\s]?interviews?\b/i),
  (t) => {
    const c = clauseWith(t, /\b(live|idis?|sessions?)\b/i)
    if (c === null) return null
    if (/complet|finish|done/i.test(c) && !NEG.test(c)) return cond('live', 'is', 'Completed')
    if (/not assigned|unassigned/i.test(c) || NEG.test(c)) return cond('live', 'is', 'Not assigned')
    if (/schedul|assigned|booked|invited/i.test(c)) return cond('live', 'is', 'Assigned')
    return cond('live', 'is_not', 'Not assigned')
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
    return /taken part before|participated before|returning|repeat participants?/i.test(t) ? cond('prior', 'is', 'true') : null
  },
  (t) => {
    const n = /(?:at least|minimum of)\s+(\d+)\s+activit/i.exec(t) ?? /(\d+)\s*(?:\+|or more)\s+activit/i.exec(t)
    if (n) return cond('done', 'gte', n[1])
    return /\b(no|zero)\s+(completed\s+)?activit/i.test(t) ? cond('done', 'eq', '0') : null
  },
  (t) => {
    const m = /\badded\b[^,.;]*?(?:last|past|this)\s+(\d+)?\s*(day|week|month|year)s?/i.exec(t)
    return m ? cond('added', 'within', `past-${days(m[1], m[2])}`) : null
  },
  (t) => {
    const quiet = /\b(?:no|without|not)\s+(?:been\s+)?(?:active|activity|contacted|heard from)\b[^,.;]*?(?:last|past)\s+(\d+)?\s*(day|week|month|year)s?/i.exec(t)
    if (quiet) return cond('lastActivity', 'before', addDays(TODAY, -days(quiet[1], quiet[2])))
    const active = /\b(?:active|activity)\b[^,.;]*?(?:last|past)\s+(\d+)?\s*(day|week|month|year)s?/i.exec(t)
    return active ? cond('lastActivity', 'within', `past-${days(active[1], active[2])}`) : null
  },
  (t) => {
    const brands = [...t.matchAll(/\bbrand\s+([a-d])\b/gi)].map((m) => `Brand ${m[1].toUpperCase()}`)
    return brands.length ? cond('brands', 'contains', [...new Set(brands)]) : null
  },
  (t) => {
    const freq = [...new Set([...t.matchAll(/\b(weekly|monthly|rarely)\b/gi)].map((m) => m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()))]
    if (!freq.length) return null
    return freq.length === 1 ? cond('freq', 'is', freq[0]) : cond('freq', 'any_of', freq)
  },
]

/** Conditions read from a plain-language description (empty when nothing matched). */
export function generateFilters(description: string): Condition[] {
  const text = description.replace(/[’‘]/g, "'")
  return RULES.map((rule) => rule(text)).filter((c): c is Condition => c !== null)
}
