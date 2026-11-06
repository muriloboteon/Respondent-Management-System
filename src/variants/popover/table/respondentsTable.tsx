import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  metaHelper,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type Row,
  type SortFn,
} from '@tanstack/react-table'
import { useEffect, useRef } from 'react'
import { Checkbox } from '../components/Checkbox'
import { EditableOptions, EditableText, useInlineEdit, type TextRule } from '../components/EditableCell'
import { Icon, type IconName } from '../components/Icon'
import { Tag } from '../components/Tag'
import { TagList } from '../components/TagList'
import { IconButton, IconLabel } from '../components/Tooltip'
import {
  INTERVIEW_ROLES,
  INTERVIEW_SESSIONS,
  SEGMENTS,
  SORT_ORDER,
  canEditContact,
  initialsFor,
  interviewSession,
  limitPII,
  priorInterviewDate,
  selfCaptures,
  sourceLabel,
  type Respondent,
  type SegmentDef,
} from '@data/respondents'
import { allTimezones, timezoneDescription, timezoneInfo, timezoneSearchText } from '@data/timezones'
import { matchesFilters, type Filters } from '../filters/filters'

export interface RespondentColumnMeta {
  kind: 'int' | 'std' | 'core' | 'seg'
  /** The header shows this icon, with the column name in a tooltip. */
  icon?: IconName
  /** Personal data: the header shows a "PII" marker. */
  pii?: boolean
}

/** The open menu: a row's actions, a column's options, or a cell's "Filter by" (row id plus column id). */
export type MenuState = { type: 'row' | 'col'; id: string } | { type: 'cell'; id: string; col: string } | null

/** What a respondent's row can open in a dialog: the self captures list, or the tech check. */
export type RecordingKind = 'self' | 'tech'

/** Pinned columns may take up to this share of the table's visible width. */
export const PINNED_WIDTH_SHARE = 0.5

export interface RespondentTableMeta {
  selectedId: string | null
  /** Respondents added in this session (shown with a "New" tag). */
  newIds: ReadonlySet<string>
  menu: MenuState
  /** "Rename" was picked in this row's menu: its name turns into a text field. */
  renamingId: string | null
  /** The name field opened, so the rename request is done. */
  onRenameStarted: () => void
  onOpen: (id: string) => void
  onToggleMenu: (menu: NonNullable<MenuState>) => void
  /** Right-click on a cell: opens its "Filter by" menu; false when the cell has nothing to filter by. */
  onCellMenu: (rowId: string, columnId: string) => boolean
  /** Saves an inline cell edit. */
  onUpdate: (id: string, patch: Partial<Respondent>) => void
  /** Opens a respondent's self captures list or tech check dialog. */
  onPlay: (id: string, kind: RecordingKind) => void
}

export const features = tableFeatures({
  columnVisibilityFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  columnMeta: metaHelper<RespondentColumnMeta>(),
  tableMeta: metaHelper<RespondentTableMeta>(),
})

export type RespondentRow = Row<typeof features, Respondent>

/* ---------- Sorting: ascending comparators, Table reverses for desc ---------- */

// Missing values sort after every value.
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
/**
 * Email and phone sort by the stored value, not what the cell shows: respondents without contact
 * details come last, and hidden PII doesn't sort at all (its order would give the values away).
 * Phones compare by their digits, so "+1 555 0101" and "+15550101" sit together.
 */
const contactValue = (row: RespondentRow, field: 'email' | 'phone') =>
  row.original.src === 'rio' || limitPII ? undefined : row.original[field]
const byEmail: SortFn<typeof features, Respondent> = (a, b) =>
  compareDefined(contactValue(a, 'email'), contactValue(b, 'email'), (x: string, y: string) =>
    x.toLowerCase().localeCompare(y.toLowerCase()),
  )
const byPhone: SortFn<typeof features, Respondent> = (a, b) =>
  compareDefined(contactValue(a, 'phone'), contactValue(b, 'phone'), (x: string, y: string) =>
    x.replace(/\D/g, '').localeCompare(y.replace(/\D/g, ''), undefined, { numeric: true }),
  )
/**
 * Segments sort in their options' order (age bands young to old, frequency daily to never),
 * not alphabetically. Multi-choice values compare choice by choice in that order; empty last.
 */
function bySegment(def: SegmentDef): SortFn<typeof features, Respondent> {
  const ranks = (r: Respondent) => {
    const values = r.segments[def.key] ?? []
    return values.length ? values.map((v) => def.options.indexOf(v)).sort((x, y) => x - y) : undefined
  }
  return (a, b) =>
    compareDefined(ranks(a.original), ranks(b.original), (x: number[], y: number[]) => {
      for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i]
      return x.length - y.length
    })
}

/** Global filter: every structured filter plus the multi-term search. */
export function respondentFilter(row: RespondentRow, _columnId: string, filters: Filters) {
  return matchesFilters(row.original, filters)
}

/* ---------- Cells ---------- */

function SegmentCell({ values }: { values: readonly string[] }) {
  if (!values.length) return <span className="cell-dash">—</span>
  return <TagList values={values} />
}

/* Limits on the text typed into cells. A value that breaks one shows an error and isn't saved. */
const NAME_RULE: TextRule = { label: 'Name', max: 100, required: true }
const EMAIL_RULE: TextRule = {
  label: 'Email',
  // The longest address mail servers accept
  max: 254,
  check: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter an email like name@example.com.'),
}
const PHONE_RULE: TextRule = {
  label: 'Phone',
  max: 20,
  check: (v) => (/^[\d\s+()-]+$/.test(v) ? null : 'Use only digits, spaces, +, - and parentheses.'),
}

/**
 * Checkbox, name and row actions. The name opens the detail panel; "Rename" in the ⋮ menu
 * swaps it for a text field, and focus returns to the ⋮ after. An empty or too long name
 * shows an error and isn't saved.
 */
function RespondentCell({ row, meta }: { row: RespondentRow; meta: RespondentTableMeta }) {
  const r = row.original
  const menuOpen = meta.menu?.type === 'row' && meta.menu.id === r.id
  const menuBtn = useRef<HTMLButtonElement>(null)
  const { start, inputProps, hint } = useInlineEdit(
    r.name,
    (next) => next && meta.onUpdate(r.id, { name: next, initials: initialsFor(next) }),
    () => menuBtn.current?.focus(),
    NAME_RULE,
  )
  const renameRequested = meta.renamingId === r.id
  useEffect(() => {
    if (!renameRequested) return
    start()
    meta.onRenameStarted()
  }, [renameRequested])
  return (
    <>
      <Checkbox
        tabIndex={-1}
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        aria-label={`Select ${r.name}`}
      />
      <span className="who">
        {inputProps ? (
          <>
            <input {...inputProps} type="text" aria-label={`Name of ${r.name}`} />
            {hint}
          </>
        ) : (
          <>
            <button
              type="button"
              tabIndex={-1}
              className="who-name"
              data-opener={r.id}
              onClick={() => meta.onOpen(r.id)}
            >
              {r.name}
            </button>
            {meta.newIds.has(r.id) && <Tag variant="feature">New</Tag>}
          </>
        )}
      </span>
      <button
        ref={menuBtn}
        type="button"
        tabIndex={-1}
        className="icon-btn row-menu"
        data-menu-anchor={`row:${r.id}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Actions for ${r.name}`}
        onClick={() => meta.onToggleMenu({ type: 'row', id: r.id })}
      >
        <Icon name="dotsVerticalBold" />
      </button>
    </>
  )
}

/** Outlined like the header icons; the filled version shows while the button is hovered or focused. */
function MediaIcon({ rest, hover }: { rest: IconName; hover: IconName }) {
  return (
    <>
      <span className="media-rest"><Icon name={rest} /></span>
      <span className="media-hover"><Icon name={hover} /></span>
    </>
  )
}

/** Self captures: an icon once the respondent has completed one; it opens their self captures list. */
function SelfCaptureCell({ r, meta }: { r: Respondent; meta: RespondentTableMeta }) {
  const captures = selfCaptures(r)
  if (!captures.length) return null
  const tip = captures.length === 1 ? `Async activity completed ${captures[0].completedOn}`.trim() : `${captures.length} async activities completed`
  return (
    <IconButton
      className="media-btn"
      tabIndex={-1}
      label={`Open async activities for ${r.name} (${tip})`}
      tip={tip}
      onClick={() => meta.onPlay(r.id, 'self')}
    >
      <MediaIcon rest="videoCamera" hover="videoCameraFill" />
    </IconButton>
  )
}

/** Tech check: a play icon once the check is recorded; it opens the tech check dialog. */
function TechCheckCell({ r, meta }: { r: Respondent; meta: RespondentTableMeta }) {
  if (r.tech !== 'Completed') return null
  return (
    <IconButton
      className="media-btn"
      tabIndex={-1}
      label={`Open tech check for ${r.name}`}
      tip="Tech check: Completed"
      onClick={() => meta.onPlay(r.id, 'tech')}
    >
      <MediaIcon rest="playCircle" hover="playCircleFill" />
    </IconButton>
  )
}

/* ---------- Columns ---------- */

const helper = createColumnHelper<typeof features, Respondent>()

/** Segments with more values than this get a search field in the cell menu, over a scrolling list. */
const SEGMENT_SEARCH_FROM = 8

/** One column per segment, e.g. "segAge"; values are edited in the cell. */
function segmentColumn(def: SegmentDef) {
  const id = `seg${def.key.charAt(0).toUpperCase()}${def.key.slice(1)}`
  return helper.accessor((r) => (r.segments[def.key] ?? []).join(', '), {
    id,
    header: def.label,
    sortFn: bySegment(def),
    size: def.size,
    meta: { kind: 'seg' },
    cell: ({ row, table }) => {
      const r = row.original
      const values = r.segments[def.key] ?? []
      return (
        <EditableOptions
          label={`${def.label} for ${r.name}`}
          anchorKey={`cell:${row.id}:${id}`}
          value={values}
          options={def.options}
          search={def.options.length > SEGMENT_SEARCH_FROM ? { label: `Search ${def.label}` } : undefined}
          multi={def.multi}
          emptyLabel={def.multi ? undefined : 'Not set'}
          onCommit={(next) => table.options.meta!.onUpdate(row.id, { segments: { ...r.segments, [def.key]: next.filter(Boolean) } })}
        >
          <SegmentCell values={values} />
        </EditableOptions>
      )
    },
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
      rule={field === 'email' ? EMAIL_RULE : PHONE_RULE}
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

/** Favorite: a star toggled straight from the cell, outlined until it is set. */
function FavoriteCell({ r, meta }: { r: Respondent; meta: RespondentTableMeta }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={r.fav ? 'fav-toggle is-on' : 'fav-toggle'}
      aria-pressed={r.fav}
      aria-label={`Favorite ${r.name}`}
      onClick={() => meta.onUpdate(r.id, { fav: !r.fav })}
    >
      <Icon name={r.fav ? 'star' : 'starOutline'} />
    </button>
  )
}

/**
 * Width of every icon-header column, the table's minimum column width. The header icon sits
 * 3px left of center here: centering it exactly takes 96px (see .th-icon-col).
 */
const ICON_COLUMN_SIZE = 90

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
    header: 'Async activities',
    sortFn: byStatusRank,
    size: ICON_COLUMN_SIZE,
    meta: { kind: 'int', icon: 'videoCamera' },
    cell: ({ row, table }) => <SelfCaptureCell r={row.original} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => r.tech, {
    id: 'tech',
    header: 'Tech check',
    sortFn: byStatusRank,
    size: ICON_COLUMN_SIZE,
    meta: { kind: 'int', icon: 'monitorCheck' },
    cell: ({ row, table }) => <TechCheckCell r={row.original} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => r.consent, {
    id: 'consent',
    header: 'Consent form',
    sortFn: byStatusRank,
    size: ICON_COLUMN_SIZE,
    meta: { kind: 'int', icon: 'formCheck' },
    // Empty for now: the cells will show an icon once it is chosen. Sorting and filters still use the status.
    cell: () => null,
  }),
  helper.accessor((r) => r.prior, {
    id: 'prior',
    header: 'Repeat Respondent',
    sortFn: byStatusRank,
    size: ICON_COLUMN_SIZE,
    meta: { kind: 'int', icon: 'repeat' },
    // An icon on repeat respondents only; the others stay empty. Hovering says when they were interviewed before.
    cell: ({ row, getValue }) => {
      if (getValue() !== 'Yes') return null
      const date = priorInterviewDate(row.original)
      return (
        <IconLabel
          className="cell-icon"
          label="Repeat respondent"
          icon="repeat"
          detail={date ? `This email matches a person we interviewed on ${date}.` : 'This person has taken part in an earlier study.'}
        >
          <Icon name="repeat" />
        </IconLabel>
      )
    },
  }),
  helper.accessor((r) => r.fav, {
    id: 'fav',
    header: 'Favorite',
    sortFn: byFavorite,
    size: ICON_COLUMN_SIZE,
    meta: { kind: 'int', icon: 'starOutline' },
    cell: ({ row, table }) => <FavoriteCell r={row.original} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => (r.src === 'rio' ? '—' : limitPII ? 'Hidden' : (r.email ?? '—')), {
    id: 'email',
    header: 'Email',
    sortFn: byEmail,
    size: 240,
    meta: { kind: 'std', pii: true },
    cell: ({ row, table, getValue }) => <ContactCell r={row.original} field="email" shown={getValue()} meta={table.options.meta!} />,
  }),
  helper.accessor((r) => (r.src === 'rio' ? '—' : limitPII ? 'Hidden' : (r.phone ?? '—')), {
    id: 'phone',
    header: 'Phone',
    sortFn: byPhone,
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
  ...SEGMENTS.map(segmentColumn),
])
