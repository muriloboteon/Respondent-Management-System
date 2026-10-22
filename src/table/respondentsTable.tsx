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
import { Icon } from '../components/Icon'
import { StatusTag, Tag } from '../components/Tag'
import {
  SORT_ORDER,
  answersIn,
  limitPII,
  sourceLabel,
  timezoneLabel,
  type GroupBy,
  type Respondent,
  type Screener,
} from '../data/respondents'
import { matchesFilters, type Filters } from '../filters/filters'

export interface RespondentColumnMeta {
  kind: 'std' | 'core' | 'seg' | 'scr' | 'internal'
  screener?: Screener
  /** Personal data: the header shows a "PII" marker. */
  pii?: boolean
  multi?: boolean
  /** Grouping offered from this column's header menu. */
  groupKey?: Exclude<GroupBy, 'none'>
}

export type MenuState = { type: 'row' | 'col'; id: string } | null

export interface RespondentTableMeta {
  selectedId: string | null
  /** Respondents added in this session (shown with a "New" tag). */
  newIds: ReadonlySet<string>
  menu: MenuState
  onOpen: (id: string) => void
  onToggleMenu: (menu: NonNullable<MenuState>) => void
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
      <input
        type="checkbox"
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

export const columns = helper.columns([
  helper.accessor((r) => r.name, {
    id: 'respondent',
    header: 'Respondent',
    sortFn: byText,
    enableHiding: false,
    size: 220,
    minSize: 160,
    maxSize: 560,
    meta: { kind: 'core' },
    cell: ({ row, table }) => <RespondentCell row={row} meta={table.options.meta!} />,
  }),
  // Grouped header: "Standard values" spans the fields every respondent record has.
  helper.group({
    id: 'standard',
    header: 'Standard values',
    meta: { kind: 'std' },
    columns: helper.columns([
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
        cell: ({ getValue }) => <TextCell value={getValue()} />,
      }),
      helper.accessor((r) => (r.src === 'rio' ? '—' : limitPII ? 'Hidden' : (r.phone ?? '—')), {
        id: 'phone',
        header: 'Phone',
        enableSorting: false,
        size: 180,
        meta: { kind: 'std', pii: true },
        cell: ({ getValue }) => <TextCell value={getValue()} />,
      }),
      helper.accessor((r) => timezoneLabel(r), {
        id: 'timezone',
        header: 'Timezone',
        sortFn: byText,
        size: 140,
        meta: { kind: 'std' },
        cell: ({ getValue }) => <TextCell value={getValue()} />,
      }),
      helper.accessor((r) => sourceLabel(r), {
        id: 'source',
        header: 'Source',
        sortFn: byText,
        size: 180,
        meta: { kind: 'std' },
        cell: ({ getValue }) => <TextCell value={getValue()} />,
      }),
    ]),
  }),
  // Grouped header: "Segments" spans one column per segment attribute.
  helper.group({
    id: 'segments',
    header: 'Segments',
    meta: { kind: 'seg' },
    columns: helper.columns([
      helper.accessor((r) => r.market, {
        id: 'segMarket',
        header: 'Market',
        enableSorting: false,
        size: 120,
        meta: { kind: 'seg', groupKey: 'market' },
        cell: ({ getValue }) => <SegmentCell values={[getValue()]} />,
      }),
      helper.accessor((r) => r.buyer ?? '', {
        id: 'segBuyer',
        header: 'Buyer status',
        enableSorting: false,
        size: 140,
        meta: { kind: 'seg', groupKey: 'buyer' },
        cell: ({ row }) => <SegmentCell values={row.original.buyer ? [row.original.buyer] : []} />,
      }),
      helper.accessor((r) => r.shopper.join(', '), {
        id: 'segShopper',
        header: 'Shopper type',
        enableSorting: false,
        size: 180,
        meta: { kind: 'seg', multi: true },
        cell: ({ row }) => <SegmentCell values={row.original.shopper} />,
      }),
    ]),
  }),
  // Grouped header over every status and screener column, flagged for review.
  helper.group({
    id: 'review',
    header: 'REVIEW THESE DATA - Murilo/Cristina',
    meta: { kind: 'core' },
    columns: helper.columns([
      helper.accessor((r) => r.liveDoc, {
        id: 'live',
        header: 'Live session',
        sortFn: byStatusRank,
        size: 150,
        meta: { kind: 'core' },
        cell: ({ row, getValue }) => <StatusCell value={getValue()} sub={row.original.live.s === 'Completed' ? row.original.live.sub : ''} />,
      }),
      helper.accessor((r) => r.invited, {
        id: 'invited',
        header: 'Invited',
        sortFn: byStatusRank,
        size: 120,
        meta: { kind: 'core' },
        cell: ({ getValue }) => <StatusCell value={getValue()} />,
      }),
      helper.accessor((r) => r.tech, {
        id: 'tech',
        header: 'Tech check',
        sortFn: byStatusRank,
        size: 140,
        meta: { kind: 'core' },
        cell: ({ getValue }) => <StatusCell value={getValue()} />,
      }),
      helper.accessor((r) => r.consent, {
        id: 'consent',
        header: 'Consent form',
        sortFn: byStatusRank,
        size: 140,
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
      helper.accessor((r) => r.prior, {
        id: 'prior',
        header: 'Taken part before',
        sortFn: byStatusRank,
        size: 150,
        meta: { kind: 'core' },
        cell: ({ getValue }) => <span className="cell-main">{getValue()}</span>,
      }),
      helper.accessor((r) => r.fav, {
        id: 'fav',
        header: 'Favorite',
        sortFn: byFavorite,
        size: 100,
        meta: { kind: 'core' },
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="fav" role="img" aria-label="Favorite"><Icon name="star" /></span>
          ) : (
            <span className="cell-dash" aria-label="Not a favorite">—</span>
          ),
      }),
      screenerColumn('usBrands', 'US general', 'Brands bought (last 6 months)', true, (r) => r.brands),
      screenerColumn('usFreq', 'US general', 'How often they buy snacks', false, (r) => (r.freq ? [r.freq] : [])),
      screenerColumn('ukBrands', 'UK general', 'Brands bought (last 6 months)', true, (r) => r.brands),
      screenerColumn('ukFreq', 'UK general', 'How often they buy snacks', false, (r) => (r.freq ? [r.freq] : [])),
    ]),
  }),
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
  { name: 'Standard values', match: (m) => m.kind === 'std' },
  { name: 'Respondent info', match: (m) => m.kind === 'core' },
  { name: 'Segments', match: (m) => m.kind === 'seg' },
  { name: 'Screener: US general', match: (m) => m.kind === 'scr' && m.screener === 'US general' },
  { name: 'Screener: UK general', match: (m) => m.kind === 'scr' && m.screener === 'UK general' },
]
