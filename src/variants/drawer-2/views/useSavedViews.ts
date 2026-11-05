import { useEffect, useMemo, useState } from 'react'
import type { ToastMessage } from '../components/Toast'
import { viewStorage } from './viewStorage'
import {
  DEFAULT_VIEW_STATE,
  copyName,
  forTable,
  newViewId,
  sameViewState,
  snapshot,
  type SavedView,
  type ViewState,
} from './views'

export interface InitialSetup {
  myViews: SavedView[]
  /** Null: "All respondents". */
  activeViewId: string | null
  /** What the table opens with. */
  state: ViewState
}

/** The view open when the page was left (with its unsaved changes), or "All respondents" as last left. */
export function loadInitialSetup(): InitialSetup {
  const myViews = viewStorage.loadMyViews()
  const session = viewStorage.loadSession()
  const view = [...myViews, ...viewStorage.loadSharedViews()].find((v) => v.id === session.activeViewId)
  if (view) return { myViews, activeViewId: view.id, state: forTable(session.working ?? view.state) }
  return { myViews, activeViewId: null, state: forTable(viewStorage.loadDefaultState() ?? DEFAULT_VIEW_STATE) }
}

type Notify = (text: string, action?: ToastMessage['action']) => void

/**
 * Saved views on top of the table's own state: which view is open, whether the table still matches
 * it, and the actions of the Views menu and the Manage views modal. `current` is the table's setup;
 * `apply` replaces it; `count` says how many respondents in the project a setup shows.
 */
export function useSavedViews({
  initial,
  current,
  apply,
  count,
  notify,
}: {
  initial: InitialSetup
  current: ViewState
  apply: (state: ViewState) => void
  count: (state: ViewState) => number
  notify: Notify
}) {
  const [myViews, setMyViews] = useState(initial.myViews)
  const sharedViews = useMemo(() => viewStorage.loadSharedViews(), [])
  const [activeId, setActiveId] = useState(initial.activeViewId)
  const find = (id: string | null) => myViews.find((v) => v.id === id) ?? sharedViews.find((v) => v.id === id) ?? null

  const activeView = find(activeId)
  /**
   * The table no longer matches the open view. Not shown anywhere: it only decides whether the
   * changes are kept for the next visit. Picking the view again brings back its saved setup.
   */
  const edited = activeView !== null && !sameViewState(current, activeView.state)

  useEffect(() => viewStorage.saveMyViews(myViews), [myViews])

  // "All respondents" remembers every change; a saved view keeps its changes for the next visit
  // (without touching the view) until it is picked again or another view is opened.
  const currentJson = JSON.stringify(snapshot(current))
  useEffect(() => {
    const state = JSON.parse(currentJson) as ViewState
    if (activeView === null) {
      viewStorage.saveDefaultState(state)
      viewStorage.saveSession({ activeViewId: null, working: null })
    } else {
      viewStorage.saveSession({ activeViewId: activeView.id, working: edited ? state : null })
    }
  }, [currentJson, activeView?.id, edited])

  /** "All respondents" as last left: the table itself while it's open. */
  const defaultState = () => (activeView === null ? snapshot(current) : (viewStorage.loadDefaultState() ?? DEFAULT_VIEW_STATE))

  /** The saved setup of a view (null: "All respondents"). */
  const stateOf = (id: string | null) => find(id)?.state ?? defaultState()

  /** Applies a view (null: "All respondents"). */
  const open = (id: string | null) => {
    const view = find(id)
    apply(forTable(view ? view.state : defaultState()))
    setActiveId(view ? view.id : null)
  }

  /** Saves the table as a new view of mine and opens it; returns its id. */
  const saveNew = (name: string) => {
    const view: SavedView = { id: newViewId(), name: name.trim(), state: snapshot(current) }
    setMyViews((prev) => [...prev, view])
    setActiveId(view.id)
    notify(`View “${view.name}” saved`)
    return view.id
  }

  const rename = (id: string, name: string) => {
    const next = name.trim()
    setMyViews((prev) => prev.map((v) => (v.id === id ? { ...v, name: next } : v)))
    notify(`View renamed to “${next}”`)
  }

  /** Copies a view (mine or shared) into My views; returns the copy's id. */
  const duplicate = (id: string) => {
    const source = find(id)
    if (!source) return null
    const copy: SavedView = { id: newViewId(), name: copyName(source.name, myViews), state: snapshot(source.state) }
    setMyViews((prev) => [...prev, copy])
    notify(`“${copy.name}” added to your views`)
    return copy.id
  }

  /** Deletes right away; the toast's Undo puts the view back where it was (and reopens it if it was open). */
  const remove = (id: string) => {
    const at = myViews.findIndex((v) => v.id === id)
    if (at < 0) return
    const view = myViews[at]
    const wasOpen = activeId === id
    const working = wasOpen ? snapshot(current) : null
    setMyViews((prev) => prev.filter((v) => v.id !== id))
    if (wasOpen) {
      apply(forTable(viewStorage.loadDefaultState() ?? DEFAULT_VIEW_STATE))
      setActiveId(null)
    }
    notify(`View “${view.name}” deleted`, {
      label: 'Undo',
      onClick: () => {
        setMyViews((prev) => (prev.some((v) => v.id === id) ? prev : [...prev.slice(0, at), view, ...prev.slice(at)]))
        if (working) {
          apply(forTable(working))
          setActiveId(id)
        }
        notify(`View “${view.name}” restored`)
      },
    })
  }

  return {
    myViews,
    sharedViews,
    activeView,
    current,
    find,
    stateOf,
    count,
    open,
    saveNew,
    rename,
    duplicate,
    remove,
  }
}

export type SavedViewsApi = ReturnType<typeof useSavedViews>
