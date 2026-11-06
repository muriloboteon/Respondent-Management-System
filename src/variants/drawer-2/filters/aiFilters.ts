import { INTERVIEW_SESSIONS, SEGMENTS, TODAY } from '@data/respondents'
import { applyCondition, newCondition, type Condition, type Mode } from './filters'
import { NOT_SET, getProperty, hasProperty } from './properties'

/*
 * "Filter with AI", simulated. A real version would send the property list (ids, types and
 * choices; never respondent data) and the prompt to a language model and get back conditions in
 * this same shape. Here a set of phrase rules stands in for the model, so the prototype runs
 * offline and gives the same answer every time. It reads English only.
 */

export interface Interpretation {
  /** One per property, applied over the current filters (a property already filtered is replaced). */
  conditions: Condition[]
  /** Properties whose filters to take off ("remove the country filter"). */
  remove: string[]
  /** Start from no filters ("start over", "clear filters"). */
  clearAll: boolean
  /** Words it couldn't place, as typed. */
  unmatched: string[]
  /** Words that fit more than one property ("completed": self captures or tech check?). */
  ambiguous: string[]
  /** "or" between different properties: filters can't do that (every filter must hold). */
  orAcross: boolean
}

/** Shown under the search field while it's empty. */
export const AI_EXAMPLES = [
  'Women in the UK aged 25–34',
  'Consent not signed, added in the last 30 days',
  'Repeat respondents who buy online, excluding students',
]

/* ---------- What the words can set ---------- */

interface Target {
  prop: string
  values: string[]
  mode?: Mode
  /** What "not …" gives, when it isn't "is not" the same values. */
  negated?: Target
}

interface Hit {
  start: number
  end: number
  /** One target, or several when the words fit more than one property. */
  targets: Target[]
  /** Already reads its own "not" (dates, ages, "unassigned"…). */
  fixed?: boolean
  /** More words the hit accounts for (the "added" in "added in the last 30 days"). */
  also?: Array<[number, number]>
}

interface Term {
  targets: Target[]
  re: RegExp
  /** Matched on the text as typed: "US" is the country, "us" is not. */
  caseSensitive?: boolean
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Whole words only: "men" doesn't match inside "women", "drinkers" not inside "non-drinkers". */
const words = (src: string) => new RegExp(`(?<![\\w-])(?:${src})(?![\\w-])`, 'g')

const TERMS: Term[] = []
const term = (prop: string, value: string | string[], src: string, extra: Partial<Target> = {}, caseSensitive = false) => {
  if (!hasProperty(prop)) return
  TERMS.push({ targets: [{ prop, values: Array.isArray(value) ? value : [value], ...extra }], re: words(src), caseSensitive })
}

// Every segment value by its own name ("Urban", "Liquor store", "Self-employed"), plurals included.
for (const s of SEGMENTS) {
  if (s.key === 'age') continue // ages are read as numbers below
  for (const o of s.options) {
    if (o === 'Other') continue
    const src = esc(o.toLowerCase().replace(/–/g, '-'))
    term(s.key, o, /[a-z]$/.test(src) ? `${src}(?:e?s)?` : src)
  }
}

// The ways people say segment values.
const SYNONYMS: Array<[string, string, string]> = [
  ['gender', 'Female', 'wom[ae]n|females?|ladies|girls'],
  ['gender', 'Male', 'm[ae]n|males?|guys'],
  ['gender', 'Non-binary', 'non-?binary|enby'],
  ['country', 'United Kingdom', 'u\\.?k\\.?|britain|great britain|england|british|britons?'],
  ['country', 'United States of America', 'usa|u\\.s\\.(?:a\\.)?|united states|america|americans?'],
  ['country', 'Brazil', 'brasil|brazilians?'],
  ['country', 'Mexico', 'mexicans?'],
  ['country', 'Canada', 'canadians?'],
  ['country', 'France', 'french'],
  ['country', 'Germany', 'germans?'],
  ['country', 'Italy', 'italians?'],
  ['country', 'Argentina', 'argentin(?:e|ians?)'],
  ['country', 'Colombia', 'colombians?'],
  ['country', 'Chile', 'chileans?'],
  ['country', 'Peru', 'peruvians?'],
  ['country', 'China', 'chinese'],
  ['country', 'South Korea', 'korea|south koreans?|koreans?'],
  ['country', 'Nigeria', 'nigerians?'],
  ['country', 'South Africa', 'south africans?'],
  ['country', 'Netherlands', 'the netherlands|holland|dutch'],
  ['income', 'Low income', 'low(?:er)?[- ]income|low sel|poor'],
  ['income', 'Medium income', 'mid(?:dle)?[- ]income|medium[- ]income|middle[- ]class|medium sel'],
  ['income', 'High income', 'high(?:er)?[- ]income|wealthy|affluent|rich|high sel'],
  ['ethnicity', 'Hispanic / Latino', 'hispanics?|latin[oa]s?|latinx|latine'],
  ['ethnicity', 'Mixed / Multiracial', 'mixed(?: race)?|multiracial|biracial'],
  ['education', 'Primary', 'primary (?:school|education)'],
  ['education', 'Secondary', 'high school|secondary (?:school|education)'],
  ['education', 'University without degree', 'some college|college dropouts?|no degree|without a degree'],
  ['education', 'University with degree', 'college degree|university degree|degree holders?|graduates|bachelor\'?s?(?: degrees?)?|college[- ]educated'],
  ['education', 'Postgraduate', 'post-?graduates?|masters?(?: degrees?)?|ph\\.?d\\.?s?|doctorates?'],
  ['environment', 'Urban', 'city|cities|city dwellers|urbanites'],
  ['environment', 'Rural', 'countryside|rural areas'],
  ['environment', 'Suburban', 'suburbs|suburbia'],
  ['employment', 'Student', 'students?|studying'],
  ['employment', 'Labourer', 'labou?rers?|blue[- ]collar(?: workers)?'],
  ['employment', 'Part-time employed', 'part[- ]time(?: workers?| employed| jobs?)?'],
  ['employment', 'Full-time employed', 'full[- ]time(?: workers?| employed| jobs?)?'],
  ['employment', 'Self-employed', 'self[- ]employed|freelancers?|entrepreneurs?'],
  ['employment', 'Unemployed', 'unemployed|jobless|out of work'],
  ['employment', 'Retired', 'retired|retirees?|pensioners?'],
  ['employment', 'Housewife / Househusband', 'housewi(?:fe|ves)|househusbands?|homemakers?|stay[- ]at[- ]home(?: parents?| moms?| dads?)?'],
  ['recency', 'P7D: Lovers', 'lovers|weekly drinkers|p7d'],
  ['recency', 'P4W: Occasionals', 'occasionals?|occasional drinkers|monthly drinkers|p4w'],
  ['recency', 'P3M–P12M: Drinkers', 'drinkers|p3m|p12m'],
  ['recency', 'P12M+: Non-drinkers', 'non[- ]?drinkers|(?:don\'t|do not|doesn\'t|does not) drink|p12m\\+'],
  ['channel', 'Grocery', 'grocery(?: stores?)?|groceries|supermarkets?'],
  ['channel', 'Convenience', 'convenience(?: stores?)?|corner shops?'],
  ['channel', 'Club store', 'club stores?|warehouse clubs?|costco'],
  ['channel', 'Liquor store', 'liquor stores?|off[- ]licen[cs]es?'],
  ['channel', 'Bar', 'pubs?'],
  ['channel', 'Delivery app', 'delivery(?: apps?)?|ubereats|doordash'],
  ['channel', 'E-commerce', 'e-?commerce|online'],
  ['household', 'Empty nester', 'empty[- ]nesters?'],
  ['household', 'Lives alone', 'li(?:ve|ves|ving) alone|single[- ]person households?'],
  ['household', 'Lives with parents', 'li(?:ve|ves|ving) with (?:their )?parents'],
  ['household', 'Lives with partner + adult kids', 'adult (?:kids|children)'],
  ['household', 'Lives with partner + kids under 18', '(?:kids|children) under 18|young (?:kids|children)|(?:with|have|has) (?:kids|children)|parents'],
  ['household', 'Lives with partner no kids', '(?:couples?|partners?) (?:with )?no kids|couples? without (?:kids|children)|no (?:kids|children)|childless'],
  ['household', 'Lives with roommates', 'roommates|flatmates|housemates'],
  ['household', 'Multigenerational household', 'multi-?generational(?: households?)?'],
  ['zone', 'AFR', 'africa|africans?'],
  ['zone', 'APAC', 'asia(?: pacific)?|apac'],
  ['zone', 'EUR', 'europe|europeans?'],
  ['zone', 'NAZ', 'north america'],
  ['zone', 'MAZ', 'central america|middle america'],
  ['zone', 'SAZ', 'south america|south americans'],
  ['reason', 'Price and promotions at the moment of purchase', 'prices?|promotions?|promos?|deals?|discounts?|price[- ](?:sensitive|driven)'],
  ['reason', 'Taste built over years of regular consumption', 'taste'],
  ['reason', 'Recommendation from friends, family or colleagues', 'recommendations?|word of mouth|recommended'],
  ['reason', 'Brand reputation, heritage and the image it shows', 'brand reputation|reputation|heritage|brand image'],
  ['reason', 'Availability at the nearest store or corner shop', 'availability|nearest store|nearby'],
  ['reason', 'Health reasons: lower alcohol or fewer calories', 'health(?:y| reasons)?|low(?:er)? alcohol|fewer calories|calories'],
  ['reason', 'Packaging, format or size that suits their routine', 'packaging|pack sizes?|formats?'],
]
for (const [prop, value, src] of SYNONYMS) term(prop, value, src)
term('zone', ['MAZ', 'SAZ'], 'latin america|latam')
// Short codes only as typed in capitals: "US" is a country, "us" is not.
term('country', 'United States of America', 'US', {}, true)
for (const z of ['AFR', 'APAC', 'EUR', 'NAZ', 'MAZ', 'SAZ']) term('zone', z, z, {}, true)

// Respondent properties.
for (const [value] of getProperty('source').options) term('source', value, esc(value.toLowerCase()))
term('source', 'Client recruit', 'clients?(?: recruits?)?')
term('source', 'Respondent.io panel', 'respondent\\.?io|panel(?: recruits?)?|rio')
term('source', 'Agency upload', 'agency(?: uploads?)?|uploaded|uploads?')
term('source', 'Spreadsheet paste', 'spreadsheets?(?: paste)?|pasted|excel')
for (const [tz] of getProperty('timezone').options) {
  term('timezone', tz, `${esc(tz.toLowerCase())}|${esc(tz.split('/').pop()!.replace(/_/g, ' ').toLowerCase())}`)
}
term('role', 'Main', 'main (?:role|respondents?|participants?)|as main|role main')
term('role', 'Backup', 'backups?(?: role| respondents?| participants?)?|as backup')
const SIGNED: Target = { prop: 'consent', values: ['Signed'] }
const NOT_SIGNED: Target = { prop: 'consent', values: ['Not signed'] }
SIGNED.negated = NOT_SIGNED
NOT_SIGNED.negated = SIGNED
TERMS.push(
  { targets: [SIGNED], re: words('signed(?! up)(?: (?:the )?consent(?: forms?)?)?|consented|with consent') },
  {
    targets: [NOT_SIGNED],
    re: words(
      'not signed|unsigned|(?:haven\'t|hasn\'t|didn\'t|did not|have not|has not|never) signed(?: (?:the )?consent(?: forms?)?)?|(?:without|no|missing|pending|unsigned) consent(?: forms?)?|consent (?:pending|missing)',
    ),
  },
)
term('prior', 'true', 'repeat (?:respondents?|participants?|people)|returning(?: respondents?| participants?)?|(?:participated|taken part|been interviewed) before|prior participants?')
term('prior', 'false', 'first[- ]time(?:rs| respondents?| participants?)?|never participated')
term('fav', 'true', 'favou?rites?|favou?rited|starred')
term('fav', 'false', 'unstarred')
term('tech', 'Attempted', 'attempted')
term('tech', 'Not sent', 'not sent|never sent')
// "Completed" fits self captures and the tech check: the nearest of the two names decides.
const LIVE_DONE: Target = { prop: 'live', values: ['Completed'] }
const LIVE_NOT_DONE: Target = { prop: 'live', values: ['Not completed'] }
LIVE_DONE.negated = LIVE_NOT_DONE
LIVE_NOT_DONE.negated = LIVE_DONE
TERMS.push(
  { targets: [LIVE_DONE, { prop: 'tech', values: ['Completed'] }], re: words('completed|complete|done|finished|passed') },
  {
    targets: [LIVE_NOT_DONE, { prop: 'tech', values: ['Completed'], mode: 'is_not' }],
    re: words('not completed|not complete|incomplete|not done|not finished|(?:haven\'t|hasn\'t|didn\'t|did not|have not|has not|never) (?:completed|finished|done)|pending|missing|failed'),
  },
)

/** Names of properties: they place values that fit more than one, and say which filter to remove. */
const ALIASES: Array<[string, RegExp]> = (
  [
    ['interview', 'interviews?|sessions?'],
    ['role', 'roles?'],
    ['live', 'async(?: activit(?:y|ies))?|self[- ]?captures?|diar(?:y|ies)'],
    ['tech', 'tech[- ]?checks?'],
    ['consent', 'consent(?: forms?)?'],
    ['prior', 'repeat(?: respondents?)?'],
    ['fav', 'favou?rites?'],
    ['email', 'e-?mails?'],
    ['name', 'names?'],
    ['timezone', 'time ?zones?'],
    ['source', 'sources?|recruited (?:by|through|via)'],
    ['addedOn', 'added(?: on)?|added dates?'],
    ['lastActivity', 'last activity|(?<!async )activity'],
    ['gender', 'genders?|sex'],
    ['country', 'countr(?:y|ies)|based in|living in|li(?:ve|ves) in|located in'],
    ['income', 'income|sel|social economic level'],
    ['age', 'ages?|aged|years? old|y/?o'],
    ['ethnicity', 'ethnicit(?:y|ies)|race'],
    ['education', 'education|educated'],
    ['environment', 'environments?|areas?'],
    ['employment', 'employment|employed|jobs?|work(?:ing)?'],
    ['recency', 'consumption(?: recency)?|recency|drink(?:s|ing)?'],
    ['channel', 'channels?|purchase channels?|buy(?:s|ing)? (?:at|from|in|on|via)|shop(?:s|ping)? (?:at|in|on|via)'],
    ['household', 'households?|living situation'],
    ['zone', 'zones?|regions?'],
    ['reason', 'reasons?|choose|chooses|because(?: of)?|cares? about|motivated by'],
  ] as Array<[string, string]>
)
  .filter(([prop]) => hasProperty(prop))
  .map(([prop, src]) => [prop, words(src)])

/** Fill-in words that never need a filter of their own. */
const STOPWORDS = new Set(
  `a an the of in on at to for from by with within into about as and or but not no so also too plus only just all any some
  show me find list get give see filter filters filtered please i want need looking look who whom whose that which what where
  are is be been being have has had do does did their there they them those these this it its
  respondent respondents participant participants people person persons users user folks ones one
  living live lives based located aged age years year old yo between than over under more less least most
  buy buys buying bought shop shops shopping purchase purchases purchasing usually mostly mainly main
  either both each every other others like such etc ok okay`.split(/\s+/),
)

const NEGATION = /\b(?:not|no|non|without|except|excluding|exclude|excluded|isn't|aren't|don't|doesn't|never|other than|apart from|but not)\b/
/** Where a clause starts, for reading "not" and placing dates. */
const CLAUSE_BREAK = /[,;.]|\b(?:and|or|but|with|who|whose|that|which)\b/g

/* ---------- Dates, ages, text and sessions: read as numbers or free text ---------- */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const COUNT = '(\\d+|a|an|one|two|three|four|six|twelve)'
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, six: 6, twelve: 12 }
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function spanDays(count: string | undefined, unit: string) {
  const n = count ? (NUMBER_WORDS[count] ?? Number(count)) : 1
  return unit === 'month' && n === 12 ? 365 : n * UNIT_DAYS[unit]
}

/** "October 5" (this year, or last year if that's still ahead); the month's first or last day without a day. */
function monthDate(month: string, day: string | undefined, year: string | undefined, endOfMonth: boolean) {
  const m = MONTHS.indexOf(month.slice(0, 3))
  let y = year ? Number(year) : Number(TODAY.slice(0, 4))
  const make = (yy: number) => {
    const d = day ? Number(day) : endOfMonth ? new Date(Date.UTC(yy, m + 1, 0)).getUTCDate() : 1
    return `${yy}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (!year && make(y) > TODAY) y -= 1
  return make(y)
}

/** Start and end of the clause around a span. */
function clauseAround(lower: string, start: number, end: number): [number, number] {
  let from = 0
  let to = lower.length
  for (const m of lower.matchAll(CLAUSE_BREAK)) {
    if (m.index! + m[0].length <= start) from = m.index! + m[0].length
    else if (m.index! >= end) {
      to = m.index!
      break
    }
  }
  return [from, to]
}

const INACTIVE = /\b(?:inactive|not active|no (?:recent )?activity|(?:haven't|hasn't) been active|not seen)\b/
const ACTIVE = /\b(?:active|activity|last seen|logged in|engaged)\b/
const ADDED = /\b(?:added|joined|imported|signed up)\b/

function dateHits(lower: string): Hit[] {
  const hits: Hit[] = []
  const add = (m: RegExpMatchArray, read: (inactive: boolean) => { mode: Mode; values: string[] } | null) => {
    const start = m.index!
    const end = start + m[0].length
    const [from, to] = clauseAround(lower, start, end)
    const clause = lower.slice(from, to)
    const word = INACTIVE.exec(clause) ?? ACTIVE.exec(clause) ?? ADDED.exec(clause)
    const inactive = INACTIVE.test(clause)
    const prop = inactive || ACTIVE.test(clause) ? 'lastActivity' : 'addedOn'
    const target = read(inactive)
    if (!target) return
    const also: Array<[number, number]> = word ? [[from + word.index, from + word.index + word[0].length]] : []
    hits.push({ start, end, targets: [{ prop, ...target }], fixed: true, also })
  }
  /** "In the last N days": a choice of the drawer when it is one (7, 30, 90 days, 12 months), else "after" a date. */
  const relative = (days: number) => (inactive: boolean) =>
    inactive
      ? { mode: 'before' as Mode, values: [addDays(TODAY, -days)] }
      : [7, 30, 90, 365].includes(days)
        ? { mode: 'in_last' as Mode, values: [String(days)] }
        : { mode: 'after' as Mode, values: [addDays(TODAY, -days - 1)] }
  for (const m of lower.matchAll(new RegExp(`\\b(?:in |within |during |over |for )?(?:the )?(?:last|past) (?:${COUNT} )?(day|week|month|year)s?\\b`, 'g'))) {
    add(m, relative(spanDays(m[1], m[2])))
  }
  for (const m of lower.matchAll(/\bthis (week|month|year)\b/g)) add(m, relative(UNIT_DAYS[m[1]]))
  for (const m of lower.matchAll(/\btoday\b/g)) add(m, relative(0))
  for (const m of lower.matchAll(/\brecent(?:ly)?\b/g)) add(m, relative(30))
  // "Inactive for 30 days": only with inactive, where "for N days" can mean nothing else.
  for (const m of lower.matchAll(new RegExp(`\\b(?:for|in) (?:over |more than |at least )?${COUNT} (day|week|month|year)s?\\b`, 'g'))) {
    const days = spanDays(m[1], m[2])
    add(m, (inactive) => (inactive ? relative(days)(true) : null))
  }
  for (const m of lower.matchAll(new RegExp(`\\b(before|after|since|from) ${MONTH}\\.?(?: (\\d{1,2})(?:st|nd|rd|th)?)?(?:,? (\\d{4}))?\\b`, 'g'))) {
    const [, word, month, day, year] = m
    add(m, () =>
      word === 'before'
        ? { mode: 'before', values: [monthDate(month, day, year, false)] }
        : word === 'after'
          ? { mode: 'after', values: [monthDate(month, day, year, true)] }
          : { mode: 'after', values: [addDays(monthDate(month, day, year, false), -1)] },
    )
  }
  return hits
}

/** Age buckets as [from, to] years, in the order of the segment's values. */
const AGE_SEGMENT = SEGMENTS.find((s) => s.key === 'age')
const AGE_BUCKETS: Array<[number, number]> = [[0, 24], [25, 34], [35, 44], [45, 54], [55, 200]]

function ageHits(lower: string): Hit[] {
  if (!AGE_SEGMENT || !hasProperty('age')) return []
  const hits: Hit[] = []
  const add = (m: RegExpMatchArray, from: number, to: number) => {
    const values = AGE_SEGMENT.options.filter((_, i) => AGE_BUCKETS[i] && AGE_BUCKETS[i][0] <= to && AGE_BUCKETS[i][1] >= from)
    if (values.length) hits.push({ start: m.index!, end: m.index! + m[0].length, targets: [{ prop: 'age', values }], fixed: true })
  }
  const isAge = (n: number) => n >= 16 && n <= 99
  /** "Under 30 days" is a date, not an age. */
  const notDuration = (m: RegExpMatchArray) => !/^\s*(?:days?|weeks?|months?)\b/.test(lower.slice(m.index! + m[0].length))
  for (const m of lower.matchAll(/\b(\d{2}) ?(?:-|to|and) ?(\d{2})\b/g)) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (isAge(a) && isAge(b) && notDuration(m)) add(m, Math.min(a, b), Math.max(a, b))
  }
  for (const m of lower.matchAll(/\b(?:under|below|younger than|less than) (\d{2})\b/g)) {
    if (isAge(Number(m[1])) && notDuration(m)) add(m, 0, Number(m[1]) - 1)
  }
  for (const m of lower.matchAll(/\b(?:over|above|older than|more than) (\d{2})\b/g)) {
    if (isAge(Number(m[1])) && notDuration(m)) add(m, Number(m[1]) + 1, 200)
  }
  for (const m of lower.matchAll(/\b(\d{2})(?:\+| and (?:over|up|older)| or (?:over|older))/g)) {
    if (isAge(Number(m[1]))) add(m, Number(m[1]), 200)
  }
  for (const m of lower.matchAll(/\b(?:in their )?([1-9])0s\b/g)) add(m, Number(m[1]) * 10, Number(m[1]) * 10 + 9)
  for (const m of lower.matchAll(/\b(?:young(?: adults| people)?|gen ?z|teens?|teenagers?)\b/g)) add(m, 0, 24)
  for (const m of lower.matchAll(/\bmillennials?\b/g)) add(m, 30, 45)
  for (const m of lower.matchAll(/\b(?:seniors?|elderly|older (?:adults|people))\b/g)) add(m, 55, 200)
  return hits
}

/** Names, emails and IDs: "named Maria", "gmail addresses", "ID starting with 4". */
function textHits(typed: string): Hit[] {
  const hits: Hit[] = []
  const clean = (s: string) => s.replace(/^["“'‘]+|["”'’.,;:!?]+$/g, '')
  const add = (m: RegExpMatchArray, prop: string, value: string) => {
    if (hasProperty(prop) && value) hits.push({ start: m.index!, end: m.index! + m[0].length, targets: [{ prop, values: [value], mode: 'contains' }], fixed: true })
  }
  for (const m of typed.matchAll(/\b(?:named|called|name (?:contains|includes|has|is|like))\s+(\S+)/gi)) add(m, 'name', clean(m[1]))
  for (const m of typed.matchAll(/\b(gmail|yahoo|hotmail|outlook|icloud|proton(?:mail)?)\b(?: (?:addresses|address|emails?|accounts?|users))?/gi)) {
    add(m, 'email', m[1].toLowerCase())
  }
  for (const m of typed.matchAll(/\be-?mails? (?:contains?|containing|with|ending (?:in|with)|at|from|like)\s+(\S+)/gi)) add(m, 'email', clean(m[1]))
  return hits
}

/** Live interview sessions: "UK session 2", "unassigned", "assigned to an interview". */
function interviewHits(lower: string): Hit[] {
  if (!hasProperty('interview')) return []
  const hits: Hit[] = []
  const add = (m: RegExpMatchArray, values: string[], mode: Mode = 'is') => {
    if (values.length) hits.push({ start: m.index!, end: m.index! + m[0].length, targets: [{ prop: 'interview', values, mode }], fixed: true })
  }
  const named = (test: (name: string) => boolean) => INTERVIEW_SESSIONS.map((s) => s.name).filter(test)
  for (const m of lower.matchAll(/\b(us|uk)(?: shoppers?)? session (\d+)\b/g)) {
    add(m, named((n) => n.toLowerCase() === `${m[1]} shoppers · session ${m[2]}`))
  }
  for (const m of lower.matchAll(/\bsession (\d+)\b/g)) add(m, named((n) => n.endsWith(` Session ${m[1]}`)))
  for (const m of lower.matchAll(/\b(?:not (?:yet )?(?:assigned|scheduled)|unassigned|unscheduled|without (?:an? )?(?:interview|session)|no (?:interview|session))\b/g)) {
    add(m, [NOT_SET])
  }
  for (const m of lower.matchAll(/\b(?:assigned|scheduled)(?: to (?:an? |a live )?(?:interview|session)s?)?\b/g)) add(m, [NOT_SET], 'is_not')
  return hits
}

/* ---------- Reading a prompt ---------- */

export function interpret(prompt: string): Interpretation {
  // Same length as typed: straight apostrophes and hyphens, so offsets line up with `typed`.
  const typed = prompt.replace(/[’‘]/g, "'").replace(/[–—]/g, '-')
  const lower = typed.toLowerCase()
  const used = new Uint8Array(lower.length)
  const free = (a: number, b: number) => used.subarray(a, b).every((x) => x === 0)
  const take = (a: number, b: number) => used.fill(1, a, b)

  // Starting over, or taking one property's filter off.
  let clearAll = false
  const remove = new Set<string>()
  for (const m of lower.matchAll(/\b(?:start over|from scratch|reset(?: (?:the |all )?filters)?|clear (?:all|everything)|(?:clear|remove|drop|delete) (?:all |the )?filters)\b/g)) {
    clearAll = true
    take(m.index!, m.index! + m[0].length)
  }
  for (const m of lower.matchAll(/\b(?:remove|drop|clear|delete|ignore|without) (?:the )?(.{1,40}?) filters?\b/g)) {
    if (!free(m.index!, m.index! + m[0].length)) continue
    const named = ALIASES.filter(([, re]) => [...m[1].matchAll(re)].length > 0).map(([prop]) => prop)
    if (!named.length) continue
    named.forEach((prop) => remove.add(prop))
    take(m.index!, m.index! + m[0].length)
  }

  // Fixed readings first, then value words, longest first ("not signed" before "signed").
  const special = [...dateHits(lower), ...ageHits(lower), ...textHits(typed), ...interviewHits(lower)]
  const valueHits: Array<Hit & { order: number }> = []
  TERMS.forEach((t, order) => {
    for (const m of (t.caseSensitive ? typed : lower).matchAll(t.re)) {
      valueHits.push({ start: m.index!, end: m.index! + m[0].length, targets: t.targets, order })
    }
  })
  const byLength = <T extends Hit>(list: T[], tie: (a: T, b: T) => number) => [...list].sort((a, b) => b.end - b.start - (a.end - a.start) || tie(a, b))
  const accepted: Hit[] = []
  for (const h of [...byLength(special, (a, b) => a.start - b.start), ...byLength(valueHits, (a, b) => a.order - b.order || a.start - b.start)]) {
    if (!free(h.start, h.end)) continue
    take(h.start, h.end)
    for (const [a, b] of h.also ?? []) if (free(a, b)) take(a, b)
    accepted.push(h)
  }

  // Property names: place the values that fit more than one property, and count as understood.
  const aliasHits = ALIASES.flatMap(([prop, re]) => [...lower.matchAll(re)].map((m) => ({ prop, start: m.index!, end: m.index! + m[0].length })))
  const ambiguous: string[] = []
  const resolved: Array<{ hit: Hit; target: Target }> = []
  for (const hit of accepted) {
    if (hit.targets.length === 1) {
      resolved.push({ hit, target: hit.targets[0] })
      continue
    }
    const distance = (a: { start: number; end: number }) => (a.end <= hit.start ? hit.start - a.end : a.start - hit.end)
    const near = aliasHits
      .filter((a) => hit.targets.some((t) => t.prop === a.prop) && distance(a) >= 0 && distance(a) <= 40)
      .sort((a, b) => distance(a) - distance(b))[0]
    const target = near && hit.targets.find((t) => t.prop === near.prop)
    if (target) resolved.push({ hit, target })
    else ambiguous.push(typed.slice(hit.start, hit.end))
  }
  for (const a of aliasHits) if (free(a.start, a.end)) take(a.start, a.end)

  // "Not" before a value, in the same clause and after the previous reading.
  const negated = (hit: Hit) => {
    let from = 0
    for (const m of lower.slice(0, hit.start).matchAll(CLAUSE_BREAK)) from = m.index! + m[0].length
    for (const other of accepted) if (other !== hit && other.end <= hit.start) from = Math.max(from, other.end)
    from = Math.max(from, hit.start - 30)
    const m = NEGATION.exec(lower.slice(from, hit.start))
    // The "not" itself counts as understood.
    if (m) take(from + m.index, from + m.index + m[0].length)
    return m !== null
  }
  const flip = (t: Target): Target => {
    if (t.negated) return t.negated
    if (getProperty(t.prop).type === 'boolean') return { prop: t.prop, values: t.values.map((v) => (v === 'true' ? 'false' : 'true')) }
    return { ...t, mode: t.mode === 'is_not' ? 'is' : 'is_not' }
  }
  const targets = resolved
    .sort((a, b) => a.hit.start - b.hit.start)
    .map(({ hit, target }) => ({ hit, target: !hit.fixed && negated(hit) ? flip(target) : target }))

  // One condition per property: what it is beats what it isn't ("UK but not Brazil" is the UK).
  const conditions: Condition[] = []
  for (const prop of [...new Set(targets.map((t) => t.target.prop))]) {
    const list = targets.map((t) => t.target).filter((t) => t.prop === prop)
    const type = getProperty(prop).type
    if (type === 'text' || type === 'date') {
      const last = list[list.length - 1]
      conditions.push(newCondition(prop, last.values, last.mode))
      continue
    }
    const positive = list.filter((t) => (t.mode ?? 'is') === 'is')
    const pick = positive.length ? positive : list
    conditions.push(newCondition(prop, [...new Set(pick.flatMap((t) => t.values))], positive.length ? 'is' : 'is_not'))
  }

  // "or" between two different properties.
  let orAcross = false
  for (const m of lower.matchAll(/\bor\b/g)) {
    const before = targets.filter((t) => t.hit.end <= m.index!).pop()
    const after = targets.find((t) => t.hit.start >= m.index! + 2)
    if (before && after && before.target.prop !== after.target.prop) orAcross = true
  }

  // Words left over, as typed and grouped when side by side.
  const unmatched: string[] = []
  let run: string[] = []
  let lastEnd = -1
  const flush = () => {
    if (run.length) unmatched.push(run.join(' '))
    run = []
  }
  for (const m of lower.matchAll(/[a-z0-9][a-z0-9'+-]*/g)) {
    const start = m.index!
    const end = start + m[0].length
    const understood = !free(start, end) || STOPWORDS.has(m[0]) || /^\d+$/.test(m[0])
    if (understood) {
      flush()
      continue
    }
    if (run.length && /[,;.]/.test(lower.slice(lastEnd, start))) flush()
    run.push(typed.slice(start, end))
    lastEnd = end
  }
  flush()

  return { conditions, remove: [...remove], clearAll, unmatched, ambiguous, orAcross }
}

/** The filters after an interpretation: cleared or trimmed first, then each condition added or replacing its property's. */
export function applyInterpretation(current: Condition[], i: Interpretation): Condition[] {
  let next = i.clearAll ? [] : current.filter((c) => !i.remove.includes(c.prop))
  for (const c of i.conditions) next = applyCondition(next, c)
  return next
}

export const changesSomething = (i: Interpretation) => i.conditions.length > 0 || i.remove.length > 0 || i.clearAll

/** One part of a description that the AI couldn't use, shown as a note chip next to the filters. */
export interface AiNote {
  id: string
  /** Short text on the chip. */
  text: string
  /** Fuller explanation for the tooltip. */
  detail: string
}

let noteSeq = 0

/**
 * What the AI couldn't use when it applied some filters: words it didn't understand, words that
 * fit more than one property, and "or" between properties. Each becomes a note chip.
 */
export function interpretationNotes(i: Interpretation): AiNote[] {
  const notes: Array<Omit<AiNote, 'id'>> = []
  for (const words of i.unmatched) {
    notes.push({ text: `Not understood: ${words}`, detail: `“${words}” didn’t match any property or value, so it was left out.` })
  }
  for (const words of i.ambiguous) {
    notes.push({ text: `Unclear: ${words}`, detail: `“${words}” could mean async activities or tech check. Say which one, e.g. “async activities ${words}”.` })
  }
  if (i.orAcross) {
    notes.push({ text: '“or” not applied', detail: 'Filters on different properties can’t be combined with “or”, so respondents must match all of them.' })
  }
  return notes.map((n) => ({ ...n, id: `note${++noteSeq}` }))
}
