import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Respondent } from '../data/respondents'
import { AI_EXAMPLES, generateFilters } from '../filters/aiFilter'
import {
  EMPTY_TREE,
  cloneItem,
  matchesTree,
  newCondition,
  newId,
  summarize,
  withOperator,
  type Condition,
  type FilterItem,
  type FilterTree,
  type Group,
  type Join,
} from '../filters/filters'
import {
  CATEGORY_LABELS,
  NO_VALUE_OPS,
  OPERATORS,
  PROPERTIES,
  TYPE_LABELS,
  WITHIN_PRESETS,
  getProperty,
  takesList,
  type OperatorId,
  type PropCategory,
  type PropertyDef,
} from '../filters/properties'
import { useDismiss } from '../hooks/useDismiss'
import { FloatingMenu, anchorFor, useAnchoredPosition, type MenuItem } from './FloatingMenu'
import { Icon } from './Icon'

type Layer = { kind: 'prop' | 'more'; id: string } | null

/* ---------- Tree edits (root items, plus conditions one level down in groups) ---------- */

function mapConditions(tree: FilterTree, id: string, fn: (c: Condition) => Condition): FilterTree {
  return {
    ...tree,
    items: tree.items.map((item) =>
      item.kind === 'condition' ? (item.id === id ? fn(item) : item) : { ...item, conditions: item.conditions.map((c) => (c.id === id ? fn(c) : c)) },
    ),
  }
}

function removeItem(tree: FilterTree, id: string): FilterTree {
  const items = tree.items
    .filter((item) => item.id !== id)
    .map((item) => (item.kind === 'group' ? { ...item, conditions: item.conditions.filter((c) => c.id !== id) } : item))
    .filter((item) => item.kind === 'condition' || item.conditions.length > 0)
  return { ...tree, items }
}

function duplicateItem(tree: FilterTree, id: string): FilterTree {
  const items: FilterItem[] = []
  for (const item of tree.items) {
    if (item.kind === 'group' && item.id !== id) {
      const conditions = item.conditions.flatMap((c) => (c.id === id ? [c, cloneItem(c)] : [c]))
      items.push({ ...item, conditions })
    } else {
      items.push(item)
      if (item.id === id) items.push(cloneItem(item))
    }
  }
  return { ...tree, items }
}

/* ---------- Pieces ---------- */

/** The one place a level's AND/OR is chosen: "Match [all ▾] of …" / "[Any ▾] of these conditions". */
function JoinSelect({ join, onChange, label, capitalize = false }: { join: Join; onChange: (join: Join) => void; label: string; capitalize?: boolean }) {
  return (
    <select className="fp-inline-select fp-join-select" aria-label={label} value={join} onChange={(e) => onChange(e.target.value as Join)}>
      <option value="and">{capitalize ? 'All' : 'all'}</option>
      <option value="or">{capitalize ? 'Any' : 'any'}</option>
    </select>
  )
}

/** Read-only "and" / "or" between rows; it follows the level's JoinSelect. */
function Connector({ join }: { join: Join }) {
  return <span className="fp-connector" aria-hidden="true">{join}</span>
}

type Options = Array<[string, string]>

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** Checkbox list for "is any of" / "contains" values; inline in quick add, in a dropdown in the panel. */
export function CheckList({ label, options, value, onChange }: { label: string; options: Options; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="fp-checklist" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <label key={v} className="check-row">
          <input type="checkbox" checked={value.includes(v)} onChange={() => onChange(toggle(value, v))} />
          <span>{text}</span>
        </label>
      ))}
    </div>
  )
}

function CheckListPopover(props: { anchorKey: string; label: string; options: Options; value: string[]; onChange: (value: string[]) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useAnchoredPosition(ref, props.anchorKey, 'start')
  useLayoutEffect(() => ref.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }), [])
  useDismiss(true, `.fp-options, [data-menu-anchor="${props.anchorKey}"]`, (reason) => {
    props.onClose()
    if (reason === 'escape') anchorFor(props.anchorKey)?.focus()
  })
  return (
    <div ref={ref} className="fp-options">
      <CheckList label={props.label} options={props.options} value={props.value} onChange={props.onChange} />
    </div>
  )
}

/** Looks like a select; opens a checkbox list so several values can be picked. */
function MultiSelect({ anchorKey, label, options, value, onChange }: { anchorKey: string; label: string; options: Options; value: string[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const names = value.map((v) => options.find((o) => o[0] === v)?.[1] ?? v)
  return (
    <>
      <button
        type="button"
        className={names.length ? 'select select-sm fp-multi' : 'select select-sm fp-multi is-empty'}
        data-menu-anchor={anchorKey}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${label}: ${names.length ? names.join(', ') : 'none selected'}`}
        title={names.join(', ')}
        onClick={() => setOpen((o) => !o)}
      >
        {names.length ? names.join(', ') : 'Select values…'}
      </button>
      {open && <CheckListPopover anchorKey={anchorKey} label={label} options={options} value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ValueEditor({ c, prop, onChange, inline = false }: { c: Condition; prop: PropertyDef; onChange: (value: string | string[]) => void; inline?: boolean }) {
  if (NO_VALUE_OPS.has(c.op)) return null
  const label = `${prop.label} value`

  if (takesList(prop.type, c.op)) {
    const picked = c.value as string[]
    return inline ? (
      <CheckList label={label} options={prop.options!} value={picked} onChange={onChange} />
    ) : (
      <MultiSelect anchorKey={`values:${c.id}`} label={label} options={prop.options!} value={picked} onChange={onChange} />
    )
  }

  const value = c.value as string
  if (prop.type === 'single') {
    return (
      <select className="select select-sm fp-value" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {!value && <option value="">Select a value…</option>}
        {prop.options!.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    )
  }
  if (prop.type === 'boolean') {
    return (
      <select className="select select-sm fp-value" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    )
  }
  if (prop.type === 'date' && c.op === 'within') {
    const presets = WITHIN_PRESETS.some((p) => p[0] === value) ? WITHIN_PRESETS : [...WITHIN_PRESETS, [value, `the past ${value.split('-')[1]} days`]]
    return (
      <select className="select select-sm fp-value" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {presets.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    )
  }
  return (
    <input
      className="fp-input fp-value"
      aria-label={label}
      type={prop.type === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'}
      min={prop.type === 'number' ? 0 : undefined}
      placeholder={prop.type === 'number' ? 'Enter a number' : 'Enter a value'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** "Filter by..." search plus All / Respondent / Screener tabs, like Rally's property picker. */
export function PropertyPicker({ anchorKey, onPick, onClose }: { anchorKey: string; onPick: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | PropCategory>('all')

  useAnchoredPosition(ref, anchorKey, 'start')
  useLayoutEffect(() => input.current?.focus({ preventScroll: true }), [])
  useDismiss(true, `.fp-picker, [data-menu-anchor="${anchorKey}"]`, (reason) => {
    onClose()
    if (reason === 'escape') anchorFor(anchorKey)?.focus()
  })

  const q = query.trim().toLowerCase()
  const matches = PROPERTIES.filter((p) => (tab === 'all' || p.category === tab) && p.label.toLowerCase().includes(q))
  const sections = (['respondent', 'screener'] as PropCategory[])
    .map((cat) => [cat, matches.filter((p) => p.category === cat)] as const)
    .filter(([, list]) => list.length > 0)

  const moveFocus = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const options = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('.fp-option'))
    const i = options.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1
    if (next < 0) input.current?.focus()
    else options[Math.min(next, options.length - 1)]?.focus()
  }

  const tabs: Array<['all' | PropCategory, string]> = [['all', 'All properties'], ['respondent', CATEGORY_LABELS.respondent], ['screener', CATEGORY_LABELS.screener]]

  return (
    <div ref={ref} className="fp-picker" role="dialog" aria-label="Choose a property" onKeyDown={moveFocus}>
      <label className="field field-sm">
        <Icon name="search" />
        <span className="sr-only">Search properties</span>
        <input
          ref={input}
          type="search"
          placeholder="Filter by..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) onPick(matches[0].id)
          }}
        />
      </label>
      <div className="fp-picker-tabs" role="tablist" aria-label="Property type">
        {tabs.map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="fp-picker-tab" onClick={() => setTab(id)}>
            {text}
          </button>
        ))}
      </div>
      <div className="fp-picker-list">
        {sections.map(([cat, list]) => (
          <div key={cat} role="group" aria-label={CATEGORY_LABELS[cat]}>
            <p className="fp-picker-heading">{CATEGORY_LABELS[cat]}</p>
            {list.map((p) => (
              <button key={p.id} type="button" className="fp-option" onClick={() => onPick(p.id)}>
                <span>{p.label}</span>
                <span className="fp-type">{TYPE_LABELS[p.type]}</span>
              </button>
            ))}
          </div>
        ))}
        {!matches.length && <p className="fp-picker-empty">No properties match “{query}”.</p>}
      </div>
    </div>
  )
}

/* ---------- Panel ---------- */

interface Props {
  tree: FilterTree
  onTreeChange: (tree: FilterTree) => void
  /** All respondents, to preview how many AI-generated filters would match. */
  data: readonly Respondent[]
  /** Rows the table shows with the current filters (and search). */
  resultCount: number
  /** Closes the panel ("Show N respondents"). */
  onDone: () => void
}

export function FilterPanel({ tree, onTreeChange, data, resultCount, onDone }: Props) {
  const [layer, setLayer] = useState<Layer>(null)
  const [aiText, setAiText] = useState('')
  const [aiFocus, setAiFocus] = useState(false)
  /** Suggested conditions waiting for Accept / Discard (empty list: nothing understood). */
  const [aiResult, setAiResult] = useState<Condition[] | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const toggleLayer = (next: NonNullable<Layer>) => setLayer((cur) => (cur && cur.kind === next.kind && cur.id === next.id ? null : next))
  const update = (id: string, fn: (c: Condition) => Condition) => onTreeChange(mapConditions(tree, id, fn))

  const addCondition = (groupId?: string) => {
    const c = newCondition()
    onTreeChange({
      ...tree,
      items: groupId
        ? tree.items.map((item) => (item.kind === 'group' && item.id === groupId ? { ...item, conditions: [...item.conditions, c] } : item))
        : [...tree.items, c],
    })
    setLayer({ kind: 'prop', id: c.id })
  }
  const addGroup = () => {
    const c = newCondition()
    // Groups exist mostly for "either of these", so they start as "Any".
    onTreeChange({ ...tree, items: [...tree.items, { kind: 'group', id: newId(), join: 'or', conditions: [c] }] })
    setLayer({ kind: 'prop', id: c.id })
  }

  const runAi = (text: string) => {
    setConfirmReplace(false)
    setAiResult(text.trim() ? generateFilters(text) : null)
  }
  const aiMatches = aiResult?.length ? data.filter((r) => matchesTree(r, { join: 'and', items: aiResult })).length : 0
  const discardAi = () => {
    setAiResult(null)
    setConfirmReplace(false)
  }
  const dropSuggestion = (id: string) =>
    setAiResult((cur) => {
      const next = (cur ?? []).filter((c) => c.id !== id)
      return next.length ? next : null
    })
  const acceptAi = (mode: 'replace' | 'add') => {
    if (!aiResult) return
    const fresh = aiResult.map((c) => cloneItem(c))
    let items: FilterItem[] = fresh
    if (mode === 'add') {
      // The suggestions belong together (all must hold), even when the panel combines with "any".
      const added: FilterItem[] = tree.join === 'or' && fresh.length > 1 ? [{ kind: 'group', id: newId(), join: 'and', conditions: fresh }] : fresh
      items = [...tree.items, ...added]
    }
    onTreeChange({ join: mode === 'replace' ? 'and' : tree.join, items })
    setAiResult(null)
    setAiText('')
    setConfirmReplace(false)
  }

  // ⋯ holds the less common actions; removing is the × on each row or group.
  let menu = null
  if (layer?.kind === 'more') {
    const id = layer.id
    const topItem = tree.items.find((item) => item.id === id)
    const items: MenuItem[] = [{ label: topItem?.kind === 'group' ? 'Duplicate group' : 'Duplicate', onSelect: () => onTreeChange(duplicateItem(tree, id)) }]
    if (topItem?.kind === 'condition') {
      items.push({
        label: 'Turn into filter group',
        onSelect: () =>
          onTreeChange({ ...tree, items: tree.items.map((item) => (item.id === id ? { kind: 'group', id: newId(), join: 'or', conditions: [item as Condition] } : item)) }),
      })
    }
    menu = <FloatingMenu anchorKey={`more:${id}`} label="Filter options" align="end" width={210} items={items} onClose={() => setLayer(null)} />
  }

  const moreButton = (id: string, label: string) => (
    <button
      type="button"
      className="icon-btn fp-more"
      data-menu-anchor={`more:${id}`}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={layer?.kind === 'more' && layer.id === id}
      onClick={() => toggleLayer({ kind: 'more', id })}
    >
      <Icon name="dots" />
    </button>
  )
  const removeButton = (id: string, label: string) => (
    <button type="button" className="icon-btn fp-remove" aria-label={label} onClick={() => onTreeChange(removeItem(tree, id))}>
      <Icon name="x" />
    </button>
  )

  // Each row reads as a sentence: **Property** operator ▾ [value] ⋯ ×
  const renderRow = (c: Condition) => {
    const prop = c.prop ? getProperty(c.prop) : null
    const pickerOpen = layer?.kind === 'prop' && layer.id === c.id
    return (
      <div key={c.id} className="fp-row">
        <button
          type="button"
          className={prop ? 'fp-prop' : 'fp-prop is-empty'}
          data-menu-anchor={`prop:${c.id}`}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          onClick={() => toggleLayer({ kind: 'prop', id: c.id })}
        >
          <span>{prop?.label ?? 'Choose a property'}</span>
          <Icon name="caretDown" small />
        </button>
        {prop && (
          <select
            className="fp-inline-select fp-op"
            aria-label={`${prop.label} operator`}
            value={c.op}
            onChange={(e) => update(c.id, (x) => withOperator(x, e.target.value as OperatorId))}
          >
            {OPERATORS[prop.type].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        )}
        {prop && !NO_VALUE_OPS.has(c.op) && (
          <div className="fp-cell-value">
            <ValueEditor c={c} prop={prop} onChange={(value) => update(c.id, (x) => ({ ...x, value }))} />
          </div>
        )}
        <div className="fp-row-actions">
          {moreButton(c.id, 'More filter options')}
          {removeButton(c.id, prop ? `Remove filter ${prop.label}` : 'Remove filter')}
        </div>
        {pickerOpen && (
          <PropertyPicker
            anchorKey={`prop:${c.id}`}
            onClose={() => setLayer(null)}
            onPick={(propId) => {
              update(c.id, (x) => (x.prop === propId ? x : { ...newCondition(propId), id: x.id }))
              setLayer(null)
            }}
          />
        )}
      </div>
    )
  }

  const setGroupJoin = (id: string, join: Join) =>
    onTreeChange({ ...tree, items: tree.items.map((item) => (item.kind === 'group' && item.id === id ? { ...item, join } : item)) })

  const renderGroup = (g: Group) => (
    <div key={g.id} className="fp-group" role="group" aria-label="Filter group">
      <div className="fp-group-head">
        <span className="fp-logic">
          <JoinSelect join={g.join} onChange={(join) => setGroupJoin(g.id, join)} label="Group matches" capitalize /> of these conditions
        </span>
        <div className="fp-row-actions">
          {moreButton(g.id, 'More group options')}
          {removeButton(g.id, 'Remove filter group')}
        </div>
      </div>
      {g.conditions.map((c, j) => (
        <Fragment key={c.id}>
          {j > 0 && <Connector join={g.join} />}
          {renderRow(c)}
        </Fragment>
      ))}
      <button type="button" className="btn btn-sm btn-ghost fp-add" onClick={() => addCondition(g.id)}>
        <Icon name="plus" />
        Add condition
      </button>
    </div>
  )

  return (
    <>
      <span className="sheet-handle" aria-hidden="true" />
      <p className="panel-title">Filters</p>

      {/* AI Filter: one compact line; its results come back as suggested rows to accept or discard */}
      <form
        className="fp-ai-bar"
        aria-label="AI Filter"
        onSubmit={(e) => {
          e.preventDefault()
          runAi(aiText)
        }}
      >
        <label className="field field-sm fp-ai-field">
          <Icon name="sparkle" />
          <span className="sr-only">AI Filter: describe the respondents you want</span>
          <input
            type="text"
            placeholder="Describe who you’re looking for…"
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            onFocus={() => setAiFocus(true)}
            onBlur={() => setAiFocus(false)}
          />
        </label>
        <button type="submit" className="btn btn-sm btn-outline" disabled={!aiText.trim()}>Generate</button>
      </form>
      {aiFocus && !aiText.trim() && (
        <div className="fp-ai-try">
          <span>Try:</span>
          {AI_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="btn-link"
              // Keep focus in the field so this list doesn't vanish before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setAiText(ex)
                runAi(ex)
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
      {aiResult?.length === 0 && (
        <p className="fp-ai-empty" role="status">
          Couldn’t turn that into filters. Try a market, buyer status, consent, diary, AI interview, live session or a date range.
        </p>
      )}

      {aiResult && aiResult.length > 0 && (
        <section className="fp-suggest" aria-label="Suggested filters">
          <p className="fp-suggest-head" role="status">
            <Icon name="sparkle" />
            <strong>{aiResult.length} suggested filter{aiResult.length === 1 ? '' : 's'}</strong>
            <span>· {aiMatches} of {data.length} sample respondents match</span>
          </p>
          {aiResult.map((c, i) => {
            const s = summarize(c)
            return (
              <Fragment key={c.id}>
                {i > 0 && <Connector join="and" />}
                <div className="fp-suggest-row">
                  <span>
                    <strong>{s.prop}</strong> {s.op} {s.val && <span className="v">{s.val}</span>}
                  </span>
                  <button type="button" className="icon-btn" aria-label={`Discard suggestion: ${s.prop}`} onClick={() => dropSuggestion(c.id)}>
                    <Icon name="x" />
                  </button>
                </div>
              </Fragment>
            )
          })}
          <div className="fp-suggest-actions">
            {confirmReplace ? (
              <>
                <span className="fp-confirm">
                  Replace your {tree.items.length} current filter{tree.items.length === 1 ? '' : 's'}?
                </span>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => acceptAi('replace')}>Replace</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmReplace(false)}>Cancel</button>
              </>
            ) : tree.items.length > 0 ? (
              <>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => acceptAi('add')}>Add to filters</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirmReplace(true)}>Replace current</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={discardAi}>Discard</button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => acceptAi('add')}>Accept</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={discardAi}>Discard</button>
              </>
            )}
          </div>
          <p className="fp-ai-note">Simulated in this prototype: keywords in the description are matched against the sample data.</p>
        </section>
      )}

      <div className="fp-list">
        {tree.items.length === 0 && !aiResult?.length && <p className="fp-empty">No filters yet. Add a filter, or describe who you’re looking for above.</p>}
        {tree.items.length > 1 && (
          <p className="fp-logic">
            Show respondents that match <JoinSelect join={tree.join} onChange={(join) => onTreeChange({ ...tree, join })} label="Respondents match" /> of these filters
          </p>
        )}
        {tree.items.map((item, i) => (
          <Fragment key={item.id}>
            {i > 0 && <Connector join={tree.join} />}
            {item.kind === 'group' ? renderGroup(item) : renderRow(item)}
          </Fragment>
        ))}
      </div>

      {/* Groups are the advanced case ("either of these"), so they get a quieter entry point */}
      <div className="fp-actions">
        <button type="button" className="btn btn-sm btn-outline" onClick={() => addCondition()}>
          <Icon name="plus" />
          Add filter
        </button>
        <span className="fp-group-hint">
          Need “either / or”?
          <button type="button" className="btn-link" onClick={addGroup}>Add a filter group</button>
        </span>
      </div>

      {/* Sticky: the result count stays in view and gives the panel a clear way out */}
      <div className="fp-foot">
        <button type="button" className="btn btn-sm btn-ghost" disabled={tree.items.length === 0} onClick={() => onTreeChange(EMPTY_TREE)}>
          Clear all
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={onDone}>
          Show {resultCount} respondent{resultCount === 1 ? '' : 's'}
        </button>
      </div>
      {menu}
    </>
  )
}
