import { summarize, type Condition } from '../filters/filters'
import { Icon } from './Icon'

/** One applied filter in the band: its text opens its section in the filters drawer, × removes it. */
export function FilterChip({ condition, onEdit, onRemove }: { condition: Condition; onEdit: () => void; onRemove: () => void }) {
  const s = summarize(condition)
  const text = s.op ? `${s.prop} ${s.op} ${s.val}` : `${s.prop}: ${s.val}`
  return (
    <span className="chip">
      <button
        type="button"
        className="chip-body"
        aria-controls="filter-panel"
        aria-label={`Edit filter: ${text}`}
        title={text}
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
      </button>
      <button type="button" aria-label={`Remove filter ${s.prop}`} onClick={onRemove}>
        <Icon name="x" small />
      </button>
    </span>
  )
}
