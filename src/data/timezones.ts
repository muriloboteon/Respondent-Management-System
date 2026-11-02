/**
 * Timezones offered in the table: every IANA zone the browser knows, shown by its ID
 * with its abbreviations and the UTC offset in effect today.
 */

export interface TimeZoneInfo {
  /** IANA ID, e.g. "America/New_York". This is what a respondent stores. */
  id: string
  /** Minutes from UTC today, so daylight saving is reflected. */
  offset: number
  /** e.g. "UTC-5", "UTC+5:30". */
  offsetLabel: string
  /** e.g. "EDT/EST" (daylight first), "AST"; only when the browser has letter abbreviations. */
  abbr?: string
}

function timeZoneName(id: string, locale: string, style: 'short' | 'shortOffset', date: Date) {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: id, timeZoneName: style })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value
  } catch {
    return undefined
  }
}

/** "GMT-5" → -300; "GMT+5:30" → 330; "GMT" → 0. */
function parseOffset(gmt: string | undefined) {
  const m = gmt?.match(/([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 0
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

function formatOffset(minutes: number) {
  const abs = Math.abs(minutes)
  const mins = abs % 60
  return `UTC${minutes < 0 ? '-' : '+'}${Math.floor(abs / 60)}${mins ? `:${String(mins).padStart(2, '0')}` : ''}`
}

function abbreviationAt(id: string, date: Date) {
  for (const locale of ['en-US', 'en-GB']) {
    const name = timeZoneName(id, locale, 'short', date)
    if (name && /^[A-Z]{2,5}$/.test(name)) return name
  }
  return undefined
}

/** January and July cover both halves of the year in either hemisphere. */
const YEAR = new Date().getFullYear()
const SEASONS = [new Date(Date.UTC(YEAR, 0, 15)), new Date(Date.UTC(YEAR, 6, 15))]

/** "EDT/EST" when the zone has daylight saving, otherwise the one abbreviation. */
function abbreviations(id: string) {
  const [a, b] = SEASONS.map((d) => ({ abbr: abbreviationAt(id, d), offset: parseOffset(timeZoneName(id, 'en-US', 'shortOffset', d)) }))
  if (!a.abbr || !b.abbr) return a.abbr ?? b.abbr
  if (a.abbr === b.abbr) return a.abbr
  const [daylight, standard] = a.offset > b.offset ? [a, b] : [b, a]
  return `${daylight.abbr}/${standard.abbr}`
}

const cache = new Map<string, TimeZoneInfo>()

export function timezoneInfo(id: string): TimeZoneInfo {
  let info = cache.get(id)
  if (!info) {
    const offset = parseOffset(timeZoneName(id, 'en-US', 'shortOffset', new Date()))
    info = { id, offset, offsetLabel: formatOffset(offset), abbr: abbreviations(id) }
    cache.set(id, info)
  }
  return info
}

/** Second line of a menu option, e.g. "EDT/EST · UTC-5". */
export function timezoneDescription(id: string) {
  const { abbr, offsetLabel } = timezoneInfo(id)
  return abbr ? `${abbr} · ${offsetLabel}` : offsetLabel
}

/** Text the menu search matches: the ID (also with spaces), abbreviations and offset. */
export function timezoneSearchText(id: string) {
  return `${id} ${id.replace(/_/g, ' ')} ${timezoneDescription(id)}`
}

let all: readonly string[] | undefined

/** Every IANA zone the browser knows, in alphabetical order. */
export function allTimezones(): readonly string[] {
  all ??= [...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['America/New_York', 'Europe/London'])].sort()
  return all
}
