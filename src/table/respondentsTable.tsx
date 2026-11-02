import {
  columnFilteringFeature,
  columnGroupingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  metaHelper,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type Row,
  type SortFn,
} from '@tanstack/react-table'
import { Checkbox } from '../components/Checkbox'
import { EditableOptions, EditableText } from '../components/EditableCell'
import { Icon, type IconName } from '../components/Icon'
import { StatusTag, Tag } from '../components/Tag'
import {
  BUYER_STATUSES,
  INTERVIEW_ROLES,
  INTERVIEW_SESSIONS,
  MARKETS,
  SHOPPER_TYPES,
  SORT_ORDER,
  answersIn,
  canEditContact,
  interviewSession,
  limitPII,
  sourceLabel,
  type GroupBy,
  type Respondent,
  type Screener,
} from '../data/respondents'
import { allTimezones, timezoneDescription, timezoneInfo, timezoneSearchText } from '../data/timezones'
import { matchesFilters, type Filters } from '../filters/filters'

export interface RespondentColumnMeta {
  kind: 'int' | 'std' | 'core' | 'seg' | 'scr' | 'internal'
  screener?: Screener
  /** The header shows this icon, with the column name in a tooltip. */
  icon?: IconName
  /** Personal data: the header shows a "PII" marker. */
  pii?: boolean
  multi?: boolean
  /** Grouping offered from this column's header menu. */
  groupKey?: Exclude<GroupBy, 'none'>
}

export type MenuState = { type: 'row' | 'col'; id: string } | null

/** Pinned columns may take up to this share of the table's visible width. */
export const PINNED_WIDTH_SHARE = 0.5

export interface RespondentTableMeta {
  selectedId: string | null
  /** Respondents added in this session (shown with a "New" tag). */
  newIds: ReadonlySet<string>
  menu: MenuState
  onOpen: (id: string) => void
  onToggleMenu: (menu: NonNullable<MenuState>) => void
  /** Saves an inline cell edit. */
  onUpdate: (id: string, patch: Partial<Respondent>) => void
}

export const features = tableFeatures({
  columnVisibilityFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnGroupingFeature,
  rowSortingFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  columnMeta: metaHelper<RespondentColumnMeta>(),
  tableMeta: metaHelper<RespondentTableMeta>(),
})

export type RespondentRow = Row<typeof features, Respondent>

/* ---------- Sorting: ascending comparators, Table reverses for desc ---------- */

// Group header rows have no value for leaf columns, so groups keep their data order.
function compareDefined(a: unknown, b: unknown, compare: (x: never, y: never) => number) {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1
  return compare(a as never, b as never)
}
const byStatusRank: SortFn<typeof features, Respondent> = (a, b, id) =>
  compareDefined(a.getValue(id), b.getValue(id), (x: string, y: string) => (SORT_ORDER[x] ?? 9) - (SORT_ORDER[y] ?? 9))
const byText: SortFn<typeof features, Respondent> = (a, b, id) =>
  compareDefined(a.getValue(id), b.getValue(id), (x: string, y: string) => x.toLowerCase().localeCompare(y.toLowerCase()))
// West to east, then by name; unknown timezones last.
const byUtcOffset: SortFn<typeof features, Respondent> = (a, b, id) =>
  compareDefined(a.getValue(id), b.getValue(id), (x: string, y: string) => {
    const tx = timezoneInfo(x)
    const ty = timezoneInfo(y)
    return tx.offset - ty.offset || tx.id.localeCompare(ty.id)
  })
const byFavorite: SortFn<typeof features, Respondent> = (a, b, id) =>
  compareDefined(a.getValue(id), b.getValue(id), (x: boolean, y: boolean) => Number(y) - Number(x))

/** Global filter: every structured filter plus the multi-term search. */
export function respondentFilter(row: RespondentRow, _columnId: string, filters: Filters) {
  return matchesFilters(row.original, filters)
}

/* ---------- Cells ---------- */

function SegmentCell({ values }: { values: readonly string[] }) {
  if (!values.length) return <span className="cell-dash">—</span>
  return <span className="chip-list">{values.map((v) => <Tag key={v}>{v}</Tag>)}</span>
}

function RespondentCell({ row, meta }: { row: RespondentRow; meta: RespondentTableMeta }) {
  const r = row.original
  const menuOpen = meta.menu?.type === 'row' && meta.menu.id === r.id
  return (
    <>
      <Checkbox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        aria-label={`Select ${r.name}, ${r.pid}`}
      />
      <span className="who">
        <button
          type="button"
          className="who-name"
          data-opener={r.id}
          onClick={() => meta.onOpen(r.id)}
        >
          {r.name}
        </button>
        {meta.newIds.has(r.id) && <Tag variant="feature">New</Tag>}
      </span>
      <button
        type="button"
        className="icon-btn"
        data-menu-anchor={`row:${r.id}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Actions for ${r.name}, ${r.pid}`}
        onClick={() => meta.onToggleMenu({ type: 'row', id: r.id })}
      >
        <Icon name="dots" />
      </button>
    </>
  )
}

function StatusCell({ value, sub }: { value: string; sub?: string }) {
  if (value === '—') return <span className="cell-dash">—</span>
  return (
    <>
      <StatusTag status={value} />
      {sub && <span className="cell-sub">{sub}</span>}
    </>
  )
}

function ScreenerCell({ r, screener, values }: { r: Respondent; screener: Screener; values: string[] }) {
  if (answersIn(r) !== screener) return <span className="cell-na">Not in this screener</span>
  if (!values.length) return <span className="cell-dash">—</span>
  return (
    <span className="chip-list">
      {values.slice(0, 2).map((v) => <Tag key={v} variant="outline">{v}</Tag>)}
      {values.length > 2 && <Tag variant="more" title={values.join(', ')}>+{values.length - 2}</Tag>}
    </span>
  )
}

/* ---------- Columns ---------- */

const helper = createColumnHelper<typeof features, Respondent>()

function screenerColumn(id: string, screener: Screener, label: string, multi: boolean, get: (r: Respondent) => string[]) {
  return helper.accessor((r) => get(r).join(', '), {
    id,
    header: label,
    enableSorting: false,
    size: 220,
    minSize: 140,
    meta: { kind: 'scr', screener, multi },
    cell: ({ row }) => <ScreenerCell r={row.original} screener={screener} values={get(row.original)} />,
  })
}

function TextCell({ value }: { value: string }) {
  return <span className={value === '—' ? 'cell-dash' : 'cell-main'}>{value}</span>
}

/** Email and phone: edited as text where the respondent has contact details. */
function ContactCell({ r, field, shown, meta }: { r: Respondent; field: 'email' | 'phone'; shown: string; meta: RespondentTableMeta }) {
  if (!canEditContact(r)) return <TextCell value={shown} />
  return (
    <EditableText
      label={`${field === 'email' ? 'Email' : 'Phone'} for ${r.name}`}
      type={field === 'email' ? 'email' : 'tel'}
      value={r[field] ?? ''}
      onCommit={(v) => meta.onUpdate(r.id, { [field]: v || undefined })}
    >
      <TextCell value={shown} />
    </EditableText>
  )
}

/** Assigned live interview session: picked from the project's sessions, with its date and ID. */
function InterviewCell({ r, meta }: { r: Respondent; meta: RespondentTableMeta }) {
  const session = interviewSession(r)
  const byName = (name: string) => INTERVIEW_SESSIONS.find((s) => s.name === name)
  return (
    <EditableOptions
      label={`Interview for ${r.name}`}
      anchorKey={`cell:${r.id}:interview`}
      value={session ? [session.name] : []}
      options={INTERVIEW_SESSIONS.map((s) => s.name)}
      emptyLabel="Not assigned"
      describe={(name) => {
        const s = byName(name)!
        return `${s.when} · ID ${s.id}`
      }}
      // A new assignment starts as Main unless a role is already set.
      onCommit={([name]) => {
        const next = name ? byName(name) : undefined
        meta.onUpdate(r.id, next ? { interview: next.id, role: r.role ?? 'Main' } : { interview: undefined })
      }}
    >
      {session ? (
        <>
          <span className="cell-main">{session.name}</span>
          <span className="cell-sub">{session.when} · ID {session.id}</span>
        </>
      ) : (
        <span className="cell-dash">—</span>
      )}
    </EditableOptions>
  )
}

/** Timezone: IANA ID with today's UTC offset; the menu searches every IANA zone. */
function TimezoneCell({ r, meta }: { r: Respondent; meta: RespondentTableMeta }) {
  const tz = r.timezone ? timezoneInfo(r.timezone) : undefined
  return (
    <EditableOptions
      label={`Timezone for ${r.name}`}
      anchorKey={`cell:${r.id}:timezone`}
      value={tz ? [tz.id] : []}
      options={allTimezones}
      describe={timezoneDescription}
      search={{ label: 'Search timezones', text: timezoneSearchText }}
      emptyLabel="Not set"
      onCommit={([id]) => meta.onUpdate(r.id, { timezone: id })}
    >
      {tz ? (
        <>
          <span className="cell-main">{tz.id}</span>
          <span className="cell-sub">{tz.offsetLabel}</span>
        </>
      ) : (
        <span className="cell-dash">—</span>
      )}
    </EditableOptions>
  )
}

/** Role in the interview: editable on every row, also before a session is assigned. */
function RoleCell({ r, meta }: { r: Respondent; meta: RespondentTableMeta }) {
  const values = r.role ? [r.role] : []
  return (
    <EditableOptions
      label={`Interview role for ${r.name}`}
      anchorKey={`cell:${r.id}:role`}
      value={values}
      options={INTERVIEW_ROLES}
      emptyLabel="Not set"
      onCommit={([v]) => meta.onUpdate(r.id, { role: v as Respondent['role'] })}
    >
      <SegmentCell values={values} />
    </EditableOptions>
  )
}

export const columns = helper.columns([
  helper.accessor((r) => r.name, {
    id: 'respondent',
    header: 'Respondent',
    sortFn: byText,
    enableHiding: false,
    // Always pinned first (see DEFAULT_COLUMN_PINNING in App); never unpinned from the menu.
    enablePinning: false,
    size: 220,
    minSize: 160,
    maxSize: 560,
    meta: { kind: 'core' },
    cell: ({ row, table }) => <RespondentCell row={row} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => interviewSession(r)?.name, {
    id: 'interview',
    header: 'Assign to Interview',
    sortFn: byText,
    size: 280,
    minSize: 160,
    meta: { kind: 'int' },
    cell: ({ row, table }) => <InterviewCell r={row.original} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => r.role, {
    id: 'role',
    header: 'Role',
    sortFn: byText,
    size: 120,
    meta: { kind: 'int' },
    cell: ({ row, table }) => <RoleCell r={row.original} meta={table.options.meta!} />,
  }),
  // Status columns with icon headers, side by side after Role.
  helper.accessor((r) => r.liveDoc, {
    id: 'live',
    header: 'Live session',
    sortFn: byStatusRank,
    size: 150,
    meta: { kind: 'int', icon: 'videoChat' },
    cell: ({ row, getValue }) => <StatusCell value={getValue()} sub={row.original.live.s === 'Completed' ? row.original.live.sub : ''} />,
  }),
  helper.accessor((r) => r.tech, {
    id: 'tech',
    header: 'Tech check',
    sortFn: byStatusRank,
    size: 120,
    meta: { kind: 'int', icon: 'monitorCheck' },
    cell: ({ getValue }) => <StatusCell value={getValue()} />,
  }),
  helper.accessor((r) => r.consent, {
    id: 'consent',
    header: 'Consent form',
    sortFn: byStatusRank,
    size: 120,
    meta: { kind: 'int', icon: 'formCheck' },
    cell: ({ getValue }) => <StatusCell value={getValue()} />,
  }),
  helper.accessor((r) => r.prior, {
    id: 'prior',
    header: 'Taken part before',
    sortFn: byStatusRank,
    size: 90,
    meta: { kind: 'int', icon: 'repeat' },
    cell: ({ getValue }) => <span className="cell-main">{getValue()}</span>,
  }),
  helper.accessor((r) => r.fav, {
    id: 'fav',
    header: 'Favorite',
    sortFn: byFavorite,
    size: 80,
    meta: { kind: 'int', icon: 'star' },
    cell: ({ getValue }) =>
      getValue() ? (
        <span className="fav" role="img" aria-label="Favorite"><Icon name="star" /></span>
      ) : (
        <span className="cell-dash" aria-label="Not a favorite">—</span>
      ),
  }),
  helper.accessor((r) => r.pid, {
    id: 'pid',
    header: 'ID',
    sortFn: byText,
    size: 110,
    meta: { kind: 'std' },
    cell: ({ getValue }) => <TextCell value={getValue()} />,
  }),
  helper.accessor((r) => (r.src === 'rio' ? '—' : limitPII ? 'Hidden' : (r.email ?? '—')), {
    id: 'email',
    header: 'Email',
    enableSorting: false,
    size: 240,
    meta: { kind: 'std', pii: true },
    cell: ({ row, table, getValue }) => <ContactCell r={row.original} field="email" shown={getValue()} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => (r.src === 'rio' ? '—' : limitPII ? 'Hidden' : (r.phone ?? '—')), {
    id: 'phone',
    header: 'Phone',
    enableSorting: false,
    size: 180,
    meta: { kind: 'std', pii: true },
    cell: ({ row, table, getValue }) => <ContactCell r={row.original} field="phone" shown={getValue()} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => r.timezone, {
    id: 'timezone',
    header: 'Timezone',
    sortFn: byUtcOffset,
    size: 240,
    meta: { kind: 'std' },
    cell: ({ row, table }) => <TimezoneCell r={row.original} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => sourceLabel(r), {
    id: 'source',
    header: 'Source',
    sortFn: byText,
    size: 180,
    meta: { kind: 'std' },
    cell: ({ getValue }) => <TextCell value={getValue()} />,
  }),
  helper.accessor((r) => r.market, {
    id: 'segMarket',
    header: 'Market',
    enableSorting: false,
    size: 120,
    meta: { kind: 'seg', groupKey: 'market' },
    cell: ({ row, table, getValue }) => (
      <EditableOptions
        label={`Market for ${row.original.name}`}
        anchorKey={`cell:${row.id}:segMarket`}
        value={[getValue()]}
        options={MARKETS}
        onCommit={([v]) => table.options.meta!.onUpdate(row.id, { market: v as Respondent['market'] })}
      >
        <SegmentCell values={[getValue()]} />
      </EditableOptions>
    ),
  }),
  helper.accessor((r) => r.buyer ?? '', {
    id: 'segBuyer',
    header: 'Buyer status',
    enableSorting: false,
    size: 140,
    meta: { kind: 'seg', groupKey: 'buyer' },
    cell: ({ row, table }) => {
      const values = row.original.buyer ? [row.original.buyer] : []
      return (
        <EditableOptions
          label={`Buyer status for ${row.original.name}`}
          anchorKey={`cell:${row.id}:segBuyer`}
          value={values}
          options={BUYER_STATUSES}
          emptyLabel="Not set"
          onCommit={([v]) => table.options.meta!.onUpdate(row.id, { buyer: v as Respondent['buyer'] })}
        >
          <SegmentCell values={values} />
        </EditableOptions>
      )
    },
  }),
  helper.accessor((r) => r.shopper.join(', '), {
    id: 'segShopper',
    header: 'Shopper type',
    enableSorting: false,
    size: 180,
    meta: { kind: 'seg', multi: true },
    cell: ({ row, table }) => (
      <EditableOptions
        label={`Shopper type for ${row.original.name}`}
        anchorKey={`cell:${row.id}:segShopper`}
        value={row.original.shopper}
        options={SHOPPER_TYPES}
        multi
        onCommit={(next) => table.options.meta!.onUpdate(row.id, { shopper: next })}
      >
        <SegmentCell values={row.original.shopper} />
      </EditableOptions>
    ),
  }),
  helper.accessor((r) => r.invited, {
    id: 'invited',
    header: 'Invited',
    sortFn: byStatusRank,
    size: 120,
    meta: { kind: 'core' },
    cell: ({ getValue }) => <StatusCell value={getValue()} />,
  }),
  helper.accessor((r) => r.rec, {
    id: 'rec',
    header: 'Recording',
    sortFn: byStatusRank,
    size: 130,
    meta: { kind: 'core' },
    cell: ({ getValue }) => <StatusCell value={getValue()} />,
  }),
  helper.accessor((r) => r.asyncS, {
    id: 'async',
    header: 'Async activity',
    sortFn: byStatusRank,
    size: 160,
    meta: { kind: 'core' },
    cell: ({ row, getValue }) => <StatusCell value={getValue()} sub={row.original.asyncSub} />,
  }),
  screenerColumn('usBrands', 'US general', 'Brands bought (last 6 months)', true, (r) => r.brands),
  screenerColumn('usFreq', 'US general', 'How often they buy snacks', false, (r) => (r.freq ? [r.freq] : [])),
  screenerColumn('ukBrands', 'UK general', 'Brands bought (last 6 months)', true, (r) => r.brands),
  screenerColumn('ukFreq', 'UK general', 'How often they buy snacks', false, (r) => (r.freq ? [r.freq] : [])),
  // Grouping-only columns: always hidden, used by the "Group by" control.
  helper.accessor((r) => r.market, { id: 'market', header: 'Market', enableHiding: false, enableSorting: false, enableResizing: false, meta: { kind: 'internal' } }),
  helper.accessor((r) => r.buyer, { id: 'buyer', header: 'Buyer status', enableHiding: false, enableSorting: false, enableResizing: false, meta: { kind: 'internal' } }),
  helper.accessor((r) => r.via, { id: 'via', header: 'Recruited via', enableHiding: false, enableSorting: false, enableResizing: false, meta: { kind: 'internal' } }),
])

export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  usFreq: false,
  ukFreq: false,
  market: false,
  buyer: false,
  via: false,
}

/** Sections of the "Columns" panel. */
export const COLUMN_PANEL_GROUPS: Array<{ name: string; match: (meta: RespondentColumnMeta) => boolean }> = [
  { name: 'Interview', match: (m) => m.kind === 'int' },
  { name: 'Standard values', match: (m) => m.kind === 'std' },
  { name: 'Respondent info', match: (m) => m.kind === 'core' },
  { name: 'Segments', match: (m) => m.kind === 'seg' },
  { name: 'Screener: US general', match: (m) => m.kind === 'scr' && m.screener === 'US general' },
  { name: 'Screener: UK general', match: (m) => m.kind === 'scr' && m.screener === 'UK general' },
]
