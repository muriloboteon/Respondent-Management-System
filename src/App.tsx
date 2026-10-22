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
import { useEffect, useRef, useState } from 'react'
import { DetailPanel } from './components/DetailPanel'
import { Icon } from './components/Icon'
import { PasteImportDialog } from './components/PasteImportDialog'
import { FloatingMenu, type MenuItem } from './components/FloatingMenu'
import { ListHeader, type Panel } from './components/ListHeader'
import { RespondentsTable } from './components/RespondentsTable'
import { TOTAL_RESPONDENTS, respondents, type GroupBy, type Respondent } from './data/respondents'
import { EMPTY_FILTERS, matchesFilters, viewTree, type Filters, type ViewId } from './filters/filters'
import { useMediaQuery } from './hooks/useMediaQuery'
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
  const [panel, setPanel] = useState<Panel>(null)
  const [menu, setMenu] = useState<MenuState>(null)

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

  const selected = data.find((r) => r.id === selectedId) ?? null
  const asDrawer = !isWide
  const drawerVisible = asDrawer && selected !== null && drawerOpen

  // Modal drawer on narrow screens: lock page scroll, move focus in, close on Escape.
  useEffect(() => {
    document.body.classList.toggle('scroll-lock', drawerVisible)
    if (!drawerVisible) return
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('dialog[open]') && closeDetail()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerVisible])

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
            { label: 'Schedule live session', separatorBefore: true },
            { label: 'Assign AI interview' },
            { label: 'Assign activity' },
            { label: 'Assign segment' },
            { label: 'Export to CSV', separatorBefore: true },
            { label: 'Remove from project', icon: 'trash', danger: true },
          ]}
        />
      )
    }
  }

  return (
    <div className={[drawerVisible && 'is-drawer-open', panel && 'panel-open'].filter(Boolean).join(' ')}>
      <main className="page" id="respondents">
        <div className={selected ? 'layout has-detail' : 'layout'}>
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
              total={total}
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
            <DetailPanel r={selected} all={data} asDrawer={asDrawer} hidden={asDrawer && !drawerOpen} closeRef={closeBtn} onClose={closeDetail} />
          )}
        </div>
      </main>
      <div className="scrim" onClick={closeDetail} />
      <div className="scrim-sheet" />
      {menuNode}
      {pasteText !== null && (
        <PasteImportDialog initialText={pasteText} existing={data} onClose={() => setPasteText(null)} onAdd={addRespondents} />
      )}
    </div>
  )
}
