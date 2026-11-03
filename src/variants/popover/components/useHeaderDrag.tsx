import type { ReactTable } from '@tanstack/react-table'
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Respondent } from '@data/respondents'
import { canMoveColumn, moveColumn, sameZone, type OrderColumn } from '../table/columnOrder'
import type { features } from '../table/respondentsTable'
import { Icon } from './Icon'

type Table = ReactTable<typeof features, Respondent>

/** How far the pointer moves before a press on a header becomes a drag (a shorter one is a click that sorts). */
const DRAG_THRESHOLD = 5
/** How close to the scroll area's edge a drag scrolls the table sideways, and how fast (px per frame). */
const EDGE = 48
const EDGE_STEP = 14
/** The point of the drag label held under the pointer: its grip icon, halfway down (the label is 28px tall). */
const GRIP_X = 13
const GRIP_Y = 14
/** Frames to wait for a move to show up in the table before looking again (a guard; it normally takes one). */
const MAX_WAIT = 10

/**
 * True from the start of a header drag until just after its release: the release fires a click on
 * the header, and that click mustn't sort.
 */
let dragPress = false
export const isHeaderDragClick = () => dragPress

/**
 * Moving a column by dragging its header, like the MUI X Data Grid: press a header and move past a
 * few pixels, and the column moves as you drag. Once the pointer passes the middle of the next
 * header, the two columns swap places right away (header and cells), so the faded header always
 * sits where the column will stay, marked by a colored line in the header row on its edge in the
 * direction of the drag; a small label with the column name is held under the pointer, by its grip. Releasing keeps the
 * new order; Escape, or releasing outside the table, puts the column back where it started.
 * Respondent stays first, and pinned columns move only among the pinned ones (the same rules as
 * "Move left / right"). Near the edges the table scrolls sideways. Mouse and pen only: on touch a
 * header swipe scrolls the table, and the column menu moves columns.
 */
export function useHeaderDrag(table: Table, scrollRef: RefObject<HTMLDivElement | null>, pinnedWidth: number) {
  /** The column being dragged and where its label starts; the label then follows the pointer. */
  const [dragging, setDragging] = useState<{ id: string; label: string; left: number; top: number } | null>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLDivElement>(null)
  const pinned = useRef(pinnedWidth)
  pinned.current = pinnedWidth
  /** Cancels the drag in progress (listeners, animation frame) if the table unmounts. */
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [])

  const headerRect = (id: string) =>
    scrollRef.current?.querySelector(`.thead [data-col="${CSS.escape(id)}"]`)?.getBoundingClientRect()

  const onHeaderPointerDown = (e: PointerEvent<HTMLElement>, column: OrderColumn) => {
    if (e.button !== 0 || e.pointerType === 'touch' || !canMoveColumn(column)) return
    // The menu button and the resize handle do their own thing.
    if ((e.target as Element).closest('.icon-btn, .resize-handle, .checkbox')) return
    const startX = e.clientX
    const pinnedZone = column.getIsPinned() === 'start'
    let x = startX
    let y = e.clientY
    /** Which way the pointer last moved: 1 right, -1 left. */
    let dir = 0
    let active = false
    let frame = 0
    /** After a swap: the index the column should reach, until the table has re-rendered with it. */
    let expected: number | null = null
    let waited = 0
    // The order before the drag, to put back on cancel.
    let orderBefore: string[] = []
    let pinnedBefore: string[] = []

    const tick = () => {
      const scroller = scrollRef.current
      if (scroller) {
        const area = scroller.getBoundingClientRect()
        // Pinned columns never scroll; the rest scroll from the pinned area's edge to the right edge.
        if (!pinnedZone) {
          if (x < area.left + pinned.current + EDGE) scroller.scrollLeft -= EDGE_STEP
          else if (x > area.right - EDGE) scroller.scrollLeft += EDGE_STEP
        }
        if (ghost.current) Object.assign(ghost.current.style, { left: `${x - GRIP_X}px`, top: `${y - GRIP_Y}px` })

        const zone = sameZone(table.getVisibleLeafColumns(), column)
        const at = zone.findIndex((c) => c.id === column.id)
        // A swap shows up once the table re-renders; until then the headers are still in the old order.
        if (expected !== null && at !== expected && ++waited < MAX_WAIT) {
          frame = requestAnimationFrame(tick)
          return
        }
        expected = null
        waited = 0
        // The colored line in the header row: on the column's edge in the direction of the drag
        // (like AG Grid's drop line), kept clear of the pinned area for the other columns.
        const own = headerRect(column.id)
        if (line.current && own) {
          const min = pinnedZone ? area.left : area.left + pinned.current
          const edge = Math.min(Math.max(dir > 0 ? own.right : own.left, min), area.right)
          Object.assign(line.current.style, { display: 'block', left: `${edge - 1}px`, top: `${own.top}px`, height: `${own.height}px` })
        }
        const right = zone[at + 1]
        const left = zone[at - 1]
        const r = right && headerRect(right.id)
        const l = left && headerRect(left.id)
        if (r && x > r.left + r.width / 2) {
          moveColumn(table, column.id, right.id, 'after')
          expected = at + 1
        } else if (l && x < l.left + l.width / 2) {
          moveColumn(table, column.id, left.id, 'before')
          expected = at - 1
        }
      }
      frame = requestAnimationFrame(tick)
    }

    const restore = () => {
      if (pinnedZone) table.setColumnPinning((p) => ({ ...p, start: pinnedBefore }))
      else table.setColumnOrder(orderBefore)
    }

    const onMove = (ev: globalThis.PointerEvent) => {
      if (ev.clientX !== x) dir = ev.clientX > x ? 1 : -1
      x = ev.clientX
      y = ev.clientY
      if (active || Math.abs(x - startX) < DRAG_THRESHOLD) return
      active = true
      dragPress = true
      orderBefore = [...table.state.columnOrder]
      pinnedBefore = [...table.state.columnPinning.start]
      setDragging({ id: column.id, label: String(column.columnDef.header), left: x - GRIP_X, top: y - GRIP_Y })
      frame = requestAnimationFrame(tick)
    }
    const finish = (keep: boolean) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      cancelAnimationFrame(frame)
      stop.current = null
      if (!active) return
      if (!keep) restore()
      setDragging(null)
      // The click that follows the release comes before this timer runs.
      setTimeout(() => (dragPress = false))
    }
    // Released over the table keeps the new order; released elsewhere puts it back.
    const onUp = (ev: globalThis.PointerEvent) => {
      const area = scrollRef.current?.getBoundingClientRect()
      const inside = !area || (ev.clientX >= area.left && ev.clientX <= area.right && ev.clientY >= area.top && ev.clientY <= area.bottom)
      finish(inside)
    }
    const onCancel = () => finish(false)
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !active) return
      ev.preventDefault()
      ev.stopPropagation()
      finish(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
    stop.current = () => finish(false)
  }

  const overlay =
    dragging &&
    createPortal(
      <>
        <div ref={line} className="col-drop-line" aria-hidden="true" />
        <div
          ref={ghost}
          className="col-drag-ghost"
          aria-hidden="true"
          style={{ left: dragging.left, top: dragging.top }}
        >
          <Icon name="dotsSixVertical" small />
          <span className="col-drag-ghost-name">{dragging.label}</span>
        </div>
      </>,
      document.body,
    )

  return { draggingId: dragging?.id ?? null, onHeaderPointerDown, overlay }
}
