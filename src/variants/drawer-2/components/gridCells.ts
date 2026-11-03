import type { KeyboardEvent } from 'react'

/**
 * Cell navigation in the respondents grid, like the MUI X Data Grid: body cells are `.td`
 * elements in the `.tr` rows of `.tbody`, and the focused cell is the selected one.
 */
export type CellMove = 'up' | 'down' | 'left' | 'right' | 'rowStart' | 'rowEnd' | 'first' | 'last'

/** Sent to a cell's `.cell-edit` element to start editing; `detail` is the key pressed, or 'click'. */
export const CELL_START = 'cellstart'

/** Sent to a cell's `.chip-list` (Space) to show or hide every tag when some don't fit. */
export const CELL_PEEK = 'cellpeek'

const cellsOf = (row: Element) => Array.from(row.children).filter((c): c is HTMLElement => c.classList.contains('td'))

/** The cell a move lands on, or null at the grid's edge. */
export function cellFrom(td: Element, move: CellMove): HTMLElement | null {
  const row = td.parentElement!
  const rows = Array.from(row.parentElement!.querySelectorAll(':scope > .tr'))
  const r = rows.indexOf(row)
  const cells = cellsOf(row)
  const c = cells.indexOf(td as HTMLElement)
  const at = (ri: number, ci: number) => (rows[ri] ? (cellsOf(rows[ri])[ci] ?? null) : null)
  switch (move) {
    case 'up': return at(r - 1, c)
    case 'down': return at(r + 1, c)
    case 'left': return cells[c - 1] ?? null
    case 'right': return cells[c + 1] ?? null
    case 'rowStart': return cells[0]
    case 'rowEnd': return cells[cells.length - 1]
    case 'first': return at(0, 0)
    case 'last': return at(rows.length - 1, cellsOf(rows[rows.length - 1]).length - 1)
  }
}

/** Arrow keys move one cell; Home and End go to the row's ends, with Ctrl to the grid's. */
export function cellMove(e: KeyboardEvent): CellMove | null {
  if (e.altKey) return null
  const ctrl = e.ctrlKey || e.metaKey
  switch (e.key) {
    case 'ArrowUp': return 'up'
    case 'ArrowDown': return 'down'
    case 'ArrowLeft': return 'left'
    case 'ArrowRight': return 'right'
    case 'Home': return ctrl ? 'first' : 'rowStart'
    case 'End': return ctrl ? 'last' : 'rowEnd'
    default: return null
  }
}

/** Keys that start editing a cell: Enter, F2, Backspace or Delete (they clear it), a printable key, Alt+↓. */
export function startsEdit(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === 'F2' || e.key === 'Backspace' || e.key === 'Delete') return true
  if (e.altKey && e.key === 'ArrowDown') return true
  return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey
}

/** How an edit ended, and where focus goes next: Enter the cell below, Tab the next cell, Escape stays. */
export type EditEnd = 'enter' | 'tab' | 'shiftTab' | 'escape'

export function focusAfterEdit(td: HTMLElement | null, how: EditEnd) {
  if (!td) return
  const next = how === 'enter' ? cellFrom(td, 'down') : how === 'tab' ? cellFrom(td, 'right') : how === 'shiftTab' ? cellFrom(td, 'left') : null
  ;(next ?? td).focus()
}
