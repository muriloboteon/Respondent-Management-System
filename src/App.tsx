import {
  functionalUpdate,
  useTable,
  type ColumnPinningState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { DETAIL_MAX_W, DETAIL_MIN_W, DetailPanel } from './components/DetailPanel'
import { Icon } from './components/Icon'
import { PasteImportDialog } from './components/PasteImportDialog'
import { FloatingMenu, type MenuItem } from './components/FloatingMenu'
import { ListHeader, type Panel } from './components/ListHeader'
import { OrgRail } from './components/OrgRail'
import { ProjectSidebar, ProjectSidebarToggle } from './components/ProjectSidebar'
import { RespondentsTable } from './components/RespondentsTable'
import { RemoveConfirm } from './components/RemoveConfirm'
import { ASSIGN_ITEMS, SEGMENT_ITEMS } from './components/respondentActions'
import { TOTAL_RESPONDENTS, respondents, type GroupBy, type Respondent } from './data/respondents'
import { EMPTY_FILTERS, matchesFilters, viewTree, type Filters, type ViewId } from './filters/filters'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useStoredState } from './hooks/useStoredState'
import { loadColumnSizing, saveColumnSizing } from './table/columnSizingStorage'
import {
  DEFAULT_COLUMN_VISIBILITY,
  columns,
  features,
  respondentFilter,
  type MenuState,
} from './table/respondentsTable'

const DEFAULT_SORTING: SortingState = [{ id: 'respondent', desc: false }]
const COLUMN_PINNING: ColumnPinningState = { start: ['respondent'], end: [] }
const noop = () => {}
/** Paste-from-spreadsheet import (button and page-wide paste); hidden for now. */
const PASTE_IMPORT_ENABLED = false

/** True when a paste lands somewhere that should keep its normal paste behaviour. */
function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], dialog') !== null
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
/** Width of the left navigation (org rail, plus the project sidebar when open); matches --nav-w in app.css. */
const navWidth = (projectNavOpen: boolean) => 72 + (projectNavOpen ? 240 : 0)
/** Keeps the docked panel within its limits and leaves room for the table beside the left navigation. */
const clampDetailWidth = (w: number, projectNavOpen: boolean) =>
  Math.round(Math.max(DETAIL_MIN_W, Math.min(w, DETAIL_MAX_W, window.innerWidth - navWidth(projectNavOpen) - 640)))

export function App() {
  const [data, setData] = useState<Respondent[]>(respondents)
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set())
  /** Clipboard text for the paste dialog: null when closed, '' when opened from the button. */
  const [pasteText, setPasteText] = useState<string | null>(null)
  const [lastAdded, setLastAdded] = useState<{ ids: string[]; hidden: number } | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [view, setView] = useState<ViewId>('all')
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
  const [grouping, setGrouping] = useState<GroupingState>([])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(DEFAULT_COLUMN_VISIBILITY)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadColumnSizing)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  /** The detail is shown as a centered modal instead of the side panel. */
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [detailWidth, setDetailWidth] = useStoredState('respondent-hub:detail-width', 440, isNumber)
  const [projectNavOpen, setProjectNavOpen] = useStoredState('respondent-hub:project-nav-open', true, isBoolean)
  const [panel, setPanel] = useState<Panel>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  /** Respondents waiting on the remove confirmation. */
  const [removing, setRemoving] = useState<string[] | null>(null)

  const isWide = useMediaQuery('(min-width: 1280px)')
  const closeBtn = useRef<HTMLButtonElement>(null)

  const openDetail = (id: string) => {
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

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (r) => r.id,
    state: {
      globalFilter: filters,
      sorting,
      grouping,
      columnVisibility,
      columnSizing,
      rowSelection,
      expanded: true,
      columnPinning: COLUMN_PINNING,
    },
    onGlobalFilterChange: (updater) => setFilters((prev) => functionalUpdate(updater, prev)),
    onSortingChange: setSorting,
    onGroupingChange: setGrouping,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: noop,
    onColumnPinningChange: noop,
    defaultColumn: { minSize: 90, maxSize: 600 },
    columnResizeMode: 'onChange',
    globalFilterFn: respondentFilter,
    getColumnCanGlobalFilter: (column) => column.id === 'respondent',
    groupedColumnMode: false,
    enableMultiSort: false,
    enableSortingRemoval: false,
    meta: {
      selectedId,
      newIds,
      menu,
      onOpen: openDetail,
      onToggleMenu: (next) => {
        setPanel(null)
        setMenu((cur) => (cur && cur.type === next.type && cur.id === next.id ? null : next))
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

  const selected =data.find((r) => r.id === selectedId) ?? null
  /** On narrow screens the side panel slides over the table. */
  const asDialog = !isWide
  /** Expanded: the detail opens as a centered modal at any width. */
  const modalOpen = selected !== null && detailExpanded
  const drawerOverlay = asDialog && selected !== null && drawerOpen && !detailExpanded
  const overlayOpen = drawerOverlay || modalOpen
  const docked = !asDialog && selected !== null && !detailExpanded
  const panelWidth = clampDetailWidth(detailWidth, projectNavOpen)

  // Previous / next follow the table's current order (sorting, filters, grouping).
  const order = table.getRowModel().rows.filter((row) => !row.getIsGrouped()).map((row) => row.id)
  const at = selectedId ? order.indexOf(selectedId) : -1
  const prevId = at > 0 ? order[at - 1] : null
  const nextId = at >= 0 && at < order.length - 1 ? order[at + 1] : null

  // Modal or drawer: lock page scroll, move focus in, close on Escape.
  useEffect(() => {
    document.body.classList.toggle('scroll-lock', overlayOpen)
    if (!overlayOpen) return
    if (!document.activeElement?.closest('.detail')) closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && !document.querySelector('dialog[open], .menu') && closeDetail()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  const groupBy = (grouping[0] as GroupBy | undefined) ?? 'none'
  const pickedCount = data.filter((r) => rowSelection[r.id]).length
  const total = TOTAL_RESPONDENTS + data.length - respondents.length

  let menuNode = null
  if (menu?.type === 'col') {
    const column = table.getColumn(menu.id)
    if (column) {
      const groupKey = column.columnDef.meta!.groupKey
      const items: MenuItem[] = []
      if (column.getCanSort()) {
        items.push(
          { label: 'Sort ascending', icon: 'caretUp', onSelect: () => column.toggleSorting(false) },
          { label: 'Sort descending', icon: 'caretDown', onSelect: () => column.toggleSorting(true) },
        )
      }
      items.push(
        groupKey
          ? { label: 'Group by this column', separatorBefore: items.length > 0, onSelect: () => setGrouping([groupKey]) }
          : { label: 'Group by: not available', separatorBefore: items.length > 0, disabled: true },
        { label: 'Hide column', onSelect: () => column.toggleVisibility(false) },
      )
      menuNode = (
        <FloatingMenu
          anchorKey={`col:${column.id}`}
          label={`Column options: ${String(column.columnDef.header)}`}
          align="end"
          width={200}
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
            ...ASSIGN_ITEMS.map((item, i) => ({ ...item, separatorBefore: i === 0, heading: i === 0 ? 'Assign' : undefined })),
            ...SEGMENT_ITEMS.map((item, i) => ({ ...item, separatorBefore: i === 0, heading: i === 0 ? 'Segment' : undefined })),
            { label: 'Export to CSV', icon: 'download', separatorBefore: true },
            { label: 'Remove from project', icon: 'trash', danger: true, separatorBefore: true, onSelect: () => askRemove([r.id]) },
          ]}
        />
      )
    }
  }

  return (
    <div
      className={[drawerOverlay && 'is-drawer-open', modalOpen && 'is-detail-modal', docked && 'is-docked', panel && 'panel-open', projectNavOpen && 'is-project-nav-open']
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
            <span className="count-badge soft" aria-label={`${total.toLocaleString('en-US')} respondents in project`}>
              {total.toLocaleString('en-US')}
            </span>
          </div>
          <button type="button" className="btn btn-primary">
            <Icon name="upload" />
            Upload Respondents
          </button>
        </header>
        <div className="layout">
          <section className="card list-card" aria-labelledby="list-h">
            <ListHeader
              table={table}
              filters={filters}
              onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              view={view}
              onViewChange={(v) => {
                setView(v)
                setFilters({ query: '', tree: viewTree(v) })
              }}
              groupBy={groupBy}
              onGroupByChange={(g) => setGrouping(g === 'none' ? [] : [g])}
              panel={panel}
              onPanelChange={(p) => {
                setMenu(null)
                setPanel(p)
              }}
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
                      <button type="button" className="btn-link" onClick={() => { setFilters(EMPTY_FILTERS); setView('all') }}>
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
            <RespondentsTable table={table} />
          </section>

          {selected && (
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
      <div className="scrim" onClick={closeDetail} />
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
      {pasteText !== null && (
        <PasteImportDialog initialText={pasteText} existing={data} onClose={() => setPasteText(null)} onAdd={addRespondents} />
      )}
    </div>
  )
}
