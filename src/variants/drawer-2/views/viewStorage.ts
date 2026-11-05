import { newCondition } from '../filters/filters'
import { DEFAULT_VIEW_STATE, parseSavedView, parseViewState, type SavedView, type ViewState } from './views'

/**
 * Where saved views and the current user's table setup are kept. Everything goes through this
 * interface, so the localStorage version below can later be swapped for calls to an API.
 */
export interface ViewStorage {
  /** The current user's own views, in the order they were created. */
  loadMyViews(): SavedView[]
  saveMyViews(views: SavedView[]): void
  /** Views other people shared with the team (read-only here). */
  loadSharedViews(): SavedView[]
  /** "All respondents" as the user last left it; null until they change something. */
  loadDefaultState(): ViewState | null
  saveDefaultState(state: ViewState): void
  /** The view open when the page was left, and its unsaved changes (null: no changes). */
  loadSession(): ViewSession
  saveSession(session: ViewSession): void
}

export interface ViewSession {
  /** Null: "All respondents". */
  activeViewId: string | null
  working: ViewState | null
}

const KEYS = {
  myViews: 'respondent-hub:drawer-2:saved-views:v1',
  defaultState: 'respondent-hub:drawer-2:default-view:v1',
  session: 'respondent-hub:drawer-2:view-session:v1',
  // Before saved views, only the column order and pinning were remembered.
  legacyOrder: 'respondent-hub:drawer-2:column-order',
  legacyPinning: 'respondent-hub:drawer-2:column-pinning',
}

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode, blocked site data); changes then last for the session only.
  }
}

/** Sample views from teammates, standing in for what an API would return. */
const SHARED_VIEWS: SavedView[] = [
  {
    id: 'shared-ready',
    name: 'Ready for interviews',
    owner: 'Priya Shah',
    state: {
      ...DEFAULT_VIEW_STATE,
      conditions: [newCondition('consent', ['Signed']), newCondition('tech', ['Completed'])],
      sorting: [{ id: 'interview', desc: false }],
    },
  },
  {
    id: 'shared-consent',
    name: 'Consent follow-up',
    owner: 'Daniel Okafor',
    state: {
      ...DEFAULT_VIEW_STATE,
      conditions: [newCondition('consent', ['Not signed'])],
      columnVisibility: { live: false, tech: false, prior: false, fav: false },
      columnOrder: ['respondent', 'email', 'phone', 'consent'],
      sorting: [{ id: 'source', desc: false }],
    },
  },
]

export const localViewStorage: ViewStorage = {
  loadMyViews() {
    const stored = read(KEYS.myViews)
    return Array.isArray(stored) ? stored.map(parseSavedView).filter((v): v is SavedView => v !== null) : []
  },
  saveMyViews(views) {
    write(KEYS.myViews, views)
  },
  loadSharedViews() {
    return SHARED_VIEWS
  },
  loadDefaultState() {
    const stored = parseViewState(read(KEYS.defaultState))
    if (stored) return stored
    // Keep the column order and pinning people set up before views existed.
    const order = read(KEYS.legacyOrder)
    const pinning = read(KEYS.legacyPinning)
    if (order === null && pinning === null) return null
    return parseViewState({ ...DEFAULT_VIEW_STATE, columnOrder: order, columnPinning: pinning ?? DEFAULT_VIEW_STATE.columnPinning })
  },
  saveDefaultState(state) {
    write(KEYS.defaultState, state)
  },
  loadSession() {
    const stored = read(KEYS.session)
    if (typeof stored !== 'object' || stored === null) return { activeViewId: null, working: null }
    const s = stored as Record<string, unknown>
    return {
      activeViewId: typeof s.activeViewId === 'string' ? s.activeViewId : null,
      working: parseViewState(s.working),
    }
  },
  saveSession(session) {
    write(KEYS.session, session)
  },
}

export const viewStorage: ViewStorage = localViewStorage
