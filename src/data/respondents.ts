export type MethodStatus = { s: string; sub: string }
export type Source = 'client' | 'rio' | 'upload' | 'paste'
export type Via = 'US general' | 'UK general' | 'Agency upload' | 'Spreadsheet paste'
export type Screener = 'US general' | 'UK general'

export interface Respondent {
  id: string
  pid: string
  name: string
  src: Source
  email?: string
  phone?: string
  rio?: string
  via: Via
  market: 'US' | 'UK'
  /** Optional: pasted spreadsheets do not always include it. */
  buyer?: 'Buyer' | 'Non-buyer'
  shopper: string[]
  diary: MethodStatus
  ai: MethodStatus
  live: MethodStatus
  /** Display status for each column, derived from the raw record. */
  tech: string
  consent: string
  liveDoc: string
  invited: string
  rec: string
  prior: 'Yes' | 'No'
  fav: boolean
  asyncS: string
  asyncSub: string
  brands: string[]
  freq: string
  /** ISO dates (YYYY-MM-DD). Sample data is anchored to TODAY. */
  addedOn: string
  lastActivity?: string
  avatarClass: string
  initials: string
}

export function M(s: string, sub = ''): MethodStatus {
  return { s, sub }
}

export type RawRespondent =Omit<Respondent, 'liveDoc' | 'invited' | 'rec' | 'prior' | 'fav' | 'asyncS' | 'asyncSub' | 'avatarClass' | 'initials'>

const raw: RawRespondent[] = [
  { id: 'r1', pid: 'R-1001', name: 'Sarah Kim', src: 'client', email: 'sarah.kim@example.com', phone: '+1 555 0101', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online', 'In-store'], diary: M('Completed', 'Oct 12'), ai: M('Completed', 'Oct 14'), live: M('Completed', 'Oct 16'), tech: 'Passed', consent: 'Signed', brands: ['Brand A', 'Brand C'], freq: 'Weekly', addedOn: '2026-09-02', lastActivity: '2026-10-16' },
  { id: 'r2', pid: 'R-1002', name: 'Sarah Mitchell', src: 'client', email: 'sarah.mitchell@example.co.uk', phone: '+44 20 5550 0102', via: 'UK general', market: 'UK', buyer: 'Non-buyer', shopper: ['In-store'], diary: M('In progress', 'Day 9 of 14'), ai: M('Not started', 'Assigned Oct 15'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-09-05', lastActivity: '2026-10-15' },
  { id: 'r3', pid: 'R-1003', name: 'Jessica Moore', src: 'rio', rio: 'RIO-7F3K21', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online'], diary: M('Completed', 'Oct 11'), ai: M('Partial', 'Stopped at question 6'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['Brand A', 'Brand B', 'Brand C', 'Brand D'], freq: 'Weekly', addedOn: '2026-09-08', lastActivity: '2026-10-11' },
  { id: 'r4', pid: 'R-1004', name: 'Jessica Turner', src: 'rio', rio: 'RIO-9A2M40', via: 'US general', market: 'US', buyer: 'Non-buyer', shopper: ['In-store'], diary: M('Not started', 'Assigned Oct 9'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-09-08' },
  { id: 'r5', pid: 'R-1005', name: 'James Owens', src: 'upload', email: 'james.owens@example.com', phone: '+1 555 0105', via: 'Agency upload', market: 'US', buyer: 'Buyer', shopper: ['Online', 'In-store'], diary: M('Completed', 'Oct 10'), ai: M('Completed', 'Oct 13'), live: M('Scheduled', 'Oct 24, 10:00'), tech: 'Pending', consent: 'Signed', brands: ['Brand B'], freq: 'Monthly', addedOn: '2026-10-03', lastActivity: '2026-10-13' },
  { id: 'r6', pid: 'R-1006', name: 'Priya Nair', src: 'client', email: 'priya.nair@example.co.uk', phone: '+44 20 5550 0106', via: 'UK general', market: 'UK', buyer: 'Buyer', shopper: ['Online'], diary: M('Completed', 'Oct 9'), ai: M('Completed', 'Oct 12'), live: M('Completed', 'Oct 15'), tech: 'Passed', consent: 'Signed', brands: ['Brand A', 'Brand B', 'Brand D'], freq: 'Weekly', addedOn: '2026-09-12', lastActivity: '2026-10-15' },
  { id: 'r7', pid: 'R-1007', name: 'Lucas Reid', src: 'upload', email: 'lucas.reid@example.co.uk', phone: '+44 20 5550 0107', via: 'Agency upload', market: 'UK', buyer: 'Non-buyer', shopper: ['In-store'], diary: M('In progress', 'Day 4 of 14'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-10-03', lastActivity: '2026-10-17' },
  { id: 'r8', pid: 'R-1008', name: 'Ana Costa', src: 'client', email: 'ana.costa@example.com', phone: '+1 555 0108', via: 'US general', market: 'US', buyer: 'Non-buyer', shopper: ['Online'], diary: M('Completed', 'Oct 12'), ai: M('Completed', 'Oct 15'), live: M('Not scheduled', 'Invited Oct 16'), tech: 'Pending', consent: 'Signed', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-09-15', lastActivity: '2026-10-16' },
  { id: 'r9', pid: 'R-1009', name: 'Tom Bennett', src: 'client', email: 'tom.bennett@example.co.uk', phone: '+44 20 5550 0109', via: 'UK general', market: 'UK', buyer: 'Buyer', shopper: ['In-store'], diary: M('Completed', 'Oct 13'), ai: M('Partial', 'Stopped at question 3'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['Brand C'], freq: 'Monthly', addedOn: '2026-09-18', lastActivity: '2026-10-13' },
  { id: 'r10', pid: 'R-1010', name: 'Mei Lin', src: 'client', email: 'mei.lin@example.com', phone: '+1 555 0110', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online'], diary: M('Completed', 'Oct 14'), ai: M('Not started', 'Assigned Oct 16'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', brands: ['Brand A'], freq: 'Weekly', addedOn: '2026-09-20', lastActivity: '2026-10-16' },
  { id: 'r11', pid: 'R-1011', name: 'Omar Shah', src: 'upload', email: 'omar.shah@example.co.uk', phone: '+44 20 5550 0111', via: 'Agency upload', market: 'UK', buyer: 'Non-buyer', shopper: ['Online', 'In-store'], diary: M('Not started', 'Assigned Oct 9'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', brands: ['Brand B', 'Brand C'], freq: 'Monthly', addedOn: '2026-10-03' },
  { id: 'r12', pid: 'R-1012', name: 'Grace Holloway', src: 'client', email: 'grace.holloway@example.com', phone: '+1 555 0112', via: 'US general', market: 'US', buyer: 'Non-buyer', shopper: ['In-store'], diary: M('Completed', 'Oct 11'), ai: M('Completed', 'Oct 14'), live: M('Scheduled', 'Oct 25, 14:00'), tech: 'Passed', consent: 'Signed', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-09-22', lastActivity: '2026-10-14' },
  { id: 'r13', pid: 'R-1013', name: 'Daniel Park', src: 'client', email: 'daniel.park@example.com', phone: '+1 555 0113', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online'], diary: M('Completed', 'Oct 8'), ai: M('Completed', 'Oct 11'), live: M('Completed', 'Oct 14'), tech: 'Passed', consent: 'Signed', brands: ['Brand A', 'Brand D'], freq: 'Weekly', addedOn: '2026-09-01', lastActivity: '2026-10-14' },
  { id: 'r14', pid: 'R-1014', name: 'Emily Walsh', src: 'client', email: 'emily.walsh@example.co.uk', phone: '+44 20 5550 0114', via: 'UK general', market: 'UK', buyer: 'Buyer', shopper: ['Online', 'In-store'], diary: M('In progress', 'Day 7 of 14'), ai: M('Not started', 'Assigned Oct 17'), live: M('Scheduled', 'Oct 27, 11:00'), tech: 'Pending', consent: 'Signed', brands: ['Brand B', 'Brand C'], freq: 'Monthly', addedOn: '2026-09-25', lastActivity: '2026-10-18' },
  { id: 'r15', pid: 'R-1015', name: 'Carlos Mendoza', src: 'upload', email: 'carlos.mendoza@example.com', phone: '+1 555 0115', via: 'Agency upload', market: 'US', buyer: 'Non-buyer', shopper: ['In-store'], diary: M('Not started', 'Assigned Oct 9'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-10-03' },
  { id: 'r16', pid: 'R-1016', name: 'Hannah Jensen', src: 'client', email: 'hannah.jensen@example.com', phone: '+1 555 0116', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online', 'In-store'], diary: M('Completed', 'Oct 15'), ai: M('Partial', 'Stopped at question 8'), live: M('Not scheduled', 'Invited Oct 18'), tech: 'Pending', consent: 'Signed', brands: ['Brand A', 'Brand B', 'Brand C'], freq: 'Weekly', addedOn: '2026-09-10', lastActivity: '2026-10-18' },
  { id: 'r17', pid: 'R-1017', name: 'Oliver Thompson', src: 'client', email: 'oliver.thompson@example.co.uk', phone: '+44 20 5550 0117', via: 'UK general', market: 'UK', buyer: 'Non-buyer', shopper: ['Online'], diary: M('Completed', 'Oct 12'), ai: M('Completed', 'Oct 15'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-09-14', lastActivity: '2026-10-15' },
  { id: 'r18', pid: 'R-1018', name: 'Sofia Garcia', src: 'client', email: 'sofia.garcia@example.com', phone: '+1 555 0118', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['In-store'], diary: M('Completed', 'Oct 10'), ai: M('Completed', 'Oct 13'), live: M('Completed', 'Oct 17'), tech: 'Passed', consent: 'Signed', brands: ['Brand C'], freq: 'Monthly', addedOn: '2026-09-03', lastActivity: '2026-10-17' },
  { id: 'r19', pid: 'R-1019', name: 'Liam Fletcher', src: 'upload', email: 'liam.fletcher@example.co.uk', phone: '+44 20 5550 0119', via: 'Agency upload', market: 'UK', buyer: 'Buyer', shopper: ['Online'], diary: M('In progress', 'Day 2 of 14'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['Brand A'], freq: 'Weekly', addedOn: '2026-10-03', lastActivity: '2026-10-19' },
  { id: 'r20', pid: 'R-1020', name: 'Chloe Dubois', src: 'client', email: 'chloe.dubois@example.com', phone: '+1 555 0120', via: 'US general', market: 'US', buyer: 'Non-buyer', shopper: ['Online'], diary: M('Not started', 'Assigned Oct 14'), ai: M('Not started', 'Assigned Oct 14'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-10-08' },
  { id: 'r21', pid: 'R-1021', name: 'Noah Kowalski', src: 'client', email: 'noah.kowalski@example.com', phone: '+1 555 0121', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online', 'In-store'], diary: M('Completed', 'Oct 9'), ai: M('Completed', 'Oct 12'), live: M('Scheduled', 'Oct 23, 15:30'), tech: 'Passed', consent: 'Signed', brands: ['Brand B', 'Brand D'], freq: 'Weekly', addedOn: '2026-09-06', lastActivity: '2026-10-12' },
  { id: 'r22', pid: 'R-1022', name: 'Isabella Rossi', src: 'client', email: 'isabella.rossi@example.co.uk', phone: '+44 20 5550 0122', via: 'UK general', market: 'UK', buyer: 'Buyer', shopper: ['In-store'], diary: M('Completed', 'Oct 13'), ai: M('Not started', 'Assigned Oct 16'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['Brand C', 'Brand D'], freq: 'Monthly', addedOn: '2026-09-19', lastActivity: '2026-10-16' },
  { id: 'r23', pid: 'R-1023', name: 'Ethan Brooks', src: 'upload', email: 'ethan.brooks@example.com', phone: '+1 555 0123', via: 'Agency upload', market: 'US', buyer: 'Non-buyer', shopper: ['Online'], diary: M('Partial', 'Day 5 of 14'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['Brand B'], freq: 'Rarely', addedOn: '2026-10-03', lastActivity: '2026-10-08' },
  { id: 'r24', pid: 'R-1024', name: 'Amelia Vaughan', src: 'client', email: 'amelia.vaughan@example.co.uk', phone: '+44 20 5550 0124', via: 'UK general', market: 'UK', buyer: 'Non-buyer', shopper: ['Online', 'In-store'], diary: M('Completed', 'Oct 11'), ai: M('Completed', 'Oct 14'), live: M('Completed', 'Oct 18'), tech: 'Passed', consent: 'Signed', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-09-09', lastActivity: '2026-10-18' },
  { id: 'r25', pid: 'R-1025', name: 'Lucia Alvarez', src: 'client', email: 'lucia.alvarez@example.com', phone: '+1 555 0125', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online'], diary: M('In progress', 'Day 11 of 14'), ai: M('Completed', 'Oct 13'), live: M('Not scheduled', 'Invited Oct 19'), tech: 'Pending', consent: 'Not submitted', brands: ['Brand A', 'Brand C'], freq: 'Weekly', addedOn: '2026-09-27', lastActivity: '2026-10-19' },
  { id: 'r26', pid: 'R-1026', name: 'Benjamin Hart', src: 'client', email: 'benjamin.hart@example.com', phone: '+1 555 0126', via: 'US general', market: 'US', buyer: 'Non-buyer', shopper: ['In-store'], diary: M('Completed', 'Oct 7'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-08-28', lastActivity: '2026-10-07' },
  { id: 'r27', pid: 'R-1027', name: 'Freya Nolan', src: 'upload', email: 'freya.nolan@example.co.uk', phone: '+44 20 5550 0127', via: 'Agency upload', market: 'UK', buyer: 'Buyer', shopper: ['Online', 'In-store'], diary: M('Completed', 'Oct 14'), ai: M('Completed', 'Oct 17'), live: M('Scheduled', 'Oct 28, 09:30'), tech: 'Pending', consent: 'Signed', brands: ['Brand A', 'Brand B'], freq: 'Weekly', addedOn: '2026-10-03', lastActivity: '2026-10-17' },
  { id: 'r28', pid: 'R-1028', name: 'Mateo Lopez', src: 'client', email: 'mateo.lopez@example.com', phone: '+1 555 0128', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online'], diary: M('Completed', 'Oct 12'), ai: M('Partial', 'Stopped at question 2'), live: M('Not assigned'), tech: 'Not needed', consent: 'Signed', brands: ['Brand D'], freq: 'Monthly', addedOn: '2026-09-16', lastActivity: '2026-10-15' },
  { id: 'r29', pid: 'R-1029', name: 'Harriet Clarke', src: 'client', email: 'harriet.clarke@example.co.uk', phone: '+44 20 5550 0129', via: 'UK general', market: 'UK', buyer: 'Non-buyer', shopper: ['In-store'], diary: M('Not started', 'Assigned Oct 16'), ai: M('Not assigned'), live: M('Not assigned'), tech: 'Not needed', consent: 'Not submitted', brands: ['None of these'], freq: 'Rarely', addedOn: '2026-10-12' },
  { id: 'r30', pid: 'R-1030', name: 'Victor Silva', src: 'client', email: 'victor.silva@example.com', phone: '+1 555 0130', via: 'US general', market: 'US', buyer: 'Buyer', shopper: ['Online', 'In-store'], diary: M('Completed', 'Oct 13'), ai: M('Completed', 'Oct 16'), live: M('Completed', 'Oct 20'), tech: 'Passed', consent: 'Signed', brands: ['Brand A', 'Brand B', 'Brand C'], freq: 'Weekly', addedOn: '2026-09-04', lastActivity: '2026-10-20' },
]

export const TOTAL_RESPONDENTS = 1760

/** "Today" for the sample data, so relative date filters stay meaningful. */
export const TODAY = '2026-10-21'

/** Derives the display statuses shown in the table from a raw record. */
export function enrichRespondent(r: RawRespondent, i: number): Respondent {
  const name = r.name
  const tech = r.tech === 'Passed' ? 'Completed' : r.tech === 'Pending' ? (r.id === 'r8' ? 'Not sent' : 'Attempted') : '—'
  const acts = [r.diary, r.ai].filter((m) => m.s !== 'Not assigned')
  const doneN = acts.filter((m) => m.s === 'Completed').length
  return {
    ...r,
    name,
    tech,
    consent: r.consent === 'Signed' ? 'Signed' : 'Not signed',
    liveDoc: r.live.s === 'Completed' ? 'Completed' : r.live.s === 'Not assigned' ? 'Not assigned' : 'Assigned',
    invited: r.live.s === 'Not assigned' ? '—' : r.id === 'r8' ? 'Not sent' : 'Sent',
    rec: r.live.s === 'Completed' ? 'Available' : '—',
    prior: r.id === 'r6' || r.id === 'r9' ? 'Yes' : 'No',
    fav: r.src === 'rio',
    asyncS: !acts.length ? 'Not assigned' : acts.some((m) => m.s === 'Partial') ? 'Partial' : doneN === acts.length ? 'Completed' : 'Not completed',
    asyncSub: acts.length ? `${doneN} of ${acts.length} done` : '',
    avatarClass: r.src === 'rio' ? 'av-panel' : `av-${i % 5}`,
    initials: name.split(' ').map((w) => w.charAt(0)).join('').replace('.', '').slice(0, 2).toUpperCase(),
  }
}

export const respondents: Respondent[] = raw.map(enrichRespondent)

export const limitPII = false

export function answersIn(r: Respondent): Screener {
  if (r.via === 'Agency upload' || r.via === 'Spreadsheet paste') return r.market === 'US' ? 'US general' : 'UK general'
  return r.via
}
export function viaLabel(via: Via): string {
  if (via === 'Agency upload') return 'Upload: agency file'
  if (via === 'Spreadsheet paste') return 'Pasted: spreadsheet'
  return `Screener: ${via}`
}
export function viaSub(r: Respondent): string {
  if (r.via === 'Agency upload') return `Oct 3 · answers mapped to ${answersIn(r)}`
  if (r.src === 'paste') return `Added today · answers mapped to ${answersIn(r)}`
  return r.src === 'rio' ? 'Respondent.io panel' : 'Client recruit'
}
const SOURCE_LABELS: Record<Source, string> = {
  client: 'Client recruit',
  rio: 'Respondent.io panel',
  upload: 'Agency upload',
  paste: 'Spreadsheet paste',
}
export function sourceLabel(r: Respondent): string {
  return SOURCE_LABELS[r.src]
}

/** Sample timezones: the data has none, so US respondents rotate through US zones by ID. */
const US_TIMEZONES = ['US Eastern', 'US Central', 'US Pacific']
export function timezoneLabel(r: Respondent): string {
  if (r.market === 'UK') return 'UK (London)'
  return US_TIMEZONES[(Number(r.pid.replace(/\D/g, '')) || 0) % US_TIMEZONES.length]
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

export function isReady(r: Respondent) {
  return r.consent === 'Signed' && (r.tech === 'Completed' || r.tech === '—')
}

/* ---------- Status tones (Discuss DS soft tag variants) ---------- */

export type Tone = 'ok' | 'mid' | 'warn' | 'na'
const TONES: Record<Exclude<Tone, 'na'>, string[]> = {
  ok: ['Completed', 'Signed', 'Sent', 'Available'],
  mid: ['In progress', 'Scheduled', 'Assigned'],
  warn: ['Partial', 'Not started', 'Not scheduled', 'Attempted', 'Not sent', 'Not signed', 'Not completed'],
}
export function tone(s: string): Tone {
  for (const k of Object.keys(TONES) as Array<keyof typeof TONES>) if (TONES[k].includes(s)) return k
  return 'na'
}

/** Sort rank for status columns: done first, missing last. */
export const SORT_ORDER: Record<string, number> = {
  Completed: 0, Signed: 0, Sent: 0, Available: 0, Yes: 0,
  Assigned: 1, Partial: 2, Attempted: 2,
  'Not completed': 3, 'Not sent': 3, 'Not signed': 3,
  No: 4, 'Not assigned': 5, '—': 6,
}

export type GroupBy = 'none' | 'market' | 'buyer' | 'via'
