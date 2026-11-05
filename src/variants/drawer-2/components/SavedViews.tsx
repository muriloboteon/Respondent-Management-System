import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { summarize } from '../filters/filters'
import type { SavedViewsApi } from '../views/useSavedViews'
import {
  COLUMN_COUNT,
  DEFAULT_VIEW_NAME,
  VIEW_NAME_MAX,
  describeState,
  viewNameError,
  type SavedView,
  type ViewState,
} from '../views/views'
import { Icon } from './Icon'

const fmt = (n: number) => n.toLocaleString('en-US')

/** What the Manage views modal shows on the right: a view (null: "All respondents"), or "save as new". */
type Selection = { kind: 'view'; id: string | null } | { kind: 'new' }

/**
 * Saved views. The Views button opens the side panel (like Filters and Columns) with the views
 * listed: one click switches the table, and the panel stays open so views can be compared side by
 * side with the table (picking the open view again brings back its saved setup). Saving is always
 * "Save as new view"; what a view contains, renaming, duplicating and deleting live in the Manage
 * views modal.
 */
export function ViewsButton({ views, open, onToggle }: { views: SavedViewsApi; open: boolean; onToggle: () => void }) {
  const name = views.activeView?.name ?? DEFAULT_VIEW_NAME
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline views-btn"
      data-tool="views"
      aria-expanded={open}
      aria-controls="views-panel"
      aria-label={`Views: ${name}`}
      title={`View: ${name}`}
      onClick={onToggle}
    >
      <Icon name="stack" />
      Views
    </button>
  )
}

/** The Views side panel's content: "All respondents", your views, shared views, then Save as new view and Manage views. */
export function ViewsPanel({ views }: { views: SavedViewsApi }) {
  const ref = useRef<HTMLDivElement>(null)
  const [manage, setManage] = useState<Selection | null>(null)
  const activeId = views.activeView?.id ?? null

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.view-item[aria-current="true"]')?.focus({ preventScroll: true })
  }, [])

  const item = (id: string | null, name: string, owner?: string) => (
    <li key={id ?? 'default'}>
      <button type="button" className="view-item" aria-current={id === activeId} onClick={() => views.open(id)}>
        <span className="view-item-text">
          <span className="view-item-name">{name}</span>
          {owner && <span className="view-item-owner">{owner}</span>}
        </span>
        {id === activeId && (
          <span className="view-item-check">
            <Icon name="check" />
          </span>
        )}
      </button>
    </li>
  )

  return (
    <div ref={ref} className="views-body">
      {/* Prototype note: the scope of views is still open. */}
      <div className="wip-note" role="note">
        <Icon name="warningCircleFill" small />
        <strong>Work in progress, needs discovery.</strong>
      </div>
      <ul className="view-list" aria-label="Default view">{item(null, DEFAULT_VIEW_NAME)}</ul>
      {views.myViews.length > 0 && (
        <section className="view-section" aria-labelledby="views-mine">
          <h3 id="views-mine" className="view-heading">Your views</h3>
          <ul className="view-list">{views.myViews.map((v) => item(v.id, v.name))}</ul>
        </section>
      )}
      {views.sharedViews.length > 0 && (
        <section className="view-section" aria-labelledby="views-shared">
          <h3 id="views-shared" className="view-heading">Shared with the team</h3>
          <ul className="view-list">{views.sharedViews.map((v) => item(v.id, v.name, v.owner))}</ul>
        </section>
      )}
      <div className="view-foot">
        <button type="button" className="view-item view-add" onClick={() => setManage({ kind: 'new' })}>
          <Icon name="plus" />
          Save as new view
        </button>
        <button type="button" className="view-item view-add" onClick={() => setManage({ kind: 'view', id: activeId })}>
          <Icon name="arrowsOut" />
          Manage views
        </button>
      </div>
      {manage && <ManageViewsDialog views={views} initial={manage} onClose={() => setManage(null)} />}
    </div>
  )
}

/**
 * Manage views: the views on the left (with a search), the selected one on the right: what it shows
 * and its actions. "Save as new view" asks for a name on the right. Opening a view or saving closes
 * the modal.
 */
function ManageViewsDialog({ views, initial, onClose }: { views: SavedViewsApi; initial: Selection; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [selection, setSelection] = useState<Selection>(initial)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const el = ref.current!
    el.showModal()
    // Start where the work is: the name field when saving, otherwise the selected view.
    requestAnimationFrame(() => {
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('.vm-item[aria-current="true"]')
      target?.focus()
    })
    return () => el.close()
  }, [])

  const close = () => {
    onClose()
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.views-body .view-item[aria-current="true"]')?.focus())
  }

  // A deleted view leaves the list: fall back to "All respondents".
  useEffect(() => {
    if (selection.kind === 'view' && selection.id !== null && !views.find(selection.id)) setSelection({ kind: 'view', id: null })
  }, [views.myViews])

  const activeId = views.activeView?.id ?? null
  const q = query.trim().toLocaleLowerCase()
  const matches = (name: string) => !q || name.toLocaleLowerCase().includes(q)
  const isSelected = (id: string | null) => selection.kind === 'view' && selection.id === id

  const item = (id: string | null, name: string, owner?: string) => (
    <li key={id ?? 'default'}>
      <button type="button" className="vm-item" aria-current={isSelected(id)} onClick={() => setSelection({ kind: 'view', id })}>
        <span className="view-item-text">
          <span className="view-item-name">{name}</span>
          {owner && <span className="view-item-owner">{owner}</span>}
        </span>
        {id === activeId && <span className="vm-in-use">Open</span>}
      </button>
    </li>
  )
  const mine = views.myViews.filter((v) => matches(v.name))
  const shared = views.sharedViews.filter((v) => matches(v.name) || matches(v.owner ?? ''))

  return (
    <dialog
      ref={ref}
      className="modal views-modal"
      aria-labelledby={`${ids}-title`}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="modal-head">
        <h2 id={`${ids}-title`}>Manage views</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
          <Icon name="x" />
        </button>
      </div>
      <div className="vm-body">
        <nav className="vm-nav" aria-label="Views">
          <label className="field field-sm vm-search">
            <Icon name="search" />
            <span className="sr-only">Find a view</span>
            <input type="search" placeholder="Find a view" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="vm-lists">
            {matches(DEFAULT_VIEW_NAME) && <ul className="view-list">{item(null, DEFAULT_VIEW_NAME)}</ul>}
            <h3 className="view-heading">Your views</h3>
            {mine.length ? (
              <ul className="view-list">{mine.map((v) => item(v.id, v.name))}</ul>
            ) : (
              <p className="view-empty">{q ? 'No matches.' : 'None yet. Set up the table, then save it as a view.'}</p>
            )}
            {views.sharedViews.length > 0 && (
              <>
                <h3 className="view-heading">Shared with the team</h3>
                {shared.length ? <ul className="view-list">{shared.map((v) => item(v.id, v.name, v.owner))}</ul> : <p className="view-empty">No matches.</p>}
              </>
            )}
          </div>
          <button type="button" className="vm-item view-add" aria-current={selection.kind === 'new'} onClick={() => setSelection({ kind: 'new' })}>
            <Icon name="plus" />
            Save as new view
          </button>
        </nav>

        <section className="vm-detail" aria-live="polite">
          {selection.kind === 'new' ? (
            <NewViewPane
              views={views}
              onSaved={close}
              onCancel={() => setSelection({ kind: 'view', id: activeId })}
            />
          ) : (
            <ViewPane
              key={selection.id ?? 'default'}
              views={views}
              view={views.find(selection.id)}
              onSelect={setSelection}
              onDone={close}
            />
          )}
        </section>
      </div>
    </dialog>
  )
}

/** One view: name (renamed in place), who it belongs to, what it shows, and actions. */
function ViewPane({
  views,
  view,
  onSelect,
  onDone,
}: {
  views: SavedViewsApi
  /** Null: "All respondents". */
  view: SavedView | null
  onSelect: (s: Selection) => void
  onDone: () => void
}) {
  const id = view?.id ?? null
  const own = view !== null && !view.owner
  const isOpen = (views.activeView?.id ?? null) === id
  const state = views.stateOf(id)
  const [renaming, setRenaming] = useState(false)

  return (
    <div className="vm-pane">
      <header className="vm-pane-head">
        {renaming && view ? (
          <RenameField views={views} view={view} onDone={() => setRenaming(false)} />
        ) : (
          <h3 className="vm-title">{view?.name ?? DEFAULT_VIEW_NAME}</h3>
        )}
        <span className="vm-count">{fmt(views.count(state))} respondents</span>
      </header>
      <p className="vm-owner">
        {view === null
          ? 'Default view. Keeps your changes automatically, no need to save.'
          : view.owner
            ? `Shared by ${view.owner}. Read-only: duplicate it to make your own version.`
            : 'Your view'}
      </p>

      <ViewFacts state={state} />

      <footer className="vm-actions">
        {isOpen ? (
          <span className="vm-open-note">
            <Icon name="check" small />
            Open now
          </span>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { views.open(id); onDone() }}>
            Open view
          </button>
        )}
        <div className="vm-actions-end">
          {own && !renaming && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(true)}>
              <Icon name="pencil" />
              Rename
            </button>
          )}
          {view && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const copy = views.duplicate(view.id)
                if (copy) onSelect({ kind: 'view', id: copy })
              }}
            >
              <Icon name="copy" />
              Duplicate
            </button>
          )}
          {own && (
            <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => views.remove(view.id)}>
              <Icon name="trash" />
              Delete
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

/** Filters (as chips), columns, pinned columns and sort of a setup. */
function ViewFacts({ state, heading }: { state: ViewState; heading?: string }) {
  const d = describeState(state)
  return (
    <div className="vm-facts-wrap">
      {heading && <p className="vm-facts-heading">{heading}</p>}
      <dl className="vm-facts">
        <div>
          <dt>Filters</dt>
          <dd>
            {d.conditions.length ? (
              <span className="vm-chips">
                {d.conditions.map((c) => {
                  const s = summarize(c)
                  return (
                    <span key={c.id + c.prop} className="chip vm-chip">
                      <span className="k">{s.op ? s.prop : `${s.prop}:`}</span>
                      {s.op && <span className="op">{s.op}</span>}
                      <span className="v">{s.val}</span>
                    </span>
                  )
                })}
              </span>
            ) : (
              'None, everyone shows'
            )}
          </dd>
        </div>
        <div>
          <dt>Columns</dt>
          <dd>
            {d.shown} of {COLUMN_COUNT} shown{d.orderChanged ? ', custom order' : ''}
            {d.hidden.length > 0 && <span className="vm-sub" title={d.hidden.join(', ')}>Hidden: {d.hidden.join(', ')}</span>}
          </dd>
        </div>
        <div>
          <dt>Pinned</dt>
          <dd>{d.pinned.length ? `Respondent, ${d.pinned.join(', ')}` : 'Respondent'}</dd>
        </div>
        <div>
          <dt>Sort</dt>
          <dd>{d.sort}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Shared name field: required, at most 60 characters, unique among your views. */
function useNameField(views: SavedViewsApi, initialName: string, exceptId?: string) {
  const [name, setName] = useState(initialName)
  const [submitted, setSubmitted] = useState(false)
  const error = viewNameError(name, views.myViews, exceptId)
  // Too long shows while typing; empty or taken once saving is tried (then live).
  const shown = error && (submitted || name.trim().length > VIEW_NAME_MAX) ? error : null
  return { name, setName, error, shown, submit: () => setSubmitted(true) }
}

function NameError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null
  return (
    <p id={id} className="field-error">
      <Icon name="warningCircleFill" small />
      {message}
    </p>
  )
}

/** Renames in place: Enter saves, Escape cancels (without closing the modal). */
function RenameField({ views, view, onDone }: { views: SavedViewsApi; view: SavedView; onDone: () => void }) {
  const ids = useId()
  const field = useNameField(views, view.name, view.id)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.select(), [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    field.submit()
    if (field.error) return input.current?.focus()
    if (field.name.trim() !== view.name) views.rename(view.id, field.name)
    onDone()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    onDone()
  }

  return (
    <form className="vm-rename" onSubmit={submit} noValidate>
      <div className={field.shown ? 'field field-sm is-invalid' : 'field field-sm'}>
        <input
          ref={input}
          type="text"
          aria-label="View name"
          autoComplete="off"
          value={field.name}
          aria-invalid={field.shown ? true : undefined}
          aria-describedby={field.shown ? `${ids}-error` : undefined}
          onChange={(e) => field.setName(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <button type="submit" className="btn btn-sm btn-primary">Save</button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onDone}>Cancel</button>
      <NameError id={`${ids}-error`} message={field.shown} />
    </form>
  )
}

/**
 * Save the table as it is now as a new view of yours: a name, and a preview of what it keeps.
 * This is the only way to save; changes on an open view never overwrite it.
 */
function NewViewPane({ views, onSaved, onCancel }: { views: SavedViewsApi; onSaved: () => void; onCancel: () => void }) {
  const ids = useId()
  const field = useNameField(views, '')
  const input = useRef<HTMLInputElement>(null)
  const shared = views.activeView?.owner ? views.activeView : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    field.submit()
    if (field.error) return input.current?.focus()
    views.saveNew(field.name)
    onSaved()
  }

  return (
    <form className="vm-pane" onSubmit={submit} noValidate>
      <header className="vm-pane-head">
        <h3 className="vm-title">Save as new view</h3>
        <span className="vm-count">{fmt(views.count(views.current))} respondents</span>
      </header>
      <p className="vm-owner">
        {shared
          ? `“${shared.name}” is shared by ${shared.owner}, so it can’t be changed. This saves your setup as a new view of yours.`
          : 'Keeps the filters, visible columns, column order, pinned columns and sort shown now.'}
      </p>
      <div className="form-field">
        <label htmlFor={`${ids}-name`} className="form-label">Name</label>
        <div className={field.shown ? 'field field-sm is-invalid' : 'field field-sm'}>
          <input
            ref={input}
            id={`${ids}-name`}
            data-autofocus=""
            type="text"
            autoComplete="off"
            placeholder="UK, consent pending"
            value={field.name}
            aria-invalid={field.shown ? true : undefined}
            aria-describedby={field.shown ? `${ids}-error` : undefined}
            onChange={(e) => field.setName(e.target.value)}
          />
        </div>
        <NameError id={`${ids}-error`} message={field.shown} />
      </div>
      <ViewFacts state={views.current} heading="What it keeps" />
      <footer className="vm-actions">
        <button type="submit" className="btn btn-sm btn-primary">Save view</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
      </footer>
    </form>
  )
}
