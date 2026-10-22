import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { isComplete, newCondition, withOperator, type Condition } from '../filters/filters'
import { NO_VALUE_OPS, OPERATORS, getProperty, takesList, type OperatorId } from '../filters/properties'
import { useDismiss } from '../hooks/useDismiss'
import { PropertyPicker, ValueEditor } from './FilterPanel'
import { anchorFor, useAnchoredPosition } from './FloatingMenu'

const ANCHOR = 'quick-add'

/** Second step: operator and value for the chosen property, in a small popover under the button. */
function ValueStep({ draft, onChange, onAdd, onCancel, onMore }: {
  draft: Condition
  onChange: (c: Condition) => void
  onAdd: (c: Condition) => void
  onCancel: () => void
  onMore: () => void
}) {
  const ref = useRef<HTMLFormElement>(null)
  const prop = getProperty(draft.prop!)

  useAnchoredPosition(ref, ANCHOR, 'start')
  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLElement>('.fp-quick-body input, .fp-quick-body select, .fp-quick-body button')?.focus({ preventScroll: true })
  }, [draft.op])
  useDismiss(true, `.fp-quick, .fp-options, [data-menu-anchor="${ANCHOR}"]`, (reason) => {
    onCancel()
    if (reason === 'escape') anchorFor(ANCHOR)?.focus()
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (isComplete(draft)) onAdd(draft)
  }
  // A single choice is the whole filter, so picking it adds the filter right away.
  const pickOne = prop.type === 'single' && !takesList(prop.type, draft.op) && !NO_VALUE_OPS.has(draft.op)

  return (
    <form ref={ref} className="fp-quick" aria-label={`Filter by ${prop.label}`} onSubmit={submit}>
      <div className="fp-quick-head">
        <strong>{prop.label}</strong>
        <select
          className="fp-inline-select"
          aria-label={`${prop.label} operator`}
          value={draft.op}
          onChange={(e) => onChange(withOperator(draft, e.target.value as OperatorId))}
        >
          {OPERATORS[prop.type].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <div className="fp-quick-body">
        {pickOne ? (
          <div className="fp-quick-options" role="group" aria-label={`${prop.label} value`}>
            {prop.options!.map(([v, text]) => (
              <button key={v} type="button" className="fp-option" onClick={() => onAdd({ ...draft, value: v })}>
                {text}
              </button>
            ))}
          </div>
        ) : (
          <ValueEditor c={draft} prop={prop} inline onChange={(value) => onChange({ ...draft, value })} />
        )}
      </div>
      <div className="fp-quick-foot">
        <button type="button" className="btn-link muted" onClick={onMore}>More options</button>
        {!pickOne && <button type="submit" className="btn btn-sm btn-primary" disabled={!isComplete(draft)}>Add filter</button>}
      </div>
    </form>
  )
}

/**
 * "+ Add filter" in the chips band: pick a property, then its value, and the filter is added
 * without opening the full panel (which stays the place for AND/OR and groups).
 */
export function QuickAddFilter({ onAdd, onOpenPanel }: { onAdd: (c: Condition) => void; onOpenPanel: (draft: Condition) => void }) {
  const [step, setStep] = useState<'closed' | 'prop' | 'value'>('closed')
  const [draft, setDraft] = useState<Condition | null>(null)

  const close = () => {
    setStep('closed')
    setDraft(null)
  }

  return (
    <>
      <button
        type="button"
        className="btn-link"
        data-menu-anchor={ANCHOR}
        aria-haspopup="dialog"
        aria-expanded={step !== 'closed'}
        onClick={() => (step === 'closed' ? setStep('prop') : close())}
      >
        + Add filter
      </button>
      {step === 'prop' && (
        <PropertyPicker
          anchorKey={ANCHOR}
          onClose={close}
          onPick={(id) => {
            setDraft(newCondition(id))
            setStep('value')
          }}
        />
      )}
      {step === 'value' && draft && (
        <ValueStep
          draft={draft}
          onChange={setDraft}
          onCancel={close}
          onAdd={(c) => {
            onAdd(c)
            close()
            anchorFor(ANCHOR)?.focus()
          }}
          onMore={() => {
            close()
            onOpenPanel(draft)
          }}
        />
      )}
    </>
  )
}
