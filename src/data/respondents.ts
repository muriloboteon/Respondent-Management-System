import { timezoneInfo } from './timezones'

export type MethodStatus = { s: string; sub: string }
export type Source = 'client' | 'rio' | 'upload' | 'paste'
export type InterviewRole = 'Main' | 'Backup'

export interface InterviewSession {
  id: number
  name: string
  /** Display date and time, in the same form as the live session status. */
  when: string
}

/** Live interview sessions of the project, offered in the "Assign to Interview" column. */
export const INTERVIEW_SESSIONS: readonly InterviewSession[] = [
  { id: 2101, name: 'US shoppers · Session 1', when: 'Oct 23, 15:30' },
  { id: 2102, name: 'US shoppers · Session 2', when: 'Oct 24, 10:00' },
  { id: 2103, name: 'US shoppers · Session 3', when: 'Oct 25, 14:00' },
  { id: 2104, name: 'UK shoppers · Session 1', when: 'Oct 27, 11:00' },
  { id: 2105, name: 'UK shoppers · Session 2', when: 'Oct 28, 09:30' },
  { id: 2106, name: 'US shoppers · Session 4', when: 'Nov 3, 13:00' },
]

export const INTERVIEW_ROLES: readonly InterviewRole[] = ['Main', 'Backup']

export function interviewSession(r: Respondent): InterviewSession | undefined {
  return INTERVIEW_SESSIONS.find((s) => s.id === r.interview)
}

export interface Respondent {
  id: string
  pid: string
  name: string
  src: Source
  email?: string
  phone?: string
  rio?: string
  /** Values per segment (see SEGMENTS); a missing or empty list means not set. */
  segments: SegmentValues
  /** IANA ID, e.g. "America/New_York" (see data/timezones). Unset when unknown. */
  timezone?: string
  /** ID of the live interview session the respondent is assigned to (see INTERVIEW_SESSIONS). */
  interview?: number
  /** Role in the live interview; can be set before a session is assigned. */
  role?: InterviewRole
  ai: MethodStatus
  live: MethodStatus
  /** Display status for each column, derived from the raw record. */
  tech: string
  consent: string
  liveDoc: string
  prior: 'Yes' | 'No'
  fav: boolean
  /** ISO dates (YYYY-MM-DD). Sample data is anchored to TODAY. */
  addedOn: string
  lastActivity?: string
  avatarClass: string
  initials: string
}

export function M(s: string, sub = ''): MethodStatus {
  return { s, sub }
}

/* ---------- Segments (created on the Segments page) ---------- */

export type SegmentKey =
  | 'gender'
  | 'country'
  | 'income'
  | 'age'
  | 'ethnicity'
  | 'education'
  | 'environment'
  | 'employment'
  | 'recency'
  | 'channel'
  | 'household'
  | 'zone'
  | 'reason'
export type SegmentValues = Partial<Record<SegmentKey, string[]>>

export interface SegmentDef {
  key: SegmentKey
  label: string
  type: 'Demographic' | 'Behavioral'
  options: readonly string[]
  /** Respondents can be in more than one of the segment's values. */
  multi?: boolean
  /** Default column width. */
  size: number
}

/** The project's segments and their values, in table order. */
export const SEGMENTS: readonly SegmentDef[] = [
  { key: 'gender', label: 'Gender', type: 'Demographic', options: ['Female', 'Male', 'Non-binary', 'Other'], size: 130 },
  {
    key: 'country',
    label: 'Country',
    type: 'Demographic',
    options: [
      'Argentina', 'Austria', 'Belgium', 'Bolivia', 'Brazil', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica',
      'Dominican Republic', 'Ecuador', 'El Salvador', 'France', 'Germany', 'Guatemala', 'Honduras', 'Italy', 'Mexico',
      'Mozambique', 'Netherlands', 'Nigeria', 'Panama', 'Paraguay', 'Peru', 'South Africa', 'South Korea', 'Tanzania',
      'Uganda', 'United Kingdom', 'United States of America', 'Uruguay', 'Zambia',
    ],
    size: 220,
  },
  { key: 'income', label: 'Social Economic Level (SEL) / Income Type', type: 'Demographic', options: ['Low income', 'Medium income', 'High income'], size: 300 },
  { key: 'age', label: 'Respondent Age', type: 'Demographic', options: ['LDA–24', '25–34', '35–44', '45–54', '55+'], size: 150 },
  {
    key: 'ethnicity',
    label: 'Ethnicity',
    type: 'Demographic',
    options: ['Asian', 'Black', 'East Asian', 'Hispanic / Latino', 'Indigenous', 'Middle Eastern', 'Mixed / Multiracial', 'South Asian', 'White', 'Other'],
    size: 190,
  },
  {
    key: 'education',
    label: 'Education',
    type: 'Demographic',
    options: ['No formal education', 'Primary', 'Secondary', 'University without degree', 'University with degree', 'Some postgraduate', 'Postgraduate', 'Other'],
    size: 230,
  },
  { key: 'environment', label: 'Environment', type: 'Demographic', options: ['Rural', 'Suburban', 'Urban'], size: 140 },
  {
    key: 'employment',
    label: 'Employment',
    type: 'Demographic',
    options: ['Student', 'Labourer', 'Part-time employed', 'Full-time employed', 'Self-employed', 'Unemployed', 'Retired', 'Housewife / Househusband', 'Other'],
    size: 230,
  },
  {
    key: 'recency',
    label: 'Consumption Recency',
    type: 'Behavioral',
    options: ['P7D: Lovers', 'P4W: Occasionals', 'P3M–P12M: Drinkers', 'P12M+: Non-drinkers'],
    size: 210,
  },
  {
    key: 'channel',
    label: 'Purchase Channel',
    type: 'Behavioral',
    options: ['Grocery', 'Convenience', 'Club store', 'Liquor store', 'Restaurant', 'Bar', 'Delivery app', 'E-commerce', 'Other'],
    multi: true,
    size: 240,
  },
  {
    key: 'household',
    label: 'Household Situation',
    type: 'Demographic',
    options: [
      'Empty nester',
      'Lives alone',
      'Lives with parents',
      'Lives with partner + adult kids',
      'Lives with partner + kids under 18',
      'Lives with partner no kids',
      'Lives with roommates',
      'Multigenerational household',
      'Single parent',
    ],
    size: 280,
  },
  { key: 'zone', label: 'Zone', type: 'Demographic', options: ['AFR', 'APAC', 'EUR', 'NAZ', 'MAZ', 'SAZ'], size: 110 },
  // Long header and values on purpose: shows how the table, filters and detail cope with long text.
  // Segment values are at most 50 characters, so these stay just under it.
  {
    key: 'reason',
    label: 'Main reason for choosing their usual beverage brand when shopping in a physical store',
    type: 'Behavioral',
    options: [
      'Price and promotions at the moment of purchase',
      'Taste built over years of regular consumption',
      'Recommendation from friends, family or colleagues',
      'Brand reputation, heritage and the image it shows',
      'Availability at the nearest store or corner shop',
      'Health reasons: lower alcohol or fewer calories',
      'Packaging, format or size that suits their routine',
      'Other',
    ],
    size: 300,
  },
]

export function segmentDef(key: SegmentKey): SegmentDef {
  return SEGMENTS.find((s) => s.key === key)!
}

/** The zone of each country, so a sample respondent's Zone agrees with their Country. */
const COUNTRY_ZONES: Record<string, string> = {
  Mozambique: 'AFR', Nigeria: 'AFR', 'South Africa': 'AFR', Tanzania: 'AFR', Uganda: 'AFR', Zambia: 'AFR',
  China: 'APAC', 'South Korea': 'APAC',
  Austria: 'EUR', Belgium: 'EUR', France: 'EUR', Germany: 'EUR', Italy: 'EUR', Netherlands: 'EUR', 'United Kingdom': 'EUR',
  Canada: 'NAZ', 'United States of America': 'NAZ',
  Colombia: 'MAZ', 'Costa Rica': 'MAZ', 'Dominican Republic': 'MAZ', Ecuador: 'MAZ', 'El Salvador': 'MAZ',
  Guatemala: 'MAZ', Honduras: 'MAZ', Mexico: 'MAZ', Panama: 'MAZ', Peru: 'MAZ',
  Argentina: 'SAZ', Bolivia: 'SAZ', Brazil: 'SAZ', Chile: 'SAZ', Paraguay: 'SAZ', Uruguay: 'SAZ',
}

/** Sample data: the gender is set by hand (it follows the names); the other segments are drawn at random. */
function seg(gender: string): SegmentValues {
  return { gender: gender ? [gender] : [] }
}

/** A small seeded random generator (mulberry32), so the random sample is the same on every load. */
function seededRandom(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Share of sample segments left unset, so "Not set" shows up in the table and the filters. */
const SAMPLE_NOT_SET = 0.08

/**
 * Random values for every segment but Gender, seeded by the respondent's ID: one value each, one to
 * three for multi-value segments, some left unset. Zone follows from Country.
 */
function sampleSegments(seed: string): SegmentValues {
  const rand = seededRandom(seed)
  const pick = (options: readonly string[]) => options[Math.floor(rand() * options.length)]
  const out: SegmentValues = {}
  for (const s of SEGMENTS) {
    if (s.key === 'gender' || s.key === 'zone') continue
    if (rand() < SAMPLE_NOT_SET) {
      out[s.key] = []
    } else if (s.multi) {
      const chosen = new Set<string>()
      const n = 1 + Math.floor(rand() * 3)
      while (chosen.size < n) chosen.add(pick(s.options))
      out[s.key] = s.options.filter((o) => chosen.has(o))
    } else {
      out[s.key] = [pick(s.options)]
    }
  }
  const country = out.country?.[0]
  out.zone = country ? [COUNTRY_ZONES[country]] : []
  return out
}

export type RawRespondent =Omit<Respondent, 'liveDoc' | 'prior' | 'fav' | 'avatarClass' | 'initials'>

const raw: RawRespondent[] = [
  { id: 'r1', pid: 'R-1001', name: 'Sarah Kim', src: 'client', email: 'sarah.kim@example.com', phone: '+1 555 0101', segments: seg('Female'), ai: M('Completed', 'Oct 14'), live: M('Completed', 'Oct 16'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-02', lastActivity: '2026-10-16' },
  { id: 'r2', pid: 'R-1002', name: 'Sarah Mitchell', src: 'client', email: 'sarah.mitchell@example.co.uk', phone: '+44 20 5550 0102', segments: seg('Female'), ai: M('Not started', 'Assigned Oct 15'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-05', lastActivity: '2026-10-15' },
  { id: 'r3', pid: 'R-1003', name: 'Jessica Moore', src: 'rio', rio: 'RIO-7F3K21', segments: seg('Female'), ai: M('Partial', 'Stopped at question 6'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-08', lastActivity: '2026-10-11' },
  { id: 'r4', pid: 'R-1004', name: 'Jessica Turner', src: 'rio', rio: 'RIO-9A2M40', segments: seg('Female'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-09-08' },
  { id: 'r5', pid: 'R-1005', name: 'James Owens', src: 'upload', email: 'james.owens@example.com', phone: '+1 555 0105', segments: seg('Male'), ai: M('Completed', 'Oct 13'), live: M('Scheduled', 'Oct 24, 10:00'), tech: 'Pending', consent: 'Signed', interview: 2102, role: 'Main', addedOn: '2026-10-03', lastActivity: '2026-10-13' },
  { id: 'r6', pid: 'R-1006', name: 'Priya Nair', src: 'client', email: 'priya.nair@example.co.uk', phone: '+44 20 5550 0106', segments: seg('Female'), ai: M('Completed', 'Oct 12'), live: M('Completed', 'Oct 15'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-12', lastActivity: '2026-10-15' },
  { id: 'r7', pid: 'R-1007', name: 'Lucas Reid', src: 'upload', email: 'lucas.reid@example.co.uk', phone: '+44 20 5550 0107', segments: seg('Male'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-10-03', lastActivity: '2026-10-17' },
  { id: 'r8', pid: 'R-1008', name: 'Ana Costa', src: 'client', email: 'ana.costa@example.com', phone: '+1 555 0108', segments: seg('Female'), ai: M('Completed', 'Oct 15'), live: M('Not scheduled', 'Invited Oct 16'), tech: 'Pending', consent: 'Signed', interview: 2102, role: 'Backup', addedOn: '2026-09-15', lastActivity: '2026-10-16' },
  { id: 'r9', pid: 'R-1009', name: 'Tom Bennett', src: 'client', email: 'tom.bennett@example.co.uk', phone: '+44 20 5550 0109', segments: seg('Male'), ai: M('Partial', 'Stopped at question 3'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-18', lastActivity: '2026-10-13' },
  { id: 'r10', pid: 'R-1010', name: 'Mei Lin', src: 'client', email: 'mei.lin@example.com', phone: '+1 555 0110', segments: seg('Female'), ai: M('Not started', 'Assigned Oct 16'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-09-20', lastActivity: '2026-10-16' },
  { id: 'r11', pid: 'R-1011', name: 'Omar Shah', src: 'upload', email: 'omar.shah@example.co.uk', phone: '+44 20 5550 0111', segments: seg('Male'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-03' },
  { id: 'r12', pid: 'R-1012', name: 'Grace Holloway', src: 'client', email: 'grace.holloway@example.com', phone: '+1 555 0112', segments: seg('Female'), ai: M('Completed', 'Oct 14'), live: M('Scheduled', 'Oct 25, 14:00'), tech: 'Passed', consent: 'Signed', interview: 2103, role: 'Main', addedOn: '2026-09-22', lastActivity: '2026-10-14' },
  { id: 'r13', pid: 'R-1013', name: 'Daniel Park', src: 'client', email: 'daniel.park@example.com', phone: '+1 555 0113', segments: seg('Male'), ai: M('Completed', 'Oct 11'), live: M('Completed', 'Oct 14'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-01', lastActivity: '2026-10-14' },
  { id: 'r14', pid: 'R-1014', name: 'Emily Walsh', src: 'client', email: 'emily.walsh@example.co.uk', phone: '+44 20 5550 0114', segments: seg('Female'), ai: M('Not started', 'Assigned Oct 17'), live: M('Scheduled', 'Oct 27, 11:00'), tech: 'Pending', consent: 'Signed', interview: 2104, role: 'Main', addedOn: '2026-09-25', lastActivity: '2026-10-18' },
  { id: 'r15', pid: 'R-1015', name: 'Carlos Mendoza', src: 'upload', email: 'carlos.mendoza@example.com', phone: '+1 555 0115', segments: seg('Male'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-03' },
  { id: 'r16', pid: 'R-1016', name: 'Hannah Jensen', src: 'client', email: 'hannah.jensen@example.com', phone: '+1 555 0116', segments: seg('Female'), ai: M('Partial', 'Stopped at question 8'), live: M('Not scheduled', 'Invited Oct 18'), tech: 'Pending', consent: 'Signed', addedOn: '2026-09-10', lastActivity: '2026-10-18' },
  { id: 'r17', pid: 'R-1017', name: 'Oliver Thompson', src: 'client', email: 'oliver.thompson@example.co.uk', phone: '+44 20 5550 0117', segments: seg('Male'), ai: M('Completed', 'Oct 15'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-14', lastActivity: '2026-10-15' },
  { id: 'r18', pid: 'R-1018', name: 'Sofia Garcia', src: 'client', email: 'sofia.garcia@example.com', phone: '+1 555 0118', segments: seg('Female'), ai: M('Completed', 'Oct 13'), live: M('Completed', 'Oct 17'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-03', lastActivity: '2026-10-17' },
  { id: 'r19', pid: 'R-1019', name: 'Liam Fletcher', src: 'upload', email: 'liam.fletcher@example.co.uk', phone: '+44 20 5550 0119', segments: seg('Non-binary'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-10-03', lastActivity: '2026-10-19' },
  { id: 'r20', pid: 'R-1020', name: 'Chloe Dubois', src: 'client', email: 'chloe.dubois@example.com', phone: '+1 555 0120', segments: seg('Female'), ai: M('Not started', 'Assigned Oct 14'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-08' },
  { id: 'r21', pid: 'R-1021', name: 'Noah Kowalski', src: 'client', email: 'noah.kowalski@example.com', phone: '+1 555 0121', segments: seg('Male'), ai: M('Completed', 'Oct 12'), live: M('Scheduled', 'Oct 23, 15:30'), tech: 'Passed', consent: 'Signed', interview: 2101, role: 'Main', addedOn: '2026-09-06', lastActivity: '2026-10-12' },
  { id: 'r22', pid: 'R-1022', name: 'Isabella Rossi', src: 'client', email: 'isabella.rossi@example.co.uk', phone: '+44 20 5550 0122', segments: seg('Female'), ai: M('Not started', 'Assigned Oct 16'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-19', lastActivity: '2026-10-16' },
  { id: 'r23', pid: 'R-1023', name: 'Ethan Brooks', src: 'upload', email: 'ethan.brooks@example.com', phone: '+1 555 0123', segments: seg('Male'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-10-03', lastActivity: '2026-10-08' },
  { id: 'r24', pid: 'R-1024', name: 'Amelia Vaughan', src: 'client', email: 'amelia.vaughan@example.co.uk', phone: '+44 20 5550 0124', segments: seg('Female'), ai: M('Completed', 'Oct 14'), live: M('Completed', 'Oct 18'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-09', lastActivity: '2026-10-18' },
  { id: 'r25', pid: 'R-1025', name: 'Lucia Alvarez', src: 'client', email: 'lucia.alvarez@example.com', phone: '+1 555 0125', segments: seg('Female'), ai: M('Completed', 'Oct 13'), live: M('Not scheduled', 'Invited Oct 19'), tech: 'Pending', consent: 'Not submitted', interview: 2103, role: 'Backup', addedOn: '2026-09-27', lastActivity: '2026-10-19' },
  { id: 'r26', pid: 'R-1026', name: 'Benjamin Hart', src: 'client', email: 'benjamin.hart@example.com', phone: '+1 555 0126', segments: seg('Male'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-08-28', lastActivity: '2026-10-07' },
  { id: 'r27', pid: 'R-1027', name: 'Freya Nolan', src: 'upload', email: 'freya.nolan@example.co.uk', phone: '+44 20 5550 0127', segments: seg('Other'), ai: M('Completed', 'Oct 17'), live: M('Scheduled', 'Oct 28, 09:30'), tech: 'Pending', consent: 'Signed', interview: 2105, role: 'Main', addedOn: '2026-10-03', lastActivity: '2026-10-17' },
  { id: 'r28', pid: 'R-1028', name: 'Mateo Lopez', src: 'client', email: 'mateo.lopez@example.com', phone: '+1 555 0128', segments: seg('Male'), ai: M('Partial', 'Stopped at question 2'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-16', lastActivity: '2026-10-15' },
  { id: 'r29', pid: 'R-1029', name: 'Harriet Clarke', src: 'client', email: 'harriet.clarke@example.co.uk', phone: '+44 20 5550 0129', segments: seg('Female'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-12' },
  { id: 'r30', pid: 'R-1030', name: 'Victor Silva', src: 'client', email: 'victor.silva@example.com', phone: '+1 555 0130', segments: seg('Male'), ai: M('Completed', 'Oct 16'), live: M('Completed', 'Oct 20'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-04', lastActivity: '2026-10-20' },
]

export const TOTAL_RESPONDENTS = 1760

/** "Today" for the sample data, so relative date filters stay meaningful. */
export const TODAY = '2026-10-21'

/** Sample repeat respondents: the date of the earlier interview their email matched. */
const PRIOR_INTERVIEWS: Record<string, string> = { r6: 'June 29, 2026', r9: 'March 12, 2026' }

/** When a repeat respondent was interviewed before (matched by email), or undefined. */
export function priorInterviewDate(r: Respondent): string | undefined {
  return PRIOR_INTERVIEWS[r.id]
}

/** Derives the display statuses shown in the table from a raw record. */
export function enrichRespondent(r: RawRespondent, i: number): Respondent {
  const name = r.name
  const tech = r.tech === 'Passed' ? 'Completed' : r.tech === 'Pending' ? (r.id === 'r8' ? 'Not sent' : 'Attempted') : '—'
  return {
    ...r,
    name,
    tech,
    consent: r.consent === 'Signed' ? 'Signed' : 'Not signed',
    liveDoc: r.live.s === 'Completed' ? 'Completed' : 'Not completed',
    prior: PRIOR_INTERVIEWS[r.id] ? 'Yes' : 'No',
    fav: r.src === 'rio',
    avatarClass: r.src === 'rio' ? 'av-panel' : `av-${i % 5}`,
    initials: initialsFor(name),
  }
}

/** The avatar's letters: the first letters of the first two words. */
export function initialsFor(name: string) {
  return name.split(' ').map((w) => w.charAt(0)).join('').replace('.', '').slice(0, 2).toUpperCase()
}

export interface SelfCapture {
  activity: string
  /** Display date, in the same form as the method statuses. */
  completedOn: string
}

/**
 * Self Captures activities the respondent took part in, newest first. A self capture is only
 * listed once it is completed. Sample data: one activity per region, and an earlier pilot for
 * a repeat respondent.
 */
export function selfCaptures(r: Respondent): SelfCapture[] {
  if (r.liveDoc !== 'Completed') return []
  const current = { activity: r.phone?.startsWith('+44') ? 'UK Activity' : 'USA Activity', completedOn: r.live.sub }
  return r.prior === 'Yes' ? [current, { activity: 'Pilot Activity', completedOn: 'Sep 22' }] : [current]
}

export interface TechCheckResult {
  /** Mean Opinion Score of the connection, 1 (bad) to 5 (excellent). */
  mos: number
  browser: string
  os: string
}

const SAMPLE_DEVICES = [
  { browser: 'Safari 17.5', os: 'macOS 14.5' },
  { browser: 'Chrome 126', os: 'Windows 11' },
  { browser: 'Edge 126', os: 'Windows 10' },
  { browser: 'Firefox 127', os: 'macOS 13.6' },
]

/**
 * What the tech check recorded, or null until it is completed. Sample data: camera and mic
 * passed for everyone who completed it; MOS and device vary by respondent ID.
 */
export function techCheckResult(r: Respondent): TechCheckResult | null {
  if (r.tech !== 'Completed') return null
  const n = Number(r.pid.replace(/\D/g, '')) || 0
  return { mos: 3.8 + (n % 9) / 10, ...SAMPLE_DEVICES[n % SAMPLE_DEVICES.length] }
}

/** Sample timezones: panel recruits have none; UK phones get London, others rotate through US zones by ID. */
const US_SAMPLE_ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']
function sampleTimezone(r: RawRespondent): string | undefined {
  if (r.src === 'rio') return undefined
  if (r.phone?.startsWith('+44')) return 'Europe/London'
  return US_SAMPLE_ZONES[(Number(r.pid.replace(/\D/g, '')) || 0) % US_SAMPLE_ZONES.length]
}

export const respondents: Respondent[] = raw.map((r, i) =>
  enrichRespondent({ ...r, segments: { ...sampleSegments(r.pid), ...r.segments }, timezone: r.timezone ?? sampleTimezone(r) }, i),
)

export const limitPII = false

/**
 * Scales a count from the loaded sample to the whole project, so every count on the page
 * (metrics, filter results) uses the same rule. Never rounds a match down to zero.
 */
export function projectCount(sampleCount: number, sampleSize: number, total: number) {
  if (sampleCount === 0) return 0
  if (sampleCount === sampleSize) return total
  return Math.max(1, Math.round((sampleCount / sampleSize) * total))
}

export const SOURCE_LABELS: Record<Source, string> = {
  client: 'Client recruit',
  rio: 'Respondent.io panel',
  upload: 'Agency upload',
  paste: 'Spreadsheet paste',
}
export function sourceLabel(r: Respondent): string {
  return SOURCE_LABELS[r.src]
}

/** "America/New_York · UTC-5", or null when the timezone is unknown. */
export function timezoneLabel(r: Respondent): string | null {
  return r.timezone ? `${r.timezone} · ${timezoneInfo(r.timezone).offsetLabel}` : null
}


/** Panel recruits have no contact details, and they stay read-only while PII is limited. */
export function canEditContact(r: Respondent) {
  return r.src !== 'rio' && !limitPII
}

export function idLine(r: Respondent): string {
  if (r.src === 'rio') return 'Panel recruit · no email'
  if (limitPII) return 'Contact hidden'
  return r.email || 'No email'
}

function firstName(r: Respondent) {
  return r.name.split(' ')[0]
}
export function dupInfo(r: Respondent, all: readonly Respondent[]): { tag: string; note: string } | null {
  const others = all.filter((x) => x.id !== r.id && firstName(x) === firstName(r))
  if (!others.length) return null
  if (r.src === 'rio') return { tag: 'Same first name', note: 'Panel recruit with the same first name as another, and no email to tell them apart.' }
  return { tag: 'Same first name', note: `Not to be confused with ${others[0].name} (${others[0].email || 'panel recruit'})` }
}

/* ---------- Status tones (Discuss DS soft tag variants) ---------- */

export type Tone = 'ok' | 'mid' | 'warn' | 'na'
const TONES: Record<Exclude<Tone, 'na'>, string[]> = {
  ok: ['Completed', 'Signed'],
  mid: ['In progress', 'Scheduled', 'Assigned'],
  warn: ['Partial', 'Not started', 'Not scheduled', 'Attempted', 'Not sent', 'Not signed'],
}
export function tone(s: string): Tone {
  for (const k of Object.keys(TONES) as Array<keyof typeof TONES>) if (TONES[k].includes(s)) return k
  return 'na'
}

/** Sort rank for status columns: done first, missing last. */
export const SORT_ORDER: Record<string, number> = {
  Completed: 0, Signed: 0, Yes: 0,
  Assigned: 1, Partial: 2, Attempted: 2,
  'Not sent': 3, 'Not signed': 3,
  No: 4, 'Not assigned': 5, 'Not completed': 5, '—': 6,
}
