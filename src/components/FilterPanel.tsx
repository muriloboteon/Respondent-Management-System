import { useEffect, useRef, useState, type Ref } from 'react'
import type { Respondent } from '@data/respondents'
import {
  LAST_DAYS,
  MODES,
  activeConditions,
  applyCondition,
  isComplete,
  matchesFilters,
  newCondition,
  testCondition,
  withMode,
  type Condition,
  type Filters,
  type Mode,
} from '../filters/filters'
import { CATEGORY_LABELS, NOT_SET, PROPERTIES, choicesFor, type PropCategory, type PropertyDef } from '../filters/properties'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { PanelResize } from './PanelResize'

/** The filters drawer takes the detail panel's place; its own width, within these limits. */
export const FILTER_DEFAULT_W = 340
export const FILTER_MIN_W = 300
export const FILTER_MAX_W = 560

/** Value lists longer than this get a search field and show only this many until "Show more". */
const LIST_LIMIT = 8

const fmt = (n: number) => n.toLocaleString('en-US')

interface FacetProps {
  prop: PropertyDef
  /** This property's filter, if it has one (it may still be missing its values). */
  condition: Condition | undefined
  filters: Filters
  data: readonly Respondent[]
  toProject: (sampleCount: number) => number
  onSet: (condition: Condition) => void
}

/** One property's values. Every change applies straight away, so the table follows along. */
function Facet({ prop, condition, filters, data, toProject, onSet }: FacetProps) {
  const [query, setQuery] = useState('')
  // Without a filter yet, nothing reads as chosen (dates would otherwise start at "the last 30 days").
  const draft = condition ?? { ...newCondition(prop.id), values: [] }
  const set = (values: string[]) => onSet({ ...draft, values })

  // Counts are taken alongside the search and the other filters, without this property's own filter.
  const others: Filters = { query: filters.query, conditions: filters.conditions.filter((c) => c.prop !== prop.id) }
  const base = data.filter((r) => matchesFilters(r, others))
  // One choice on its own: "is" for list values, the current mode for "in the last N days".
  const countFor = (v: string) =>
    toProject(base.filter((r) => testCondition(r, { ...draft, mode: prop.type === 'date' ? draft.mode : 'is', values: [v] })).length)

  const choices = choicesFor(prop)
  // List order is set when the section opens and then stays put, so ticking never moves a value:
  // the ticked values first, then the most common, with "Not set" last. Yes / no keep their order.
  const [order] = useState(() => {
    if (prop.type !== 'single' && prop.type !== 'multi') return choices
    const rank = ([v]: [string, string]) => (v === NOT_SET ? 2 : draft.values.includes(v) ? 0 : 1)
    return [...choices].sort((a, b) => rank(a) - rank(b) || countFor(b[0]) - countFor(a[0]))
  })
  /** Long lists show their first values until "Show more". */
  const [showAll, setShowAll] = useState(false)

  // Text: matches what contains the typed text ("Exclude" on a cell leaves it out, which the note says).
  if (prop.type === 'text') {
    return (
      <>
        {draft.mode === 'not_contains' && <p className="fpanel-note">Leaving out what contains this text</p>}
        <input
          className="fp-input"
          type="text"
          aria-label={`${prop.label} text`}
          placeholder="Type a value…"
          value={draft.values[0] ?? ''}
          onChange={(e) => set([e.target.value])}
        />
      </>
    )
  }

  if (prop.type === 'date') {
    const date = (i: number, label: string) => (
      <input
        className="fp-input"
        type="date"
        aria-label={label}
        value={draft.values[i] ?? ''}
        onChange={(e) => set(draft.values.map((v, j) => (j === i ? e.target.value : v)))}
      />
    )
    // Switching to "in the last" waits for a choice instead of picking 30 days.
    const changeMode = (m: Mode) => {
      const next = withMode(draft, m)
      onSet(m === 'in_last' && draft.mode !== 'in_last' ? { ...next, values: [] } : next)
    }
    return (
      <>
        <div className="fpanel-row">
          <select className="fp-input fpanel-select" aria-label={`${prop.label}: match`} value={draft.mode} onChange={(e) => changeMode(e.target.value as Mode)}>
            {MODES.date.map(([m, text]) => <option key={m} value={m}>{text}</option>)}
          </select>
        </div>
        {draft.mode === 'in_last' ? (
          <div className="fpanel-values" role="radiogroup" aria-label={`${prop.label}: in the last`}>
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
        )}
      </>
    )
  }

  // Lists and yes / no: tick the values to keep. "Exclude" on a cell leaves them out instead, which
  // the note says, since the drawer has no "is / is not" switch.
  const q = query.trim().toLowerCase()
  const matching = order.filter(([, text]) => text.toLowerCase().includes(q))
  // Searching shows every match; otherwise a long list stops at LIST_LIMIT.
  const shown = q || showAll ? matching : matching.slice(0, LIST_LIMIT)
  const more = matching.length - shown.length
  const toggle = (v: string) => set(draft.values.includes(v) ? draft.values.filter((x) => x !== v) : [...draft.values, v])
  const excluding = draft.mode === 'is_not'
  return (
    <>
      {excluding && <p className="fpanel-note">Leaving out the ticked values</p>}
      {choices.length > LIST_LIMIT && (
        <label className="field field-sm">
          <Icon name="search" />
          <span className="sr-only">Search {prop.label} values</span>
          <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}
      <div className="fpanel-values" role="group" aria-label={`${prop.label} values`}>
        {shown.map(([v, text]) => {
          // Values no respondent has (with the other filters) stay pickable, but read as empty.
          const n = countFor(v)
          return (
            <label key={v} className={n ? 'check-row' : 'check-row is-zero'}>
              <Checkbox checked={draft.values.includes(v)} onChange={() => toggle(v)} />
              {/* Long names wrap to two lines, then end in an ellipsis; the tooltip has all of it */}
              <span className="fp-value-name" title={text}>{text}</span>
              <span className="fp-count">{fmt(n)}</span>
            </label>
          )
        })}
        {!shown.length && <p className="fp-picker-empty">No values match “{query}”.</p>}
      </div>
      {more > 0 && (
        <button type="button" className="btn-link fpanel-more" onClick={() => setShowAll(true)}>
          Show {more} more
        </button>
      )}
      {showAll && !q && matching.length > LIST_LIMIT && (
        <button type="button" className="btn-link fpanel-more" onClick={() => setShowAll(false)}>
          Show less
        </button>
      )}
    </>
  )
}

interface Props {
  filters: Filters
  /** The loaded respondents. */
  data: readonly Respondent[]
  /** Scales a count in the loaded sample to the whole project, like the other counts. */
  toProject: (sampleCount: number) => number
  /** True when the drawer slides over the page (narrow screens). */
  asDialog: boolean
  /** True when the docked drawer can be resized (wide screens). */
  resizable: boolean
  width: number
  onWidthChange: (width: number) => void
  /** A property to open and scroll to (from a chip or a column's "Filter…"); a new `seq` asks again. */
  focus: { prop: string | null; seq: number }
  closeRef: Ref<HTMLButtonElement>
  onConditionsChange: (conditions: Condition[]) => void
  onClose: () => void
}

/**
 * The filters drawer, in the detail panel's place: a property search, then one collapsible section
 * per property with its values and how many respondents each matches. Ticking a value filters the
 * table right away; the applied filters also show as chips above the table.
 */
export function FilterPanel({ filters, data, toProject, asDialog, resizable, width, onWidthChange, focus, closeRef, onConditionsChange, onClose }: Props) {
  const conditions = filters.conditions
  const scrollRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  // Properties already filtered start open.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(activeConditions(conditions).map((c) => c.prop)))
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Opened on a property: show its section and bring it into view.
  useEffect(() => {
    const prop = focus.prop
    if (!prop) return
    setQuery('')
    setOpen((cur) => new Set([...cur, prop]))
    requestAnimationFrame(() => {
      const head = scrollRef.current?.querySelector<HTMLElement>(`[data-facet="${prop}"]`)
      head?.scrollIntoView({ block: 'start' })
      head?.focus({ preventScroll: true })
    })
  }, [focus.seq])

  const q = query.trim().toLowerCase()
  const matches = PROPERTIES.filter((p) => p.label.toLowerCase().includes(q))
  const sections = (Object.keys(CATEGORY_LABELS) as PropCategory[])
    .map((cat) => [cat, matches.filter((p) => p.category === cat)] as const)
    .filter(([, list]) => list.length > 0)
  const activeCount = activeConditions(conditions).length

  return (
    <aside
      id="filter-panel"
      className="detail filter-panel"
      aria-labelledby="filters-h"
      role={asDialog ? 'dialog' : undefined}
      aria-modal={asDialog || undefined}
    >
      {resizable && (
        <PanelResize label="Resize filters panel" width={width} min={FILTER_MIN_W} max={FILTER_MAX_W} onWidthChange={onWidthChange} />
      )}
      <div className="detail-bar">
        <span className="detail-kind" id="filters-h">
          <Icon name="funnel" />
          Filters
          {/* Same count as the Filters button above the table */}
          {activeCount > 0 && (
            <span className="filter-count">
              {activeCount}
              <span className="sr-only"> applied</span>
            </span>
          )}
        </span>
        <span className="detail-bar-actions">
          <button ref={closeRef} type="button" className="icon-btn detail-close" aria-label="Close filters" title="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </span>
      </div>

      <div className="fpanel-search">
        <label className="field field-sm">
          <Icon name="search" />
          <span className="sr-only">Find a property</span>
          <input type="search" placeholder="Find a property" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="detail-scroll" ref={scrollRef}>
        {sections.map(([cat, list]) => (
          <section key={cat} aria-label={CATEGORY_LABELS[cat]}>
            <p className="fpanel-heading">{CATEGORY_LABELS[cat]}</p>
            {list.map((p) => {
              const condition = conditions.find((c) => c.prop === p.id)
              const isOpen = open.has(p.id) || q !== ''
              // A filtered section says so even when closed: how many values are ticked, or a dot for text and dates.
              const isList = p.type !== 'text' && p.type !== 'date'
              const filtered = condition !== undefined && isComplete(condition)
              return (
                <div key={p.id} className="fpanel-section">
                  <button
                    type="button"
                    className="fpanel-section-head"
                    data-facet={p.id}
                    aria-expanded={isOpen}
                    aria-controls={`facet-${p.id}`}
                    onClick={() => toggle(p.id)}
                  >
                    <span className="fpanel-label" title={p.label}>{p.label}</span>
                    {filtered && (
                      <span className={isList ? 'fpanel-badge' : 'fpanel-badge is-dot'}>
                        {isList && condition.values.length}
                        <span className="sr-only">{isList ? ' selected' : 'Filtered'}</span>
                      </span>
                    )}
                    <Icon name={isOpen ? 'minus' : 'plus'} small />
                  </button>
                  {isOpen && (
                    <div className="fpanel-body" id={`facet-${p.id}`}>
                      <Facet
                        prop={p}
                        condition={condition}
                        filters={filters}
                        data={data}
                        toProject={toProject}
                        onSet={(c) => onConditionsChange(applyCondition(conditions, c))}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
        {!matches.length && <p className="fp-picker-empty fpanel-empty">No properties match “{query}”.</p>}
      </div>
    </aside>
  )
}
