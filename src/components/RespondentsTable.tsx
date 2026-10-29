import type { ReactTable } from '@tanstack/react-table'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Respondent } from '../data/respondents'
import { viaLabel, type Via } from '../data/respondents'
import type { RespondentRow, features } from '../table/respondentsTable'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { Tag } from './Tag'
import { TruncatedText } from './Tooltip'

type Table = ReactTable<typeof features, Respondent>
type Header = ReturnType<Table['getHeaderGroups']>[number]['headers'][number]

function ariaSort(sorted: false | 'asc' | 'desc') {
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

/**
 * One header cell, placed on the header grid by its column and row span.
 * Group headers (e.g. "Segments") only show their label; leaf headers keep sorting,
 * the column menu and resizing. An ungrouped column's cell spans every header row.
 */
function HeaderCell({ table, header, row, col }: { table: Table; header: Header; row: number; col: number }) {
  const meta = table.options.meta!
  const column = header.column
  const colMeta = column.columnDef.meta!
  const sorted = column.getIsSorted()
  const cellProps = {
    role: 'columnheader',
    style: { gridColumn: `${col} / span ${header.colSpan}`, gridRow: `${row} / span ${header.rowSpan}` },
    'aria-colspan': header.colSpan > 1 ? header.colSpan : undefined,
    'aria-rowspan': header.rowSpan > 1 ? header.rowSpan : undefined,
  }

  if (header.subHeaders.length > 0 && !header.isPlaceholder) {
    return (
      <div {...cellProps} className="th th-group">
        <TruncatedText className="th-name"><table.FlexRender header={header} /></TruncatedText>
      </div>
    )
  }

  if (column.getIsPinned() === 'start') {
    return (
      <div {...cellProps} className="th sticky" aria-sort={ariaSort(sorted)}>
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label="Select all shown respondents"
        />
        <button
          type="button"
          className="sort-btn"
          onClick={() => table.setSorting([{ id: column.id, desc: sorted === 'asc' }])}
        >
          <table.FlexRender header={header} />
          {sorted && <Icon name={sorted === 'asc' ? 'caretUp' : 'caretDown'} small />}
        </button>
        <ResizeHandle table={table} header={header} />
      </div>
    )
  }

  const menuOpen = meta.menu?.type === 'col' && meta.menu.id === column.id
  return (
    <div
      {...cellProps}
      className={['th', colMeta.kind === 'scr' && 'scr', column.parent && 'th-sub'].filter(Boolean).join(' ')}
      aria-sort={column.getCanSort() ? ariaSort(sorted) : undefined}
    >
      <span className="th-label">
        {colMeta.screener && <Tag variant="feature">{colMeta.screener}</Tag>}
        <span className="th-text">
          <TruncatedText className="th-name"><table.FlexRender header={header} /></TruncatedText>
          {sorted && <Icon name={sorted === 'asc' ? 'caretUp' : 'caretDown'} small />}
        </span>
      </span>
      {colMeta.pii && <span className="th-pii" title="Personally identifiable information">PII</span>}
      <button
        type="button"
        className="icon-btn"
        data-menu-anchor={`col:${column.id}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Column options: ${String(column.columnDef.header)}`}
        onClick={() => meta.onToggleMenu({ type: 'col', id: column.id })}
      >
        <Icon name="caretDown" />
      </button>
      <ResizeHandle table={table} header={header} />
    </div>
  )
}

function groupLabel(row: RespondentRow) {
  const value = String(row.groupingValue)
  if (row.groupingColumnId === 'market') return `Market: ${value}`
  if (row.groupingColumnId === 'buyer' && row.groupingValue === undefined) return 'Buyer status: not set'
  if (row.groupingColumnId === 'via') return viaLabel(value as Via)
  return value
}

/** `onScrolledChange` reports whether the table is scrolled away from its top. */
export function RespondentsTable({ table, onScrolledChange }: { table: Table; onScrolledChange?: (scrolled: boolean) => void }) {
  const meta = table.options.meta!
  // Column widths come from TanStack sizing state. A trailing 1fr track fills any
  // leftover width, so the table still spans the card when columns are narrow.
  const tableStyle = {
    '--grid-cols': `${table.getVisibleLeafColumns().map((c) => `${c.getSize()}px`).join(' ')} minmax(0, 1fr)`,
    minWidth: `${table.getTotalSize()}px`,
  } as CSSProperties
  const rows = table.getRowModel().rows
  const leafRows = table.getFilteredRowModel().rows
  const isResizing = table.state.columnResizing.isResizingColumn !== false

  return (
    <div className="table-scroll" onScroll={(e) => onScrolledChange?.(e.currentTarget.scrollTop > 8)}>
      <div role="table" className={isResizing ? 'tbl is-resizing' : 'tbl'} aria-labelledby="list-h" style={tableStyle}>
        <div role="rowgroup" className="thead-group">
          {/* All header rows share one grid (rows use display: contents), so a group
              header can span its columns and an ungrouped header can span both rows. */}
          <div className="tr thead">
            {table.getHeaderGroups().map((headerGroup, rowIndex) => {
              let col = 1
              return (
                <div key={headerGroup.id} role="row" className="thead-row">
                  {headerGroup.headers.map((header) => {
                    const start = col
                    col += header.colSpan
                    // rowSpan 0: covered by the taller cell of an ungrouped column above.
                    if (header.rowSpan === 0) return null
                    return <HeaderCell key={header.id} table={table} header={header} row={rowIndex + 1} col={start} />
                  })}
                </div>
              )
            })}
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
                  const colMeta = cell.column.columnDef.meta!
                  const pinned = cell.column.getIsPinned() === 'start'
                  return (
                    <div
                      key={cell.id}
                      role={pinned ? 'rowheader' : 'cell'}
                      className={['td', pinned && 'sticky', colMeta.kind === 'scr' && 'scr'].filter(Boolean).join(' ')}
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
