import type { AiNote } from '../filters/aiFilters'
import { chipParts, type Condition } from '../filters/filters'
import { Icon } from './Icon'

/**
 * Part of the last AI description that couldn't be used ("Not understood: heavy shoppers"): a
 * dashed chip after the filters, so it stays in view with the results; × dismisses it. The tooltip
 * explains.
 */
export function AiNoteChip({ note, onRemove }: { note: AiNote; onRemove: () => void }) {
  return (
    <span className="chip chip-note" title={note.detail}>
      <span className="chip-note-icon" aria-hidden="true">
        <Icon name="sparkle" small />
      </span>
      <span className="v">{note.text}</span>
      <span className="sr-only">. {note.detail}</span>
      <button type="button" aria-label={`Dismiss note: ${note.text}`} onClick={onRemove}>
        <Icon name="x" small />
      </button>
    </span>
  )
}

/**
 * One applied filter in the band: its text opens its section in the filters drawer, × removes it.
 * The chip has a maximum width: a long property name is cut first, then the value; only one value
 * shows, with "+N" for the others, and "+N" and × never get cut. The tooltip reads it all.
 */
export function FilterChip({ condition, onEdit, onRemove }: { condition: Condition; onEdit: () => void; onRemove: () => void }) {
  const s = chipParts(condition)
  return (
    <span className="chip">
      <button
        type="button"
        className="chip-body"
        aria-controls="filter-panel"
        aria-label={`Edit filter: ${s.full}`}
        title={s.full}
        onClick={onEdit}
      >
        {s.op ? (
          <>
            <span className="k">{s.prop}</span>
            <span className="op">{s.op}</span>
          </>
        ) : (
          <span className="k">{s.prop}:</span>
        )}
        <span className="v">{s.val}</span>
        {s.more > 0 && <span className="more">+{s.more}</span>}
      </button>
      <button type="button" aria-label={`Remove filter ${s.prop}`} onClick={onRemove}>
        <Icon name="x" small />
      </button>
    </span>
  )
}
