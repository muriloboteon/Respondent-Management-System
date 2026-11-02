import type { ReactTable } from '@tanstack/react-table'
import { useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type UIEvent } from 'react'
import type { Respondent } from '../data/respondents'
import type { features } from '../table/respondentsTable'
import { Checkbox } from './Checkbox'
import { CELL_PEEK, CELL_START, cellFrom, cellMove, startsEdit } from './gridCells'
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
 * True from a press on a resize handle until just after the button is released. A drag that
 * ends over the same header fires a click on the header (the closest element holding both the
 * press and the release), and that click mustn't sort.
 */
let resizePress = false
function startResizePress() {
  resizePress = true
  const end = () => {
    window.removeEventListener('mouseup', end, true)
    window.removeEventListener('touchend', end, true)
    window.removeEventListener('touchcancel', end, true)
    // The click comes right after the release, before this timer runs.
    setTimeout(() => (resizePress = false))
  }
  window.addEventListener('mouseup', end, true)
  window.addEventListener('touchend', end, true)
  window.addEventListener('touchcancel', end, true)
}

/**
 * Drag handle on a header's end edge (mouse and touch via TanStack's resize handler).
 * Also a focusable window splitter: arrow keys resize by 10px (Shift: 50px), double-click resets.
 */
function ResizeHandle({ table, header }: { table: Table; header: Header }) {
  const column = header.column
  if (!column.getCanResize()) return null
  const resizeHandler = header.getResizeHandler()
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
      onMouseDown={(e) => {
        startResizePress()
        resizeHandler(e)
      }}
      onTouchStart={(e) => {
        startResizePress()
        resizeHandler(e)
      }}
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
      ? (e: MouseEvent<HTMLElement>) => {
          // The select-all checkbox, the menu button and the resize handle do their own thing,
          // and the end of a resize drag isn't a click on the header.
          if (resizePress || (e.target as Element).closest('.checkbox, .icon-btn, .resize-handle')) return
          // The third click removes the sort. The hover preview (the next direction, ascending)
          // stays hidden until the pointer or focus leaves, or the arrow would look like a sort.
          if (sorted === 'desc') e.currentTarget.dataset.unsorted = ''
          else delete e.currentTarget.dataset.unsorted
          table.setSorting(sorted === 'desc' ? [] : [{ id: column.id, desc: sorted === 'asc' }])
        }
      : undefined,
    onMouseLeave: canSort ? (e: MouseEvent<HTMLElement>) => delete e.currentTarget.dataset.unsorted : undefined,
    onBlur: canSort ? (e: FocusEvent<HTMLElement>) => delete e.currentTarget.dataset.unsorted : undefined,
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

/**
 * Keys on a body cell, like the MUI X Data Grid: the arrows, Home and End move between cells;
 * Enter, F2 or typing starts editing an editable cell. Space shows every tag of a cell whose tags
 * don't all fit. On other cells Enter and Space press the cell's button; in the Respondent cell Enter opens the respondent, Space picks the row and
 * Shift+F10 (or the menu key) opens the row actions.
 */
function onCellKeyDown(e: KeyboardEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement
  const td = target.closest<HTMLElement>('.td[data-row]')
  // Text fields and the cell menus (portals, outside the cell) handle their own keys.
  if (!td || target.matches('input:not([type="checkbox"])')) return
  const onCell = target === td
  const editor = td.querySelector<HTMLElement>(':scope > .cell-edit')
  if (editor && onCell && startsEdit(e)) {
    e.preventDefault()
    editor.dispatchEvent(new CustomEvent(CELL_START, { detail: e.key }))
    return
  }
  const move = cellMove(e)
  if (move) {
    e.preventDefault()
    cellFrom(td, move)?.focus()
    return
  }
  // A button inside the cell has focus after a click: Enter and Space work on it as usual.
  if (!onCell) return
  const press = (selector: string) => {
    e.preventDefault()
    td.querySelector<HTMLElement>(selector)?.click()
  }
  const tags = td.querySelector<HTMLElement>('.chip-list[data-overflow]')
  if (td.classList.contains('sticky')) {
    if (e.key === 'Enter') press('.who-name')
    else if (e.key === ' ') press('.checkbox input')
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) press('.row-menu')
  } else if (e.key === ' ' && tags) {
    // Tags that don't all fit: Space shows every one, like the MUI X Data Grid's multi-select cells.
    e.preventDefault()
    tags.dispatchEvent(new CustomEvent(CELL_PEEK))
  } else if (e.key === 'Enter' || e.key === ' ') {
    press('button')
  }
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
  const isResizing = table.state.columnResizing.isResizingColumn !== false

  // The grid is one Tab stop: the last focused cell, or the first cell when that one is gone.
  const [active, setActive] = useState<{ row: string; col: string } | null>(null)
  const activeShown =
    active && rows.some((row) => row.id === active.row) && headers.some((h) => h.column.id === active.col)
  const tabStop = activeShown ? active : rows[0] && { row: rows[0].id, col: headers[0].column.id }
  const onCellFocus = (e: FocusEvent<HTMLDivElement>) => {
    const td = (e.target as Element).closest<HTMLElement>('.td[data-row]')
    if (!td) return
    const { row, col } = td.dataset as { row: string; col: string }
    if (row !== active?.row || col !== active?.col) setActive({ row, col })
  }
  // Cells reached with the keyboard scroll clear of the pinned columns
  const pinnedWidth = headers.reduce((w, h) => {
    const pos = sticky.get(h.column.id)
    return pos ? Math.max(w, pos.left + h.column.getSize()) : w
  }, 0)

  return (
    <div ref={scrollRef} className="table-scroll" style={{ scrollPaddingLeft: pinnedWidth }} onScroll={onScroll}>
      <div
        role="grid"
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

        <div role="rowgroup" className="tbody" onFocus={onCellFocus} onKeyDown={onCellKeyDown}>
          {rows.length === 0 && (
            <div className="empty" role="row">
              <span role="gridcell">No sample respondents match these filters.</span>
            </div>
          )}
          {rows.map((row) => (
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
                    role={isRowHeader ? 'rowheader' : 'gridcell'}
                    data-row={row.id}
                    data-col={cell.column.id}
                    tabIndex={tabStop && tabStop.row === row.id && tabStop.col === cell.column.id ? 0 : -1}
                    {...stickyProps('td', sticky.get(cell.column.id), isRowHeader)}
                  >
                    <table.FlexRender cell={cell} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
