import { M, TODAY, enrichRespondent, type Respondent, type Via } from '../data/respondents'

/*
 * Pasting rows copied from Excel / Google Sheets.
 *
 * Spreadsheets put the selection on the clipboard as tab-separated text: tabs
 * between cells, line breaks between rows, and cells containing a tab, line
 * break or quote wrapped in double quotes (inner quotes doubled).
 */

export type ImportField =
  | 'name' | 'firstName' | 'lastName' | 'email' | 'phone'
  | 'market' | 'buyer' | 'shopper' | 'via' | 'brands' | 'freq'

/** Fields a pasted column can fill. Status columns (sessions, consent, tech check) are produced by the product, not pasted. */
export const IMPORT_FIELDS: Array<{ key: ImportField; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'market', label: 'Market (US / UK)' },
  { key: 'buyer', label: 'Buyer status' },
  { key: 'shopper', label: 'Shopper type' },
  { key: 'via', label: 'Recruited via' },
  { key: 'brands', label: 'Screener: brands bought' },
  { key: 'freq', label: 'Screener: how often they buy snacks' },
]

export const MAX_PASTE_ROWS = 2000

export type Mapping = Array<ImportField | null>

export interface PastedTable {
  rows: string[][]
  hasHeader: boolean
  mapping: Mapping
}

/* ---------- Parsing ---------- */

/** Splits clipboard text into a rectangular grid, dropping empty rows and columns. */
export function parseClipboardTable(text: string): string[][] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (src[i + 1] === '"') { cell += '"'; i++ }
      else quoted = false
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === '\t') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }

  const cleaned = rows
    .map((r) => r.map((c) => c.replace(/\s+/g, ' ').trim()))
    .filter((r) => r.some((c) => c !== ''))
  const width = Math.max(0, ...cleaned.map((r) => r.length))
  const usedColumns = Array.from({ length: width }, (_, i) => i).filter((i) => cleaned.some((r) => (r[i] ?? '') !== ''))
  return cleaned.map((r) => usedColumns.map((i) => r[i] ?? ''))
}

/* ---------- Column mapping ---------- */

function norm(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Header names people commonly use, in English and Portuguese (compared after norm()).
const HEADER_ALIASES: Record<ImportField, string[]> = {
  name: ['name', 'full name', 'respondent', 'respondent name', 'participant', 'participant name', 'nome', 'nome completo', 'respondente', 'participante'],
  firstName: ['first name', 'given name', 'first', 'primeiro nome'],
  lastName: ['last name', 'surname', 'family name', 'last', 'sobrenome', 'ultimo nome'],
  email: ['email', 'e mail', 'email address', 'e mail address', 'mail', 'endereco de email'],
  phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'mobile phone', 'cell', 'cell phone', 'telefone', 'celular', 'whatsapp'],
  market: ['market', 'country', 'region', 'mercado', 'pais', 'regiao'],
  buyer: ['buyer status', 'buyer', 'buyer non buyer', 'purchaser', 'comprador', 'status de compra'],
  shopper: ['shopper type', 'shopper', 'channel', 'shopping channel', 'tipo de comprador', 'canal', 'canal de compra'],
  via: ['recruited via', 'source', 'recruitment source', 'origem', 'fonte', 'recrutado via'],
  brands: ['brands', 'brands bought', 'brands bought last 6 months', 'marcas', 'marcas compradas'],
  freq: ['frequency', 'purchase frequency', 'how often', 'how often they buy snacks', 'frequencia', 'frequencia de compra'],
}

function fieldForHeader(header: string): ImportField | null {
  const h = norm(header)
  if (!h) return null
  const fields = Object.keys(HEADER_ALIASES) as ImportField[]
  const exact = fields.find((f) => HEADER_ALIASES[f].includes(h))
  if (exact) return exact
  // Longest alias contained in the header wins, e.g. "Customer email" -> email.
  let best: { field: ImportField; length: number } | null = null
  for (const f of fields) {
    for (const alias of HEADER_ALIASES[f]) {
      if (alias.length >= 4 && ` ${h} `.includes(` ${alias} `) && (!best || alias.length > best.length)) best = { field: f, length: alias.length }
    }
  }
  return best?.field ?? null
}

/** A first row is a header when it names at least one known field and holds no data-looking values. */
export function detectHeader(firstRow: string[]): boolean {
  return firstRow.some((c) => fieldForHeader(c) !== null) && !firstRow.some((c) => c.includes('@') || toMarket(c) !== null)
}

function mostly(values: string[], test: (v: string) => boolean) {
  const filled = values.filter(Boolean)
  return filled.length > 0 && filled.filter(test).length / filled.length >= 0.6
}

/** Maps columns by header name, then fills unmapped columns by looking at their values. */
export function guessMapping(rows: string[][], hasHeader: boolean): Mapping {
  const width = rows[0]?.length ?? 0
  const mapping: Mapping = Array(width).fill(null)
  const used = new Set<ImportField>()
  const assign = (i: number, f: ImportField | null) => {
    if (f && !used.has(f) && mapping[i] === null) { mapping[i] = f; used.add(f) }
  }

  if (hasHeader) rows[0].forEach((h, i) => assign(i, fieldForHeader(h)))

  const sample = rows.slice(hasHeader ? 1 : 0, 51)
  const columnValues = (i: number) => sample.map((r) => r[i])
  const byContent: Array<[ImportField, (v: string) => boolean]> = [
    ['email', isEmail],
    ['market', (v) => toMarket(v) !== null],
    ['buyer', (v) => toBuyer(v) !== null],
    ['shopper', (v) => toShopper(v) !== null],
    ['phone', isPhone],
  ]
  for (const [field, test] of byContent) {
    for (let i = 0; i < width; i++) if (mapping[i] === null && mostly(columnValues(i), test)) { assign(i, field); break }
  }
  if (!used.has('name') && !used.has('firstName')) {
    for (let i = 0; i < width; i++) if (mapping[i] === null && mostly(columnValues(i), (v) => /[a-z]/i.test(v))) { assign(i, 'name'); break }
  }
  return mapping
}

/** Builds the initial table state from clipboard text. */
export function readPaste(text: string): PastedTable | { error: string } {
  const rows = parseClipboardTable(text)
  if (!rows.length) return { error: 'Nothing to add. Copy the cells in your spreadsheet first, then paste.' }
  const hasHeader = detectHeader(rows[0])
  if (rows.length - (hasHeader ? 1 : 0) > MAX_PASTE_ROWS) {
    return { error: `That is more than ${MAX_PASTE_ROWS.toLocaleString('en-US')} rows. Paste up to ${MAX_PASTE_ROWS.toLocaleString('en-US')} at a time.` }
  }
  return { rows, hasHeader, mapping: guessMapping(rows, hasHeader) }
}

/** Problems with the column mapping itself; any of these blocks adding rows. */
export function mappingProblems(mapping: Mapping): string[] {
  const problems: string[] = []
  const label = (f: ImportField) => IMPORT_FIELDS.find((x) => x.key === f)!.label
  const counts = new Map<ImportField, number>()
  mapping.forEach((f) => f && counts.set(f, (counts.get(f) ?? 0) + 1))
  for (const [f, n] of counts) if (n > 1) problems.push(`${n} columns are set to ${label(f)}. Choose one.`)
  if (!counts.has('name') && !counts.has('firstName')) problems.push('Choose which column has the respondent’s name.')
  if (counts.has('name') && (counts.has('firstName') || counts.has('lastName'))) problems.push('Use either Name or First name / Last name, not both.')
  if (!counts.has('market')) problems.push('Choose which column has the market (US or UK).')
  return problems
}

/* ---------- Values ---------- */

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
function isPhone(v: string) {
  return /^\+?[\d\s().-]+$/.test(v) && v.replace(/\D/g, '').length >= 6
}
function toMarket(v: string): 'US' | 'UK' | null {
  const n = norm(v)
  if (['us', 'usa', 'u s', 'u s a', 'united states', 'united states of america', 'america', 'eua', 'estados unidos'].includes(n)) return 'US'
  if (['uk', 'u k', 'gb', 'united kingdom', 'great britain', 'britain', 'england', 'reino unido', 'inglaterra'].includes(n)) return 'UK'
  return null
}
function toBuyer(v: string): 'Buyer' | 'Non-buyer' | null {
  const n = norm(v)
  if (['buyer', 'yes', 'y', 'sim', 'comprador', 'true'].includes(n)) return 'Buyer'
  if (['non buyer', 'nonbuyer', 'not buyer', 'no', 'n', 'nao', 'nao comprador', 'false'].includes(n)) return 'Non-buyer'
  return null
}
function toShopper(v: string): string[] | null {
  const parts = v.split(/[,;/|+&]| and | e /i).map(norm).filter(Boolean)
  const out = new Set<string>()
  for (const p of parts) {
    if (['both', 'ambos', 'all'].includes(p)) { out.add('Online'); out.add('In-store') }
    else if (['online', 'on line', 'e commerce', 'ecommerce', 'internet', 'web'].includes(p)) out.add('Online')
    else if (['in store', 'instore', 'store', 'offline', 'physical', 'loja', 'loja fisica', 'presencial'].includes(p)) out.add('In-store')
    else return null
  }
  return out.size ? ['Online', 'In-store'].filter((s) => out.has(s)) : null
}
function toVia(v: string): Via | null {
  const n = norm(v).replace(/^screener /, '')
  if (n === 'us general') return 'US general'
  if (n === 'uk general') return 'UK general'
  if (['agency', 'agency upload', 'agency file', 'upload', 'upload agency file'].includes(n)) return 'Agency upload'
  return null
}
function toList(v: string) {
  return v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
}

/* ---------- Rows ---------- */

export interface Draft {
  name: string
  email?: string
  phone?: string
  market: 'US' | 'UK'
  buyer?: 'Buyer' | 'Non-buyer'
  shopper: string[]
  via: Via
  brands: string[]
  freq: string
}

export interface CheckedRow {
  errors: string[]
  draft: Draft | null
}

/** Validates each pasted row against the mapping, the existing respondents and the other pasted rows. */
export function checkRows(rows: string[][], mapping: Mapping, existing: readonly Respondent[]): CheckedRow[] {
  const takenEmails = new Map(existing.filter((r) => r.email).map((r) => [r.email!.toLowerCase(), r.pid]))
  const seenInPaste = new Map<string, number>()

  return rows.map((cells, index) => {
    const value = (f: ImportField) => {
      const i = mapping.indexOf(f)
      return i === -1 ? '' : (cells[i] ?? '')
    }
    const errors: string[] = []

    const name = (mapping.includes('name') ? value('name') : `${value('firstName')} ${value('lastName')}`).trim()
    if (!name) errors.push('Name is empty')

    const email = value('email')
    if (email && !isEmail(email)) errors.push('Email doesn’t look valid')
    else if (email) {
      const key = email.toLowerCase()
      if (takenEmails.has(key)) errors.push(`Already in the table (${takenEmails.get(key)})`)
      else if (seenInPaste.has(key)) errors.push(`Same email as row ${seenInPaste.get(key)! + 1}`)
      else seenInPaste.set(key, index)
    }

    const phone = value('phone')
    if (phone && !isPhone(phone)) errors.push('Phone doesn’t look valid')

    const marketRaw = value('market')
    const market = toMarket(marketRaw)
    if (!marketRaw) errors.push('Market is empty')
    else if (!market) errors.push('Market must be US or UK')

    const buyerRaw = value('buyer')
    const buyer = buyerRaw ? toBuyer(buyerRaw) : undefined
    if (buyer === null) errors.push('Buyer status must be Buyer or Non-buyer')

    const shopperRaw = value('shopper')
    const shopper = shopperRaw ? toShopper(shopperRaw) : []
    if (shopper === null) errors.push('Shopper type must be Online and/or In-store')

    const viaRaw = value('via')
    const via = viaRaw ? toVia(viaRaw) : 'Spreadsheet paste'
    if (via === null) errors.push('Recruited via must be US general, UK general or Agency upload, or empty')

    if (errors.length || !market || buyer === null || shopper === null || via === null) return { errors, draft: null }
    return {
      errors,
      draft: { name, email: email || undefined, phone: phone || undefined, market, buyer, shopper, via, brands: toList(value('brands')), freq: value('freq') },
    }
  })
}

/** Turns valid drafts into respondents with the next free IDs. */
export function createRespondents(drafts: Draft[], existing: readonly Respondent[]): Respondent[] {
  let next = Math.max(1000, ...existing.map((r) => Number(r.pid.replace(/\D/g, '')) || 0)) + 1
  return drafts.map((d, i) => {
    const pid = `R-${next++}`
    return enrichRespondent(
      {
        id: `paste-${pid}`,
        pid,
        name: d.name,
        src: 'paste',
        email: d.email,
        phone: d.phone,
        via: d.via,
        market: d.market,
        buyer: d.buyer,
        shopper: d.shopper,
        diary: M('Not assigned'),
        ai: M('Not assigned'),
        live: M('Not assigned'),
        tech: 'Not needed',
        consent: 'Not submitted',
        brands: d.brands,
        freq: d.freq,
        addedOn: TODAY,
      },
      existing.length + i,
    )
  })
}
