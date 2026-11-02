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

export type SegmentKey = 'age' | 'area' | 'gender' | 'household' | 'motivation' | 'usage'
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

export const SEGMENTS: readonly SegmentDef[] = [
  { key: 'age', label: 'Age', type: 'Demographic', options: ['18-31', '32-44', '45-54', '55+'], size: 110 },
  { key: 'area', label: 'Area', type: 'Demographic', options: ['urban', 'suburban', 'small town', 'rural'], size: 130 },
  { key: 'gender', label: 'Gender', type: 'Demographic', options: ['man', 'woman', 'non-binary', 'other'], size: 130 },
  {
    key: 'household',
    label: 'Household',
    type: 'Demographic',
    options: [
      'lives alone',
      'lives with roommates',
      'lives with parents',
      'lives with partner no kids',
      'lives with partner and kids under 18',
      'lives with partner and adult kids',
      'single parent',
      'lives with extended family',
      'other',
    ],
    size: 280,
  },
  {
    key: 'motivation',
    label: 'Motivation type',
    type: 'Behavioral',
    options: ['price-conscious', 'quality-focused', 'eco-conscious', 'convenience-driven', 'health-conscious', 'brand loyalist', 'experience-seeker'],
    multi: true,
    size: 260,
  },
  {
    key: 'usage',
    label: 'User frequency',
    type: 'Behavioral',
    options: ['daily', 'a few times a week', 'once a week', 'a few times a month', 'rarely / less than once a month', 'never'],
    size: 220,
  },
]

export function segmentDef(key: SegmentKey): SegmentDef {
  return SEGMENTS.find((s) => s.key === key)!
}

/** Sample data shorthand, in SEGMENTS order; '' and [] leave a segment unset. */
function seg(age: string, area: string, gender: string, household: string, motivation: string[], usage: string): SegmentValues {
  const one = (v: string) => (v ? [v] : [])
  return { age: one(age), area: one(area), gender: one(gender), household: one(household), motivation, usage: one(usage) }
}

export type RawRespondent =Omit<Respondent, 'liveDoc' | 'prior' | 'fav' | 'avatarClass' | 'initials'>

const raw: RawRespondent[] = [
  { id: 'r1', pid: 'R-1001', name: 'Sarah Kim', src: 'client', email: 'sarah.kim@example.com', phone: '+1 555 0101', segments: seg('32-44', 'urban', 'woman', 'lives with partner and kids under 18', ['quality-focused', 'health-conscious'], 'a few times a week'), ai: M('Completed', 'Oct 14'), live: M('Completed', 'Oct 16'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-02', lastActivity: '2026-10-16' },
  { id: 'r2', pid: 'R-1002', name: 'Sarah Mitchell', src: 'client', email: 'sarah.mitchell@example.co.uk', phone: '+44 20 5550 0102', segments: seg('45-54', 'suburban', 'woman', 'lives with partner and adult kids', ['price-conscious'], 'once a week'), ai: M('Not started', 'Assigned Oct 15'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-05', lastActivity: '2026-10-15' },
  { id: 'r3', pid: 'R-1003', name: 'Jessica Moore', src: 'rio', rio: 'RIO-7F3K21', segments: seg('18-31', 'urban', 'woman', 'lives with roommates', ['experience-seeker', 'eco-conscious'], 'daily'), ai: M('Partial', 'Stopped at question 6'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-08', lastActivity: '2026-10-11' },
  { id: 'r4', pid: 'R-1004', name: 'Jessica Turner', src: 'rio', rio: 'RIO-9A2M40', segments: seg('', 'small town', 'woman', '', [], ''), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-09-08' },
  { id: 'r5', pid: 'R-1005', name: 'James Owens', src: 'upload', email: 'james.owens@example.com', phone: '+1 555 0105', segments: seg('32-44', 'suburban', 'man', 'lives with partner no kids', ['convenience-driven'], 'a few times a week'), ai: M('Completed', 'Oct 13'), live: M('Scheduled', 'Oct 24, 10:00'), tech: 'Pending', consent: 'Signed', interview: 2102, role: 'Main', addedOn: '2026-10-03', lastActivity: '2026-10-13' },
  { id: 'r6', pid: 'R-1006', name: 'Priya Nair', src: 'client', email: 'priya.nair@example.co.uk', phone: '+44 20 5550 0106', segments: seg('32-44', 'urban', 'woman', 'lives with partner and kids under 18', ['health-conscious', 'quality-focused'], 'daily'), ai: M('Completed', 'Oct 12'), live: M('Completed', 'Oct 15'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-12', lastActivity: '2026-10-15' },
  { id: 'r7', pid: 'R-1007', name: 'Lucas Reid', src: 'upload', email: 'lucas.reid@example.co.uk', phone: '+44 20 5550 0107', segments: seg('18-31', 'urban', 'man', 'lives with parents', ['price-conscious'], 'a few times a month'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-10-03', lastActivity: '2026-10-17' },
  { id: 'r8', pid: 'R-1008', name: 'Ana Costa', src: 'client', email: 'ana.costa@example.com', phone: '+1 555 0108', segments: seg('18-31', 'suburban', 'woman', 'lives alone', ['eco-conscious'], 'once a week'), ai: M('Completed', 'Oct 15'), live: M('Not scheduled', 'Invited Oct 16'), tech: 'Pending', consent: 'Signed', interview: 2102, role: 'Backup', addedOn: '2026-09-15', lastActivity: '2026-10-16' },
  { id: 'r9', pid: 'R-1009', name: 'Tom Bennett', src: 'client', email: 'tom.bennett@example.co.uk', phone: '+44 20 5550 0109', segments: seg('55+', 'rural', 'man', 'lives with partner and adult kids', ['brand loyalist'], 'a few times a week'), ai: M('Partial', 'Stopped at question 3'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-18', lastActivity: '2026-10-13' },
  { id: 'r10', pid: 'R-1010', name: 'Mei Lin', src: 'client', email: 'mei.lin@example.com', phone: '+1 555 0110', segments: seg('32-44', 'urban', 'woman', 'lives alone', ['quality-focused'], 'daily'), ai: M('Not started', 'Assigned Oct 16'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-09-20', lastActivity: '2026-10-16' },
  { id: 'r11', pid: 'R-1011', name: 'Omar Shah', src: 'upload', email: 'omar.shah@example.co.uk', phone: '+44 20 5550 0111', segments: seg('45-54', 'urban', 'man', 'lives with partner and kids under 18', ['price-conscious', 'convenience-driven'], 'rarely / less than once a month'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-03' },
  { id: 'r12', pid: 'R-1012', name: 'Grace Holloway', src: 'client', email: 'grace.holloway@example.com', phone: '+1 555 0112', segments: seg('55+', 'small town', 'woman', 'lives alone', ['brand loyalist'], 'a few times a month'), ai: M('Completed', 'Oct 14'), live: M('Scheduled', 'Oct 25, 14:00'), tech: 'Passed', consent: 'Signed', interview: 2103, role: 'Main', addedOn: '2026-09-22', lastActivity: '2026-10-14' },
  { id: 'r13', pid: 'R-1013', name: 'Daniel Park', src: 'client', email: 'daniel.park@example.com', phone: '+1 555 0113', segments: seg('18-31', 'urban', 'man', 'lives with roommates', ['convenience-driven', 'experience-seeker'], 'daily'), ai: M('Completed', 'Oct 11'), live: M('Completed', 'Oct 14'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-01', lastActivity: '2026-10-14' },
  { id: 'r14', pid: 'R-1014', name: 'Emily Walsh', src: 'client', email: 'emily.walsh@example.co.uk', phone: '+44 20 5550 0114', segments: seg('32-44', 'suburban', 'woman', 'single parent', ['price-conscious', 'health-conscious'], 'once a week'), ai: M('Not started', 'Assigned Oct 17'), live: M('Scheduled', 'Oct 27, 11:00'), tech: 'Pending', consent: 'Signed', interview: 2104, role: 'Main', addedOn: '2026-09-25', lastActivity: '2026-10-18' },
  { id: 'r15', pid: 'R-1015', name: 'Carlos Mendoza', src: 'upload', email: 'carlos.mendoza@example.com', phone: '+1 555 0115', segments: seg('45-54', 'rural', 'man', 'lives with extended family', ['price-conscious'], 'never'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-03' },
  { id: 'r16', pid: 'R-1016', name: 'Hannah Jensen', src: 'client', email: 'hannah.jensen@example.com', phone: '+1 555 0116', segments: seg('32-44', 'suburban', 'woman', 'lives with partner and kids under 18', ['eco-conscious', 'quality-focused'], 'a few times a week'), ai: M('Partial', 'Stopped at question 8'), live: M('Not scheduled', 'Invited Oct 18'), tech: 'Pending', consent: 'Signed', addedOn: '2026-09-10', lastActivity: '2026-10-18' },
  { id: 'r17', pid: 'R-1017', name: 'Oliver Thompson', src: 'client', email: 'oliver.thompson@example.co.uk', phone: '+44 20 5550 0117', segments: seg('18-31', 'small town', 'man', 'lives with parents', ['experience-seeker'], 'rarely / less than once a month'), ai: M('Completed', 'Oct 15'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-14', lastActivity: '2026-10-15' },
  { id: 'r18', pid: 'R-1018', name: 'Sofia Garcia', src: 'client', email: 'sofia.garcia@example.com', phone: '+1 555 0118', segments: seg('45-54', 'urban', 'woman', 'lives with partner no kids', ['quality-focused', 'brand loyalist'], 'once a week'), ai: M('Completed', 'Oct 13'), live: M('Completed', 'Oct 17'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-03', lastActivity: '2026-10-17' },
  { id: 'r19', pid: 'R-1019', name: 'Liam Fletcher', src: 'upload', email: 'liam.fletcher@example.co.uk', phone: '+44 20 5550 0119', segments: seg('18-31', 'urban', 'non-binary', 'lives with roommates', ['eco-conscious'], 'a few times a week'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-10-03', lastActivity: '2026-10-19' },
  { id: 'r20', pid: 'R-1020', name: 'Chloe Dubois', src: 'client', email: 'chloe.dubois@example.com', phone: '+1 555 0120', segments: seg('18-31', 'urban', 'woman', 'lives alone', [], ''), ai: M('Not started', 'Assigned Oct 14'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-08' },
  { id: 'r21', pid: 'R-1021', name: 'Noah Kowalski', src: 'client', email: 'noah.kowalski@example.com', phone: '+1 555 0121', segments: seg('32-44', 'suburban', 'man', 'lives with partner and kids under 18', ['convenience-driven'], 'daily'), ai: M('Completed', 'Oct 12'), live: M('Scheduled', 'Oct 23, 15:30'), tech: 'Passed', consent: 'Signed', interview: 2101, role: 'Main', addedOn: '2026-09-06', lastActivity: '2026-10-12' },
  { id: 'r22', pid: 'R-1022', name: 'Isabella Rossi', src: 'client', email: 'isabella.rossi@example.co.uk', phone: '+44 20 5550 0122', segments: seg('45-54', 'urban', 'woman', 'lives with partner and adult kids', ['brand loyalist', 'quality-focused'], 'a few times a week'), ai: M('Not started', 'Assigned Oct 16'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-19', lastActivity: '2026-10-16' },
  { id: 'r23', pid: 'R-1023', name: 'Ethan Brooks', src: 'upload', email: 'ethan.brooks@example.com', phone: '+1 555 0123', segments: seg('18-31', 'small town', 'man', '', ['price-conscious'], 'a few times a month'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-10-03', lastActivity: '2026-10-08' },
  { id: 'r24', pid: 'R-1024', name: 'Amelia Vaughan', src: 'client', email: 'amelia.vaughan@example.co.uk', phone: '+44 20 5550 0124', segments: seg('55+', 'rural', 'woman', 'lives with partner no kids', ['health-conscious'], 'rarely / less than once a month'), ai: M('Completed', 'Oct 14'), live: M('Completed', 'Oct 18'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-09', lastActivity: '2026-10-18' },
  { id: 'r25', pid: 'R-1025', name: 'Lucia Alvarez', src: 'client', email: 'lucia.alvarez@example.com', phone: '+1 555 0125', segments: seg('32-44', 'urban', 'woman', 'single parent', ['convenience-driven', 'price-conscious'], 'a few times a week'), ai: M('Completed', 'Oct 13'), live: M('Not scheduled', 'Invited Oct 19'), tech: 'Pending', consent: 'Not submitted', interview: 2103, role: 'Backup', addedOn: '2026-09-27', lastActivity: '2026-10-19' },
  { id: 'r26', pid: 'R-1026', name: 'Benjamin Hart', src: 'client', email: 'benjamin.hart@example.com', phone: '+1 555 0126', segments: seg('55+', 'suburban', 'man', 'lives alone', ['brand loyalist'], 'never'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-08-28', lastActivity: '2026-10-07' },
  { id: 'r27', pid: 'R-1027', name: 'Freya Nolan', src: 'upload', email: 'freya.nolan@example.co.uk', phone: '+44 20 5550 0127', segments: seg('18-31', 'urban', 'other', 'lives with roommates', ['experience-seeker', 'eco-conscious'], 'daily'), ai: M('Completed', 'Oct 17'), live: M('Scheduled', 'Oct 28, 09:30'), tech: 'Pending', consent: 'Signed', interview: 2105, role: 'Main', addedOn: '2026-10-03', lastActivity: '2026-10-17' },
  { id: 'r28', pid: 'R-1028', name: 'Mateo Lopez', src: 'client', email: 'mateo.lopez@example.com', phone: '+1 555 0128', segments: seg('32-44', 'small town', 'man', 'lives with extended family', ['price-conscious'], 'once a week'), ai: M('Partial', 'Stopped at question 2'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', addedOn: '2026-09-16', lastActivity: '2026-10-15' },
  { id: 'r29', pid: 'R-1029', name: 'Harriet Clarke', src: 'client', email: 'harriet.clarke@example.co.uk', phone: '+44 20 5550 0129', segments: seg('', '', 'woman', '', [], ''), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', addedOn: '2026-10-12' },
  { id: 'r30', pid: 'R-1030', name: 'Victor Silva', src: 'client', email: 'victor.silva@example.com', phone: '+1 555 0130', segments: seg('45-54', 'suburban', 'man', 'lives with partner and kids under 18', ['quality-focused', 'experience-seeker'], 'a few times a week'), ai: M('Completed', 'Oct 16'), live: M('Completed', 'Oct 20'), tech: 'Passed', consent: 'Signed', addedOn: '2026-09-04', lastActivity: '2026-10-20' },
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
    initials: name.split(' ').map((w) => w.charAt(0)).join('').replace('.', '').slice(0, 2).toUpperCase(),
  }
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

export const respondents: Respondent[] = raw.map((r, i) => enrichRespondent({ ...r, timezone: r.timezone ?? sampleTimezone(r) }, i))

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

/** 'source', or a single-value segment (multi-value segments can't group rows). */
export type GroupBy = 'none' | 'source' | SegmentKey
