import type { ReactTable } from '@tanstack/react-table'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Respondent } from '@data/respondents'
import {
  canMoveColumn,
  isColumnOrderChanged,
  moveColumn,
  orderedColumns,
  resetColumnOrder,
  sameZone,
  type OrderColumn,
} from '../table/columnOrder'
import type { features } from '../table/respondentsTable'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { Tag } from './Tag'
import { TruncatedText } from './Tooltip'

type Table = ReactTable<typeof features, Respondent>
type Drop = { id: string; place: 'before' | 'after' }

/** How close to the panel's top or bottom edge a drag scrolls it, and by how much per move. */
const EDGE = 32
const EDGE_STEP = 12

const nameOf = (c: OrderColumn) => String(c.columnDef.header)

/**
 * The Columns panel, like the MUI X Data Grid's: one row per column in table order. The checkbox
 * shows or hides the column; the handle drags it to a new place (mouse or touch), or moves it one
 * place with the up and down arrows. Pinned columns reorder among themselves only.
 */
export function ColumnsPanel({ table }: { table: Table }) {
  const listRef = useRef<HTMLUListElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<Drop | null>(null)
  const [announce, setAnnounce] = useState('')
  const columns = orderedColumns(table)

  const focusHandle = (id: string) =>
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-col="${id}"] .col-drag`)?.focus())

  /** Where a drag at height `y` would drop `column`: before the first row of its zone below the pointer's middle, else after the last. */
  const dropAt = (column: OrderColumn, y: number): Drop | null => {
    const zone = sameZone(columns, column)
    if (zone.length < 2) return null
    for (const c of zone) {
      const rect = listRef.current?.querySelector(`[data-col="${c.id}"]`)?.getBoundingClientRect()
      if (rect && y < rect.top + rect.height / 2) return { id: c.id, place: 'before' }
    }
    return { id: zone[zone.length - 1].id, place: 'after' }
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, column: OrderColumn) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragId(column.id)
    setDrop(null)
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>, column: OrderColumn) => {
    if (dragId !== column.id) return
    const panel = listRef.current?.closest<HTMLElement>('.panel')
    if (panel) {
      const { top, bottom } = panel.getBoundingClientRect()
      if (e.clientY < top + EDGE) panel.scrollTop -= EDGE_STEP
      else if (e.clientY > bottom - EDGE) panel.scrollTop += EDGE_STEP
    }
    setDrop(dropAt(column, e.clientY))
  }
  const endDrag = (commit: boolean) => {
    if (commit && dragId && drop) moveColumn(table, dragId, drop.id, drop.place)
    setDragId(null)
    setDrop(null)
  }

  const onHandleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, column: OrderColumn) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const zone = sameZone(columns, column)
    const at = zone.findIndex((c) => c.id === column.id)
    const up = e.key === 'ArrowUp'
    const target = zone[at + (up ? -1 : 1)]
    if (!target) return
    moveColumn(table, column.id, target.id, up ? 'before' : 'after')
    setAnnounce(`${nameOf(column)} moved to position ${at + (up ? 0 : 2)} of ${zone.length}`)
    // The row moves in the list; keep focus on its handle.
    focusHandle(column.id)
  }

  return (
    <div className="panel" role="dialog" aria-label="Columns" id="panel-cols">
      <span className="sheet-handle" aria-hidden="true" />
      <div className="panel-head">
        <p className="panel-title">Columns</p>
        {isColumnOrderChanged(table) && (
          <button type="button" className="btn-link muted" onClick={() => resetColumnOrder(table)}>
            Reset order
          </button>
        )}
      </div>
      <span className="sr-only" role="status">{announce}</span>
      <ul ref={listRef} className={dragId ? 'col-list is-dragging' : 'col-list'} aria-label="Show and order columns">
        {columns.map((c) => {
          const name = nameOf(c)
          const pinned = c.getIsPinned() === 'start'
          return (
            <li
              key={c.id}
              data-col={c.id}
              className={['col-row', dragId === c.id && 'is-dragged', drop?.id === c.id && `drop-${drop.place}`].filter(Boolean).join(' ')}
            >
              {canMoveColumn(c) ? (
                <button
                  type="button"
                  className="icon-btn col-drag"
                  aria-label={`Move ${name}`}
                  aria-description="Drag, or use the up and down arrow keys, to change where this column sits"
                  title="Drag to reorder"
                  onPointerDown={(e) => onPointerDown(e, c)}
                  onPointerMove={(e) => onPointerMove(e, c)}
                  onPointerUp={() => endDrag(true)}
                  onPointerCancel={() => endDrag(false)}
                  onKeyDown={(e) => onHandleKeyDown(e, c)}
                >
                  <Icon name="dotsSixVertical" />
                </button>
              ) : (
                <span className="col-drag col-locked" title="Always the first column">
                  <Icon name="lock" small />
                </span>
              )}
              <label className="check-row">
                <Checkbox checked={c.getIsVisible()} disabled={!c.getCanHide()} onChange={c.getToggleVisibilityHandler()} />
                {/* Long names wrap to two lines; the full name shows on hover when cut off. */}
                <TruncatedText className="col-name">{name}</TruncatedText>
                {/* Standard values and segments look alike otherwise, now that the list follows table order. */}
                {c.columnDef.meta!.kind === 'seg' && <Tag>Segment</Tag>}
                {pinned && c.getCanPin() && (
                  <span className="col-pin" title="Pinned column">
                    <Icon name="pin" small />
                    <span className="sr-only">Pinned</span>
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
