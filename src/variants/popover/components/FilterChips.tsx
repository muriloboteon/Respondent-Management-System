import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Respondent } from '@data/respondents'
import {
  LAST_DAYS,
  MODES,
  isComplete,
  matchesFilters,
  newCondition,
  summarize,
  testCondition,
  withMode,
  type Condition,
  type Filters,
  type Mode,
} from '../filters/filters'
import { CATEGORY_LABELS, PROPERTIES, choicesFor, getProperty, type PropCategory } from '../filters/properties'
import { useDismiss } from '../hooks/useDismiss'
import { Checkbox } from './Checkbox'
import { anchorFor, useAnchoredPosition } from './FloatingMenu'
import { Icon } from './Icon'

/** Which filter popover is open: adding, editing a chip, or opened on one column from its menu. */
export type FilterLayer =
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'column'; prop: string; anchorKey: string }
  | null

/** Value lists longer than this get a search field. */
const SEARCH_FROM = 8

const fmt = (n: number) => n.toLocaleString('en-US')

/** Arrow keys move between the options; Up from the first goes back to the search field. */
function moveFocus(e: KeyboardEvent<HTMLElement>, layer: HTMLElement | null) {
  if (!layer || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
  if ((e.target as HTMLElement).matches('select, input[type="date"]')) return
  e.preventDefault()
  const options = Array.from(layer.querySelectorAll<HTMLElement>('.fp-option, .check-row input'))
  const i = options.indexOf(document.activeElement as HTMLElement)
  const next = e.key === 'ArrowDown' ? i + 1 : i - 1
  if (next < 0) layer.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
  else options[Math.min(next, options.length - 1)]?.focus()
}

/**
 * The filter popover. It opens under the control that opened it ("+ Add filter", a chip, or a
 * column's menu button) and stays there: picking a column swaps its content for that column's
 * values in the same box, which keeps one size throughout. Each choice shows how many respondents
 * it matches alongside the other filters, and the footer previews the result. Nothing is applied
 * while choosing; "Add filter" (or "Apply") adds the chip, and Cancel, Escape or a press outside
 * drops the draft.
 */
export function FilterPopover({ anchorKey, align, editing, startProp, filters, data, toProject, onApply, onClose }: {
  anchorKey: string
  align: 'start' | 'end'
  /** The chip being edited. */
  editing?: Condition
  /** Opened on one column (from its menu): its values show straight away. */
  startProp?: string
  /** The search and the applied filters, for the counts; picking a filtered column edits its chip. */
  filters: Filters
  /** The loaded respondents. */
  data: readonly Respondent[]
  /** Scales a count in the loaded sample to the whole project, like the other counts. */
  toProject: (sampleCount: number) => number
  onApply: (condition: Condition) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useAnchoredPosition(ref, anchorKey, align)
  const close = (focusAnchor = true) => {
    onClose()
    if (focusAnchor) anchorFor(anchorKey)?.focus()
  }
  useDismiss(true, `.fp-picker, [data-menu-anchor="${anchorKey}"]`, (reason) => close(reason === 'escape'))

  const draftFor = (propId: string) => {
    const applied = filters.conditions.find((c) => c.prop === propId)
    return applied ? { ...applied, values: [...applied.values] } : newCondition(propId)
  }
  /** The draft: a column with its mode and values, or null while the column list shows. */
  const [draft, setDraft] = useState<Condition | null>(() =>
    editing ? { ...editing, values: [...editing.values] } : startProp ? draftFor(startProp) : null,
  )
  const [query, setQuery] = useState('')
  const pickColumn = (propId: string) => {
    setDraft(draftFor(propId))
    setQuery('')
  }

  // Focus the step's first field (search, text, date) or its first option.
  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLElement>('input:not([type="checkbox"]), .fp-option, .check-row input')?.focus({ preventScroll: true })
  }, [draft?.prop])

  const q = query.trim().toLowerCase()
  let body
  if (!draft) {
    const matches = PROPERTIES.filter((p) => p.label.toLowerCase().includes(q))
    const sections = (Object.keys(CATEGORY_LABELS) as PropCategory[])
      .map((cat) => [cat, matches.filter((p) => p.category === cat)] as const)
      .filter(([, list]) => list.length > 0)
    body = (
      <>
        <label className="field field-sm">
          <Icon name="search" />
          <span className="sr-only">Search columns</span>
          <input
            type="search"
            placeholder="Filter by…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) pickColumn(matches[0].id)
            }}
          />
        </label>
        <div className="fp-picker-list">
          {sections.map(([cat, list]) => (
            <div key={cat} role="group" aria-label={CATEGORY_LABELS[cat]}>
              <p className="fp-picker-heading">{CATEGORY_LABELS[cat]}</p>
              {list.map((p) => (
                <button key={p.id} type="button" className="fp-option" onClick={() => pickColumn(p.id)}>
                  {p.label}
                  {filters.conditions.some((c) => c.prop === p.id) && <span className="fp-in-use">In use</span>}
                </button>
              ))}
            </div>
          ))}
          {!matches.length && <p className="fp-picker-empty">No columns match “{query}”.</p>}
        </div>
      </>
    )
  } else {
    const prop = getProperty(draft.prop)
    // Counts are taken alongside the search and the other filters, without this column's own filter.
    const others: Filters = { query: filters.query, conditions: filters.conditions.filter((c) => c.id !== draft.id && c.prop !== draft.prop) }
    const base = data.filter((r) => matchesFilters(r, others))
    // One choice on its own: "is" for list values, the current mode for "in the last N days".
    const countFor = (v: string) =>
      toProject(base.filter((r) => testCondition(r, { ...draft, mode: prop.type === 'date' ? draft.mode : 'is', values: [v] })).length)
    const complete = isComplete(draft)
    const preview = toProject(complete ? base.filter((r) => testCondition(r, draft)).length : base.length)
    const isEdit = filters.conditions.some((c) => c.id === draft.id)
    const set = (values: string[]) => setDraft({ ...draft, values })
    const apply = () => {
      if (!isComplete(draft)) return
      onApply(draft)
      close()
    }

    let values
    if (prop.type === 'text') {
      values = (
        <input
          className="fp-input"
          type="text"
          aria-label={`${prop.label} text`}
          placeholder="Type a value…"
          value={draft.values[0] ?? ''}
          onChange={(e) => set([e.target.value])}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply()
          }}
        />
      )
    } else if (prop.type === 'date') {
      const date = (i: number, label: string) => (
        <input
          className="fp-input"
          type="date"
          aria-label={label}
          value={draft.values[i] ?? ''}
          onChange={(e) => set(draft.values.map((v, j) => (j === i ? e.target.value : v)))}
        />
      )
      values =
        draft.mode === 'in_last' ? (
          <div className="fp-picker-list" role="radiogroup" aria-label={`${prop.label}: in the last`}>
            {LAST_DAYS.map(([v, text]) => {
              const on = draft.values[0] === v
              return (
                <button key={v} type="button" role="radio" aria-checked={on} className="fp-option" onClick={() => set([v])}>
                  {text}
                  <span className="fp-option-end">
                    <span className="fp-count">{fmt(countFor(v))}</span>
                    {on && <Icon name="check" small />}
                  </span>
                </button>
              )
            })}
          </div>
        ) : draft.mode === 'between' ? (
          <div className="fp-dates">
            {date(0, `${prop.label} from`)}
            <span>and</span>
            {date(1, `${prop.label} to`)}
          </div>
        ) : (
          <div className="fp-dates">{date(0, `${prop.label} date`)}</div>
        )
    } else if (prop.type === 'boolean') {
      values = (
        <div className="fp-picker-list" role="radiogroup" aria-label={prop.label}>
          {choicesFor(prop).map(([v, text]) => {
            const on = draft.values[0] === v
            const n = countFor(v)
            return (
              <button key={v} type="button" role="radio" aria-checked={on} className={n ? 'fp-option' : 'fp-option is-zero'} onClick={() => setDraft({ ...draft, mode: 'is', values: [v] })}>
                {text}
                <span className="fp-option-end">
                  <span className="fp-count">{fmt(n)}</span>
                  {on && <Icon name="check" small />}
                </span>
              </button>
            )
          })}
        </div>
      )
    } else {
      const choices = choicesFor(prop)
      const shown = choices.filter(([, text]) => text.toLowerCase().includes(q))
      const toggle = (v: string) => set(draft.values.includes(v) ? draft.values.filter((x) => x !== v) : [...draft.values, v])
      values = (
        <>
          {choices.length > SEARCH_FROM && (
            <label className="field field-sm">
              <Icon name="search" />
              <span className="sr-only">Search {prop.label} values</span>
              <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
          <div className="fp-picker-list">
            <div className="fp-checklist" role="group" aria-label={`${prop.label} values`}>
              {shown.map(([v, text]) => {
                // Values no respondent has (with the other filters) stay pickable, but read as empty.
                const n = countFor(v)
                return (
                  <label key={v} className={n ? 'check-row' : 'check-row is-zero'}>
                    <Checkbox checked={draft.values.includes(v)} onChange={() => toggle(v)} />
                    <span className="fp-value-name">{text}</span>
                    <span className="fp-count">{fmt(n)}</span>
                  </label>
                )
              })}
              {!shown.length && <p className="fp-picker-empty">No values match “{query}”.</p>}
            </div>
          </div>
        </>
      )
    }

    body = (
      <>
        <div className="fp-editor-head">
          {!editing && !startProp && (
            <button type="button" className="icon-btn fp-back" aria-label="Back to columns" title="Back to columns" onClick={() => setDraft(null)}>
              <Icon name="arrowLeft" small />
            </button>
          )}
          <span className="fp-editor-prop">{prop.label}</span>
          {MODES[prop.type].length === 1 ? (
            <span className="fp-editor-mode">{MODES[prop.type][0][1]}</span>
          ) : (
            <select
              className="fp-inline-select"
              aria-label={`${prop.label}: match`}
              value={draft.mode}
              onChange={(e) => setDraft(withMode(draft, e.target.value as Mode))}
            >
              {MODES[prop.type].map(([m, text]) => <option key={m} value={m}>{text}</option>)}
            </select>
          )}
        </div>
        {values}
        {/* Text and date fields leave room below; the list types fill it */}
        {(prop.type === 'text' || (prop.type === 'date' && draft.mode !== 'in_last')) && <div className="fp-spacer" />}
        <div className="fp-picker-foot">
          <span className="fp-preview" role="status">
            <strong>{fmt(preview)}</strong> respondent{preview === 1 ? '' : 's'}
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => close()}>Cancel</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={!complete} onClick={apply}>
            {isEdit ? 'Apply' : 'Add filter'}
          </button>
        </div>
      </>
    )
  }

  return createPortal(
    <div
      ref={ref}
      className="fp-picker"
      role="dialog"
      aria-label={draft ? `Filter by ${getProperty(draft.prop).label}` : 'Add a filter'}
      onKeyDown={(e) => moveFocus(e, ref.current)}
    >
      {body}
    </div>,
    document.body,
  )
}

/** One applied filter in the band: its text opens the popover to change it, × removes it. */
export function FilterChip({ condition, open, onEdit, onRemove }: { condition: Condition; open: boolean; onEdit: () => void; onRemove: () => void }) {
  const s = summarize(condition)
  const text = s.op ? `${s.prop} ${s.op} ${s.val}` : `${s.prop}: ${s.val}`
  return (
    <span className="chip">
      <button
        type="button"
        className="chip-body"
        data-menu-anchor={`chip:${condition.id}`}
        aria-haspopup="dialog"
        aria-expanded={open}
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
