import type { ReactTable } from '@tanstack/react-table'
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type UIEvent } from 'react'
import type { Respondent } from '../data/respondents'
import { SEGMENTS } from '../data/respondents'
import type { RespondentRow, features } from '../table/respondentsTable'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { IconLabel, TruncatedText } from './Tooltip'

type Table = ReactTable<typeof features, Respondent>
type Header = ReturnType<Table['getHeaderGroups']>[number]['headers'][number]

/** Tooltip on segment column names, which otherwise look like any other column. */
const SEGMENT_HINT = 'Segment column · Automatically created from your segments'

function ariaSort(sorted: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  return sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
}

/**
 * Drag handle on a header's end edge (mouse and touch via TanStack's resize handler).
 * Also a focusable window splitter: arrow keys resize by 10px (Shift: 50px), double-click resets.
 */
function ResizeHandle({ table, header }: { table: Table; header: Header }) {
  const column = header.column
  if (!column.getCanResize()) return null
  const { minSize = 0, maxSize = Infinity } = column.columnDef
  const size = column.getSize()
  const label = String(column.columnDef.header)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 50 : 10
    const delta = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
    if (!delta) return
    e.preventDefault()
    table.setColumnSizing((old) => ({ ...old, [column.id]: Math.min(maxSize, Math.max(minSize, size + delta)) }))
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={size}
      aria-valuemin={minSize}
      aria-valuemax={Number.isFinite(maxSize) ? maxSize : undefined}
      tabIndex={0}
      className={column.getIsResizing() ? 'resize-handle is-resizing' : 'resize-handle'}
      title="Drag to resize · double-click to reset"
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onDoubleClick={() => column.resetSize()}
      onKeyDown={onKeyDown}
    />
  )
}

/** The Respondent column: always pinned first, with the row checkboxes. */
const ROW_HEADER_ID = 'respondent'

/** Where a column sticks while scrolling sideways: its offset, and whether it is the last one that sticks. */
type StickyPos = { left: number; edge: boolean }

/**
 * Sticky positions of the pinned columns: Respondent always, then the other pinned columns
 * in order while their total width fits in `limit`. Columns that no longer fit (after a resize
 * or a narrower window) stay pinned but scroll with the table until there is room again.
 */
function stickyPositions(table: Table, limit: number) {
  const positions = new Map<string, StickyPos>()
  let left = 0
  let last: StickyPos | undefined
  for (const column of table.getStartVisibleLeafColumns()) {
    if (column.id !== ROW_HEADER_ID && left + column.getSize() > limit) break
    last = { left, edge: false }
    positions.set(column.id, last)
    left += column.getSize()
  }
  if (last) last.edge = true
  return positions
}

function stickyProps(base: string, sticky: StickyPos | undefined, isRowHeader: boolean) {
  return {
    className: [base, isRowHeader ? 'sticky' : sticky && 'pinned', sticky?.edge && 'pin-edge'].filter(Boolean).join(' '),
    style: sticky && !isRowHeader ? { left: sticky.left } : undefined,
  }
}

/** The sort arrow after a header's title. Unsorted, it shows the next direction (ascending), faded, on hover. */
function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  return (
    <span className="th-sort-icon" aria-hidden="true">
      <Icon name={sorted === 'desc' ? 'arrowDownBold' : 'arrowUpBold'} />
    </span>
  )
}

/**
 * One header cell: sorting, the column menu and resizing. Works like the MUI X Data Grid:
 * a click anywhere on the header sorts (ascending, descending, then unsorted).
 */
function HeaderCell({ table, header, sticky }: { table: Table; header: Header; sticky?: StickyPos }) {
  const meta = table.options.meta!
  const column = header.column
  const colMeta = column.columnDef.meta!
  const sorted = column.getIsSorted()
  const canSort = column.getCanSort()
  const isRowHeader = column.id === ROW_HEADER_ID
  const base = ['th', colMeta.icon && 'th-icon-col', canSort && 'th-sortable', sorted && 'th-sorted'].filter(Boolean).join(' ')
  const cellProps = {
    role: 'columnheader',
    'aria-sort': canSort ? ariaSort(sorted) : undefined,
    ...stickyProps(base, sticky, isRowHeader),
    onClick: canSort
      ? (e: MouseEvent) => {
          // The select-all checkbox, the menu button and the resize handle do their own thing.
          if ((e.target as Element).closest('.checkbox, .icon-btn, .resize-handle')) return
          table.setSorting(sorted === 'desc' ? [] : [{ id: column.id, desc: sorted === 'asc' }])
        }
      : undefined,
  }

  if (isRowHeader) {
    return (
      <div {...cellProps}>
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label="Select all shown respondents"
        />
        {/* No click handler of its own: the click reaches the header's. */}
        <button type="button" className="th-label">
          <span className="th-text">
            <table.FlexRender header={header} />
            <SortIcon sorted={sorted} />
          </span>
        </button>
        <ResizeHandle table={table} header={header} />
      </div>
    )
  }

  const menuOpen = meta.menu?.type === 'col' && meta.menu.id === column.id
  const text = (
    <span className="th-text">
      {column.getIsPinned() && (
        <IconLabel className="th-pin" label="Pinned column"><Icon name="pin" small /></IconLabel>
      )}
      {colMeta.icon ? (
        <IconLabel className="th-icon" label={String(column.columnDef.header)}><Icon name={colMeta.icon} /></IconLabel>
      ) : (
        <TruncatedText className="th-name" hint={colMeta.kind === 'seg' ? SEGMENT_HINT : undefined}>
          <table.FlexRender header={header} />
        </TruncatedText>
      )}
      {colMeta.kind === 'seg' && <span className="sr-only">{SEGMENT_HINT}</span>}
      {canSort && <SortIcon sorted={sorted} />}
    </span>
  )
  return (
    <div {...cellProps}>
      {canSort ? (
        <button type="button" className="th-label">{text}</button>
      ) : (
        <span className="th-label">{text}</span>
      )}
      {colMeta.pii && <span className="th-pii" title="Personally identifiable information">PII</span>}
      <button
        type="button"
        className="icon-btn th-menu"
        data-menu-anchor={`col:${column.id}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Column options: ${String(column.columnDef.header)}`}
        onClick={() => meta.onToggleMenu({ type: 'col', id: column.id })}
      >
        <Icon name="dotsVerticalBold" />
      </button>
      <ResizeHandle table={table} header={header} />
    </div>
  )
}

function groupLabel(row: RespondentRow) {
  const value = String(row.groupingValue)
  const segment = SEGMENTS.find((s) => s.key === row.groupingColumnId)
  if (segment) return `${segment.label}: ${row.groupingValue === undefined ? 'not set' : value}`
  return value
}

/**
 * `pinLimit` is the most width pinned columns may take; `onWidthChange` reports the visible
 * width of the scroll area. `onScrolledChange` reports whether the table is scrolled away from its top.
 */
export function RespondentsTable({
  table,
  pinLimit,
  onWidthChange,
  onScrolledChange,
}: {
  table: Table
  pinLimit: number
  onWidthChange?: (width: number) => void
  onScrolledChange?: (scrolled: boolean) => void
}) {
  const meta = table.options.meta!
  const scrollRef = useRef<HTMLDivElement>(null)
  // Hysteresis: "scrolled" once past 24px, back only at the very top, so small moves near
  // the top don't flip it back and forth.
  const scrolled = useRef(false)
  /** Scrolled sideways: the edge of the pinned area shows a shadow. */
  const [scrolledX, setScrolledX] = useState(false)
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const x = e.currentTarget.scrollLeft > 0
    if (x !== scrolledX) setScrolledX(x)
    const top = e.currentTarget.scrollTop
    const next = scrolled.current ? top >= 1 : top > 24
    if (next === scrolled.current) return
    scrolled.current = next
    onScrolledChange?.(next)
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !onWidthChange) return
    const observer = new ResizeObserver(() => onWidthChange(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [onWidthChange])

  // Headers and cells come in pinning order (pinned columns first), so the grid tracks follow the headers.
  const headers = table.getHeaderGroups()[0].headers
  const sticky = stickyPositions(table, pinLimit)
  // Column widths come from TanStack sizing state. A trailing 1fr track fills any
  // leftover width, so the table still spans the card when columns are narrow.
  const tableStyle = {
    '--grid-cols': `${headers.map((h) => `${h.column.getSize()}px`).join(' ')} minmax(0, 1fr)`,
    minWidth: `${table.getTotalSize()}px`,
  } as CSSProperties
  const rows = table.getRowModel().rows
  const leafRows = table.getFilteredRowModel().rows
  const isResizing = table.state.columnResizing.isResizingColumn !== false

  return (
    <div ref={scrollRef} className="table-scroll" onScroll={onScroll}>
      <div
        role="table"
        className={['tbl', isResizing && 'is-resizing', scrolledX && 'is-scrolled-x'].filter(Boolean).join(' ')}
        aria-labelledby="list-h"
        style={tableStyle}
      >
        <div role="rowgroup" className="thead-group">
          {/* Columns are not grouped, so there is a single header row. */}
          <div role="row" className="tr thead">
            {headers.map((header) => (
              <HeaderCell key={header.id} table={table} header={header} sticky={sticky.get(header.column.id)} />
            ))}
          </div>
        </div>

        <div role="rowgroup" className="tbody">
          {leafRows.length === 0 && (
            <div className="empty" role="row">
              <span role="cell">No sample respondents match these filters.</span>
            </div>
          )}
          {rows.map((row) =>
            row.getIsGrouped() ? (
              <div key={row.id} role="row" className="group-row">
                <span role="cell">{groupLabel(row)} · {row.subRows.length} shown</span>
              </div>
            ) : (
              <div
                key={row.id}
                role="row"
                className={['tr', row.id === meta.selectedId && 'is-selected', row.getIsSelected() && 'is-picked'].filter(Boolean).join(' ')}
                aria-selected={row.id === meta.selectedId || undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const isRowHeader = cell.column.id === ROW_HEADER_ID
                  return (
                    <div
                      key={cell.id}
                      role={isRowHeader ? 'rowheader' : 'cell'}
                      {...stickyProps('td', sticky.get(cell.column.id), isRowHeader)}
                    >
                      <table.FlexRender cell={cell} />
                    </div>
                  )
                })}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
