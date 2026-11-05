import {
  functionalUpdate,
  useTable,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Toast, type ToastMessage } from './components/Toast'
import { loadInitialSetup, useSavedViews } from './views/useSavedViews'
import type { ViewState } from './views/views'
import { DETAIL_MAX_W, DETAIL_MIN_W, DetailPanel } from './components/DetailPanel'
import { Icon } from './components/Icon'
import { PasteImportDialog } from './components/PasteImportDialog'
import { FloatingMenu, type MenuItem } from './components/FloatingMenu'
import { FILTER_DEFAULT_W, FILTER_MAX_W, FILTER_MIN_W, FilterPanel } from './components/FilterPanel'
import { ListHeader, type Panel } from './components/ListHeader'
import { OrgRail } from './components/OrgRail'
import { ProjectSidebar, ProjectSidebarToggle } from './components/ProjectSidebar'
import { RespondentsTable } from './components/RespondentsTable'
import { RemoveConfirm } from './components/RemoveConfirm'
import { SelfCaptureHistoryDialog } from './components/SelfCaptureHistoryDialog'
import { TechCheckDialog } from './components/TechCheckDialog'
import { ASSIGN_ITEMS, SEGMENT_ITEMS } from './components/respondentActions'
import { TOTAL_RESPONDENTS, projectCount, respondents, type Respondent } from '@data/respondents'
import {
  EMPTY_FILTERS,
  activeMetric,
  applyCondition,
  cellFilterValues,
  matchesConditions,
  matchesFilters,
  metricConditions,
  newCondition,
  type Filters,
} from './filters/filters'
import { propertyForColumn } from './filters/properties'
import { MetricStrip } from './components/MetricStrip'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useStoredState } from './hooks/useStoredState'
import { moveColumn, shownNeighbour } from './table/columnOrder'
import { DEFAULT_COLUMN_SIZING, isDefaultColumnSizing, loadColumnSizing, saveColumnSizing } from './table/columnSizingStorage'
import {
  PINNED_WIDTH_SHARE,
  columns,
  features,
  respondentFilter,
  type MenuState,
  type RecordingKind,
} from './table/respondentsTable'

/** Paste-from-spreadsheet import (button and page-wide paste); hidden for now. */
const PASTE_IMPORT_ENABLED = false

/** True when a paste lands somewhere that should keep its normal paste behaviour. */
function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], dialog') !== null
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const fmtCount = (n: number) => n.toLocaleString('en-US')
/** Width of the left navigation (org rail, plus the project sidebar when open); matches --nav-w in app.css. */
const navWidth = (projectNavOpen: boolean) => 72 + (projectNavOpen ? 240 : 0)
/** Keeps a docked panel within its limits and leaves room for the table beside the left navigation. */
const clampPanelWidth = (w: number, min: number, max: number, projectNavOpen: boolean) =>
  Math.round(Math.max(min, Math.min(w, max, window.innerWidth - navWidth(projectNavOpen) - 640)))
const clampDetailWidth = (w: number, projectNavOpen: boolean) => clampPanelWidth(w, DETAIL_MIN_W, DETAIL_MAX_W, projectNavOpen)
const clampFilterWidth = (w: number, projectNavOpen: boolean) => clampPanelWidth(w, FILTER_MIN_W, FILTER_MAX_W, projectNavOpen)

export function App() {
  const [data, setData] = useState<Respondent[]>(respondents)
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set())
  /** Clipboard text for the paste dialog: null when closed, '' when opened from the button. */
  const [pasteText, setPasteText] = useState<string | null>(null)
  const [lastAdded, setLastAdded] = useState<{ ids: string[]; hidden: number } | null>(null)
  /** The view open when the page was left, or "All respondents" as the user last left it. */
  const [initialSetup] = useState(loadInitialSetup)
  const [filters, setFilters] = useState<Filters>({ query: '', conditions: initialSetup.state.conditions })
  /** The table is scrolled away from its top, so the metric strip condenses. */
  const [tableScrolled, setTableScrolled] = useState(false)
  // Filters, sorting, visible columns, order and pinning make up a view (see views/views.ts);
  // column widths are remembered on their own and never need a Save.
  const [sorting, setSorting] = useState<SortingState>(initialSetup.state.sorting)
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(initialSetup.state.columnVisibility)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadColumnSizing)
  /** Respondent is always pinned first; people can pin more columns after it from the column menu. */
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialSetup.state.columnPinning)
  /** Empty keeps the definition order; ids no longer in the table are skipped and new columns go last. */
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(initialSetup.state.columnOrder)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = (text: string, action?: ToastMessage['action']) => setToast({ id: Date.now(), text, action })
  const currentView: ViewState = { conditions: filters.conditions, columnVisibility, columnOrder, columnPinning, sorting }
  const views = useSavedViews({
    initial: initialSetup,
    current: currentView,
    apply: (s) => {
      setFilters({ query: '', conditions: s.conditions })
      setSorting(s.sorting)
      setColumnVisibility(s.columnVisibility)
      setColumnOrder(s.columnOrder)
      setColumnPinning(s.columnPinning)
    },
    // Respondents in the whole project a setup's filters show (the search is not part of a view).
    count: (s) => projectCount(data.filter((r) => matchesConditions(r, s.conditions)).length, data.length, total),
    notify,
  })
  /** Visible width of the table's scroll area; caps how much of it pinned columns may take. */
  const [tableWidth, setTableWidth] = useState(0)
  const pinLimit = tableWidth * PINNED_WIDTH_SHARE
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  /** The detail is shown as a centered modal instead of the side panel. */
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [detailWidth, setDetailWidth] = useStoredState('respondent-hub:drawer-2:detail-width', 440, isNumber)
  const [filterWidth, setFilterWidth] = useStoredState('respondent-hub:drawer-2:filter-width', FILTER_DEFAULT_W, isNumber)
  const [projectNavOpen, setProjectNavOpen] = useStoredState('respondent-hub:drawer-2:project-nav-open', true, isBoolean)
  const [panel, setPanel] = useState<Panel>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  /**
   * The filters drawer, in the detail panel's place (null when closed). `prop` is the section to
   * open and scroll to (a chip, a column's "Filter…"); a new `seq` asks again while it's open.
   */
  const [filterPanel, setFilterPanel] = useState<{ prop: string | null; seq: number } | null>(null)
  /** A row whose name should turn into a text field ("Rename" in the row menu). */
  const [renamingId, setRenamingId] = useState<string | null>(null)
  /** The "more actions" menu next to Upload Respondents. */
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  /** Respondents waiting on the remove confirmation. */
  const [removing, setRemoving] = useState<string[] | null>(null)
  /** The recordings open for a row: its self captures list, or its tech check video. */
  const [playing, setPlaying] = useState<{ id: string; kind: RecordingKind } | null>(null)
  const playingRespondent = playing ? data.find((r) => r.id === playing.id) : undefined

  const isWide = useMediaQuery('(min-width: 1280px)')
  const closeBtn = useRef<HTMLButtonElement>(null)

  // The respondent detail and the filters share the side panel: opening one closes the other.
  const openDetail = (id: string) => {
    setFilterPanel(null)
    setSelectedId(id)
    setDrawerOpen(true)
    setMenu(null)
  }
  const closeDetail = () => {
    const id = selectedId
    setSelectedId(null)
    setDrawerOpen(false)
    setDetailExpanded(false)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-opener="${id}"]`)?.focus())
  }
  const openFilters = (prop: string | null) => {
    setSelectedId(null)
    setDrawerOpen(false)
    setDetailExpanded(false)
    setMenu(null)
    setPanel(null)
    setFilterPanel((cur) => ({ prop, seq: (cur?.seq ?? 0) + 1 }))
  }
  const closeFilters = () => {
    setFilterPanel(null)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-filters-toggle]')?.focus())
  }
  const closeSidePanel = () => (filterPanel ? closeFilters() : closeDetail())

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (r) => r.id,
    state: {
      globalFilter: filters,
      sorting,
      columnVisibility,
      columnSizing,
      rowSelection,
      columnPinning,
      columnOrder,
    },
    onGlobalFilterChange: (updater) => setFilters((prev) => functionalUpdate(updater, prev)),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onColumnPinningChange: (updater) => setColumnPinning((prev) => functionalUpdate(updater, prev)),
    onColumnOrderChange: (updater) => setColumnOrder((prev) => functionalUpdate(updater, prev)),
    defaultColumn: { minSize: 90, maxSize: 600 },
    columnResizeMode: 'onChange',
    globalFilterFn: respondentFilter,
    getColumnCanGlobalFilter: (column) => column.id === 'respondent',
    enableMultiSort: false,
    enableSortingRemoval: false,
    meta: {
      selectedId,
      newIds,
      menu,
      renamingId,
      onRenameStarted: () => setRenamingId(null),
      onOpen: openDetail,
      onToggleMenu: (next) => {
        setPanel(null)
        setMenu((cur) => (cur && cur.type === next.type && cur.id === next.id ? null : next))
      },
      onCellMenu: (rowId, columnId) => {
        const prop = propertyForColumn(columnId)
        const r = data.find((x) => x.id === rowId)
        if (!prop || !r || !cellFilterValues(prop, r).length) return false
        setPanel(null)
        setMenu({ type: 'cell', id: rowId, col: columnId })
        return true
      },
      onUpdate: (id, patch) => setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
      onPlay: (id, kind) => {
        setMenu(null)
        setPlaying({ id, kind })
      },
    },
  })

  // Save widths once a drag ends (sizing updates on every pointer move while dragging).
  const isResizing = table.state.columnResizing.isResizingColumn !== false
  useEffect(() => {
    if (!isResizing) saveColumnSizing(columnSizing)
  }, [columnSizing, isResizing])

  // Pasting spreadsheet rows anywhere on the page (outside form fields) opens the preview.
  useEffect(() => {
    if (!PASTE_IMPORT_ENABLED || pasteText !== null) return
    const onPaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      // Only multi-cell selections (tabs or line breaks); a single copied value pastes normally.
      if (!/[\t\n]/.test(text.trim())) return
      e.preventDefault()
      setPanel(null)
      setMenu(null)
      setPasteText(text)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [pasteText])

  const addRespondents = (added: Respondent[]) => {
    setData((d) => [...d, ...added])
    setNewIds((ids) => new Set([...ids, ...added.map((r) => r.id)]))
    setLastAdded({ ids: added.map((r) => r.id), hidden: added.filter((r) => !matchesFilters(r, filters)).length })
    setPasteText(null)
  }
  const undoAdd = () => {
    if (!lastAdded) return
    const ids = new Set(lastAdded.ids)
    setData((d) => d.filter((r) => !ids.has(r.id)))
    setNewIds((cur) => new Set([...cur].filter((id) => !ids.has(id))))
    setRowSelection((sel) => Object.fromEntries(Object.entries(sel).filter(([id]) => !ids.has(id))))
    if (selectedId && ids.has(selectedId)) setSelectedId(null)
    setLastAdded(null)
  }
  /** Opens the remove confirmation; the bulk actions, row menu and detail panel all use it. */
  const askRemove = (ids: string[]) => {
    setMenu(null)
    setRemoving(ids)
  }
  const removeRespondents = (ids: ReadonlySet<string>) => {
    setData((d) => d.filter((r) => !ids.has(r.id)))
    setNewIds((cur) => new Set([...cur].filter((id) => !ids.has(id))))
    setRowSelection((sel) => Object.fromEntries(Object.entries(sel).filter(([id]) => !ids.has(id))))
    if (selectedId && ids.has(selectedId)) {
      setSelectedId(null)
      setDrawerOpen(false)
      setDetailExpanded(false)
    }
    setLastAdded(null)
  }

  const selected = data.find((r) => r.id === selectedId) ?? null
  const filtersOpen = filterPanel !== null
  /** On narrow screens the side panel slides over the table. */
  const asDialog = !isWide
  /** Expanded: the detail opens as a centered modal at any width. */
  const modalOpen = selected !== null && detailExpanded
  const drawerOverlay = asDialog && (filtersOpen || (selected !== null && drawerOpen && !detailExpanded))
  const overlayOpen = drawerOverlay || modalOpen
  const docked = !asDialog && (filtersOpen || (selected !== null && !detailExpanded))
  const panelWidth = filtersOpen ? clampFilterWidth(filterWidth, projectNavOpen) : clampDetailWidth(detailWidth, projectNavOpen)

  // Previous / next follow the table's current order (sorting and filters).
  const order = table.getRowModel().rows.map((row) => row.id)
  const at = selectedId ? order.indexOf(selectedId) : -1
  const prevId = at > 0 ? order[at - 1] : null
  const nextId = at >= 0 && at < order.length - 1 ? order[at + 1] : null

  // Modal or drawer: lock page scroll, move focus in, close on Escape.
  useEffect(() => {
    document.body.classList.toggle('scroll-lock', overlayOpen)
    if (!overlayOpen) return
    if (!document.activeElement?.closest('.detail')) closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && !document.querySelector('dialog[open], .menu') && closeSidePanel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlayOpen, filtersOpen])

  const pickedCount = data.filter((r) => rowSelection[r.id]).length
  const total = TOTAL_RESPONDENTS + data.length - respondents.length
  const metric = activeMetric('all', filters)
  /** Respondents the filters and search leave, scaled from the loaded sample to the whole project. */
  const shownCount = projectCount(table.getFilteredRowModel().rows.length, data.length, total)

  let menuNode = null
  if (menu?.type === 'col') {
    const column = table.getColumn(menu.id)
    if (column) {
      const header = String(column.columnDef.header)
      // The MUI X Data Grid column menu: sorting, filtering, pinning, moving, then columns, each group divided.
      // Items that don't apply to the column are left out rather than disabled.
      const groups: MenuItem[][] = []
      if (column.getCanSort()) {
        const sorted = column.getIsSorted()
        groups.push([
          ...(sorted !== 'asc' ? [{ label: 'Sort by ASC', icon: 'arrowUp', onSelect: () => column.toggleSorting(false) } as const] : []),
          ...(sorted !== 'desc' ? [{ label: 'Sort by DESC', icon: 'arrowDown', onSelect: () => column.toggleSorting(true) } as const] : []),
          ...(sorted ? [{ label: 'Unsort', onSelect: () => column.clearSorting() }] : []),
        ])
      }
      // Opens the filters drawer on this column's section.
      const filterProp = propertyForColumn(column.id)
      if (filterProp) {
        groups.push([{ label: 'Filter…', icon: 'funnel', onSelect: () => openFilters(filterProp.id) }])
      }
      // Respondent can't be pinned or unpinned (it is always pinned).
      if (column.getCanPin() && column.getIsPinned()) {
        groups.push([{ label: 'Unpin', onSelect: () => column.pin(false) }])
      } else if (column.getCanPin()) {
        // Pinned columns, this one included, must fit in the limit; otherwise say how to make room.
        const pinnedWidth = table.getStartVisibleLeafColumns().reduce((w, c) => w + c.getSize(), 0)
        groups.push([
          pinnedWidth + column.getSize() <= pinLimit
            ? { label: 'Pin to left', icon: 'pin', onSelect: () => column.pin('start') }
            : { label: 'Pin to left', icon: 'pin', disabled: true, description: 'Unpin a column to pin this one' },
        ])
      }
      // Moves past the next shown column; pinned columns move only among the pinned ones.
      const left = shownNeighbour(table, column, -1)
      const right = shownNeighbour(table, column, 1)
      if (left || right) {
        groups.push([
          ...(left ? [{ label: 'Move left', icon: 'arrowLeft', onSelect: () => moveColumn(table, column.id, left.id, 'before') } as const] : []),
          ...(right ? [{ label: 'Move right', icon: 'arrowRight', onSelect: () => moveColumn(table, column.id, right.id, 'after') } as const] : []),
        ])
      }
      groups.push([
        ...(column.getCanHide() ? [{ label: 'Hide column', icon: 'eyeSlash', onSelect: () => column.toggleVisibility(false) } as const] : []),
        // The Columns panel lives in the list header; its button opens it.
        {
          label: 'Manage columns',
          icon: 'columns',
          onSelect: () => document.querySelector<HTMLButtonElement>('[aria-controls="panel-cols"]')?.click(),
        },
        // Widths are remembered per user without a Save; only offered once a column was resized.
        ...(isDefaultColumnSizing(columnSizing)
          ? []
          : [
              {
                label: 'Reset column widths',
                icon: 'arrowCounterClockwise',
                onSelect: () => {
                  setColumnSizing(DEFAULT_COLUMN_SIZING)
                  notify('Column widths reset')
                },
              } as const,
            ]),
      ])
      const items = groups.flatMap((group, g) => group.map((item, i) => ({ ...item, separatorBefore: g > 0 && i === 0 })))
      menuNode = (
        <FloatingMenu
          anchorKey={`col:${column.id}`}
          label={`Column options: ${header}`}
          align="end"
          items={items}
          onClose={() => setMenu(null)}
        />
      )
    }
  } else if (menu?.type === 'row') {
    const r = data.find((x) => x.id === menu.id)
    if (r) {
      menuNode = (
        <FloatingMenu
          anchorKey={`row:${r.id}`}
          label={`Actions for ${r.name}`}
          align="start"
          width={224}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Open details', onSelect: () => openDetail(r.id) },
            { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(r.id) },
            ...ASSIGN_ITEMS.map((item, i) => ({ ...item, separatorBefore: i === 0, heading: i === 0 ? 'Assign' : undefined })),
            ...SEGMENT_ITEMS.map((item, i) => ({ ...item, separatorBefore: i === 0, heading: i === 0 ? 'Segment' : undefined })),
            { label: 'Export to CSV', icon: 'download', separatorBefore: true },
            { label: 'Remove from project', icon: 'trash', danger: true, separatorBefore: true, onSelect: () => askRemove([r.id]) },
          ]}
        />
      )
    }
  } else if (menu?.type === 'cell') {
    // Right-click (or the menu key) on a cell: filter by its value, or leave it out, in one step.
    const r = data.find((x) => x.id === menu.id)
    const prop = propertyForColumn(menu.col)
    if (r && prop) {
      const text = prop.type === 'text'
      const filterBy = (value: string, exclude: boolean) =>
        setFilters((prev) => ({
          ...prev,
          conditions: applyCondition(prev.conditions, newCondition(prop.id, [value], text ? (exclude ? 'not_contains' : 'contains') : exclude ? 'is_not' : 'is')),
        }))
      // A multi-value cell offers its first tags.
      const items: MenuItem[] = cellFilterValues(prop, r)
        .slice(0, 3)
        .flatMap(([value, label], i) => [
          { label: `Filter by “${label}”`, icon: 'funnel', separatorBefore: i > 0, onSelect: () => filterBy(value, false) },
          { label: `Exclude “${label}”`, icon: 'eyeSlash', onSelect: () => filterBy(value, true) },
        ])
      menuNode = (
        <FloatingMenu
          anchorKey={`ctx:${r.id}:${menu.col}`}
          label={`Filter by this ${prop.label} value`}
          align="start"
          width={240}
          onClose={() => setMenu(null)}
          items={items}
        />
      )
    }
  }

  return (
    <div
      className={[drawerOverlay && 'is-drawer-open', modalOpen && 'is-detail-modal', docked && 'is-docked', panel && 'panel-open', projectNavOpen && 'is-project-nav-open',
        tableScrolled && 'metrics-condensed']
        .filter(Boolean)
        .join(' ')}
      style={{ '--detail-w': `${panelWidth}px` } as CSSProperties}
    >
      <OrgRail />
      <ProjectSidebar hidden={!projectNavOpen} current={{ section: 'Fielding', item: 'Respondents' }} />
      <main className="page" id="respondents">
        <header className="page-head">
          <div className="title-group">
            <ProjectSidebarToggle open={projectNavOpen} onToggle={() => setProjectNavOpen(!projectNavOpen)} />
            <h1 id="list-h">Respondents</h1>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-outline btn-icon"
              data-menu-anchor="page:more"
              aria-label="More actions"
              title="More actions"
              aria-haspopup="menu"
              aria-expanded={pageMenuOpen}
              onClick={() => {
                setPanel(null)
                setMenu(null)
                setPageMenuOpen(!pageMenuOpen)
              }}
            >
              <Icon name="dotsVertical" />
            </button>
            <button type="button" className="btn btn-primary">
              <Icon name="upload" />
              Upload Respondents
            </button>
          </div>
        </header>
        {/* Placeholder options: they only close the menu for now */}
        {pageMenuOpen && (
          <FloatingMenu
            anchorKey="page:more"
            label="More actions"
            align="end"
            onClose={() => setPageMenuOpen(false)}
            items={[
              // Leads to another page (none yet), hence the trailing arrow and the divider below it
              { label: 'Manage Segments', icon: 'chartDonut', description: 'Go to the Segments page', trailingIcon: 'arrowRight' },
              { label: 'New Custom Column', icon: 'plus', description: 'Add a blank column to the end of the table', separatorBefore: true },
              { label: 'Recreate custom columns as segments', icon: 'arrowsLeftRight', description: 'Create segments from existing custom columns' },
            ]}
          />
        )}
        <MetricStrip
          data={data}
          total={total}
          active={metric}
          condensed={tableScrolled}
          onSelect={(id) => {
            // Like a status tab: only this metric's filter; picking the active metric again goes
            // back to everyone. The other parts of the open view stay as they are.
            setFilters({ query: '', conditions: metricConditions(metric === id ? 'all' : id) })
          }}
        />
        <div className="layout">
          <section className="card list-card" aria-labelledby="list-h">
            <ListHeader
              table={table}
              total={total}
              filters={filters}
              onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              views={views}
              panel={panel}
              onPanelChange={(p) => {
                setMenu(null)
                setPanel(p)
              }}
              filtersOpen={filtersOpen}
              onToggleFilters={() => (filtersOpen ? closeFilters() : openFilters(null))}
              onEditFilter={openFilters}
              pickedCount={pickedCount}
              onRemovePicked={() => askRemove(data.filter((r) => rowSelection[r.id]).map((r) => r.id))}
              onPasteClick={PASTE_IMPORT_ENABLED ? () => setPasteText('') : undefined}
              notice={
                lastAdded && (
                  <div className="notice" role="status">
                    <Icon name="check" />
                    <span>
                      <strong>{lastAdded.ids.length} respondent{lastAdded.ids.length === 1 ? '' : 's'} added</strong>
                      {lastAdded.hidden > 0 && ` · ${lastAdded.hidden} hidden by the current filters`}
                    </span>
                    {lastAdded.hidden > 0 && (
                      <button type="button" className="btn-link" onClick={() => setFilters(EMPTY_FILTERS)}>
                        Show all respondents
                      </button>
                    )}
                    <button type="button" className="btn-link" onClick={undoAdd}>Undo</button>
                    <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setLastAdded(null)}>
                      <Icon name="x" />
                    </button>
                  </div>
                )
              }
            />
            <RespondentsTable table={table} pinLimit={pinLimit} onWidthChange={setTableWidth} onScrolledChange={setTableScrolled} />
            {/* Status bar under the grid (as in AG Grid / MUI X): rows shown and rows picked. Screen readers
                hear the same through the status region in the list header. */}
            <div className="table-status" aria-hidden="true">
              <span>
                Respondents: <strong>{fmtCount(shownCount)}</strong>
                {shownCount !== total && <> of {fmtCount(total)}</>}
              </span>
              {pickedCount > 0 && (
                <span>
                  Selected: <strong>{fmtCount(pickedCount)}</strong>
                </span>
              )}
            </div>
          </section>

          {filterPanel && (
            <FilterPanel
              filters={filters}
              data={data}
              toProject={(n) => projectCount(n, data.length, total)}
              asDialog={asDialog}
              resizable={docked}
              width={panelWidth}
              onWidthChange={(w) => setFilterWidth(clampFilterWidth(w, projectNavOpen))}
              focus={filterPanel}
              closeRef={closeBtn}
              onConditionsChange={(conditions) => setFilters((prev) => ({ ...prev, conditions }))}
              onClose={closeFilters}
            />
          )}
          {selected && !filterPanel && (
            <DetailPanel
              r={selected}
              all={data}
              asDialog={asDialog || modalOpen}
              resizable={docked}
              width={panelWidth}
              hidden={asDialog && !drawerOpen && !modalOpen}
              closeRef={closeBtn}
              prevId={prevId}
              nextId={nextId}
              onNavigate={(id) => {
                setSelectedId(id)
                requestAnimationFrame(() => document.querySelector(`[data-opener="${id}"]`)?.scrollIntoView({ block: 'nearest' }))
              }}
              onWidthChange={(w) => setDetailWidth(clampDetailWidth(w, projectNavOpen))}
              expanded={detailExpanded}
              onToggleExpand={() => setDetailExpanded(!detailExpanded)}
              onClose={closeDetail}
              onRemove={() => askRemove([selected.id])}
            />
          )}
        </div>
      </main>
      <div className="scrim" onClick={closeSidePanel} />
      <div className="scrim-sheet" />
      {menuNode}
      {removing && (
        <RemoveConfirm
          names={removing.map((id) => data.find((r) => r.id === id)?.name ?? id)}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeRespondents(new Set(removing))
            setRemoving(null)
            // The removed rows (and their buttons) are gone; wait for the modal to close, then
            // move focus to the select-all checkbox.
            requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="Select all shown respondents"]')?.focus())
          }}
        />
      )}
      {playingRespondent && playing?.kind === 'tech' && <TechCheckDialog respondent={playingRespondent} onClose={() => setPlaying(null)} />}
      {playingRespondent && playing?.kind === 'self' && (
        <SelfCaptureHistoryDialog respondent={playingRespondent} onClose={() => setPlaying(null)} />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {pasteText !== null && (
        <PasteImportDialog initialText={pasteText} existing={data} onClose={() => setPasteText(null)} onAdd={addRespondents} />
      )}
    </div>
  )
}
