import type { ReactTable } from '@tanstack/react-table'
import type { Respondent } from '@data/respondents'
import type { features } from './respondentsTable'

type Table = ReactTable<typeof features, Respondent>
export type OrderColumn = ReturnType<Table['getAllLeafColumns']>[number]

/** Always the first column; nothing moves before it and it doesn't move. */
const FIRST_COLUMN = 'respondent'

/**
 * Pinned columns keep their own order (the pinning state), so they reorder among themselves;
 * the other columns follow `columnOrder`. A column never moves between the two.
 */
const zoneOf = (column: OrderColumn) => (column.getIsPinned() === 'start' ? 'start' : 'center')

export const canMoveColumn = (column: OrderColumn) => column.id !== FIRST_COLUMN

/** Every column in table order, hidden ones included: pinned first, then the rest. */
export function orderedColumns(table: Table) {
  const all = table.getAllLeafColumns()
  const pinned = table.state.columnPinning.start
  return [
    ...pinned.flatMap((id) => all.filter((c) => c.id === id)),
    ...all.filter((c) => !pinned.includes(c.id)),
  ]
}

/** Columns `column` may swap places with: the same zone, without the first column. */
export function sameZone(columns: OrderColumn[], column: OrderColumn) {
  return columns.filter((c) => canMoveColumn(c) && zoneOf(c) === zoneOf(column))
}

/** The nearest shown column to the left (-1) or right (1) that `column` can move past. */
export function shownNeighbour(table: Table, column: OrderColumn, dir: -1 | 1) {
  const shown = sameZone(table.getVisibleLeafColumns(), column)
  return shown[shown.findIndex((c) => c.id === column.id) + dir]
}

/** Moves a column just before or after another one in its zone. */
export function moveColumn(table: Table, id: string, targetId: string, place: 'before' | 'after') {
  const column = table.getColumn(id)
  const target = table.getColumn(targetId)
  if (!column || !target || id === targetId || !canMoveColumn(column) || zoneOf(column) !== zoneOf(target)) return
  const reorder = (ids: string[]) => {
    const rest = ids.filter((x) => x !== id)
    const at = rest.indexOf(targetId)
    if (at < 0) return ids
    rest.splice(place === 'after' ? at + 1 : at, 0, id)
    return rest
  }
  if (zoneOf(column) === 'start') {
    table.setColumnPinning((p) => ({ ...p, start: reorder(p.start) }))
  } else {
    // getAllLeafColumns already follows columnOrder, so this is the order as shown.
    table.setColumnOrder(reorder(table.getAllLeafColumns().map((c) => c.id)))
  }
}

/** Definition order, pinned columns first: the order before anyone moved a column. */
function defaultOrder(table: Table) {
  const natural = table.options.columns.flatMap((c) => (c.id ? [c.id] : []))
  const pinned = table.state.columnPinning.start
  return [...natural.filter((id) => pinned.includes(id)), ...natural.filter((id) => !pinned.includes(id))]
}

export function isColumnOrderChanged(table: Table) {
  const shown = orderedColumns(table).map((c) => c.id)
  return defaultOrder(table).filter((id) => shown.includes(id)).join() !== shown.join()
}

/** Back to the definition order; pinned columns stay pinned, in that order too. */
export function resetColumnOrder(table: Table) {
  const order = defaultOrder(table)
  table.setColumnOrder([])
  table.setColumnPinning((p) => ({ ...p, start: order.filter((id) => p.start.includes(id)) }))
}
