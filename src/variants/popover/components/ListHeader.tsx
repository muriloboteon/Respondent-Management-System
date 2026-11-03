import type { ReactTable } from '@tanstack/react-table'
import { useRef, type ReactNode } from 'react'
import { projectCount, type Respondent } from '@data/respondents'
import {
  VIEWS,
  activeConditions,
  applyCondition,
  searchTerms,
  type Condition,
  type Filters,
  type ViewId,
} from '../filters/filters'
import { useDismiss } from '../hooks/useDismiss'
import type { features } from '../table/respondentsTable'
import { ColumnsPanel } from './ColumnsPanel'
import { FilterChip, FilterPopover, type FilterLayer } from './FilterChips'
import { BulkActions } from './BulkActions'
import { Icon } from './Icon'

type Table = ReactTable<typeof features, Respondent>
export type Panel = 'cols' | null

const fmt = (n: number) => n.toLocaleString('en-US')

/** The saved views band is hidden for now to give the table more room. */
const SHOW_SAVED_VIEWS = false
const ADD_FILTER_ANCHOR = 'filter:add'

interface Props {
  table: Table
  /** Respondents in the whole project; filter results are scaled to it from the loaded sample. */
  total: number
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  view: ViewId
  onViewChange: (view: ViewId) => void
  panel: Panel
  onPanelChange: (panel: Panel) => void
  pickedCount: number
  /** Asks to remove the picked respondents from the project. */
  onRemovePicked: () => void
  /** Omit to hide the "Paste from Excel" button. */
  onPasteClick?: () => void
  /** Confirmation shown after adding respondents. */
  notice?: ReactNode
  /** The open filter popover; the column menu in the table can open one too. */
  filterLayer: FilterLayer
  onFilterLayerChange: (layer: FilterLayer) => void
}

export function ListHeader({ table, total, filters, onFiltersChange, view, onViewChange, panel, onPanelChange, pickedCount, onRemovePicked, onPasteClick, notice, filterLayer, onFilterLayerChange: setFilterLayer }: Props) {
  const addBtn = useRef<HTMLButtonElement>(null)
  const colsBtn = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  const setPanel = (next: Panel) => {
    setFilterLayer(null)
    onPanelChange(next)
  }
  const openFilterLayer = (next: NonNullable<FilterLayer>) => {
    onPanelChange(null)
    setFilterLayer(JSON.stringify(filterLayer) === JSON.stringify(next) ? null : next)
  }

  useDismiss(panel !== null, '.pop-wrap', (reason) => {
    setPanel(null)
    if (reason === 'escape') colsBtn.current?.focus()
  })

  const conditions = filters.conditions
  const terms = searchTerms(filters.query)
  const hasFilters = activeConditions(conditions).length > 0 || terms.length > 0
  const resultCount = projectCount(table.getFilteredRowModel().rows.length, table.options.data.length, total)
  const togglePanel = (p: Exclude<Panel, null>) => setPanel(panel === p ? null : p)
  const setConditions = (next: Condition[]) => onFiltersChange({ conditions: next })

  // "Add filter" / "Apply" in the popover: one chip per column, so a column already filtered is replaced.
  const applyFilter = (next: Condition) => setConditions(applyCondition(conditions, next))
  // Removing a chip unmounts it, so focus moves to the "+ Add filter" button.
  const removeFilter = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id))
    if (filterLayer?.kind === 'edit' && filterLayer.id === id) setFilterLayer(null)
    addBtn.current?.focus()
  }
  const editing = filterLayer?.kind === 'edit' ? conditions.find((c) => c.id === filterLayer.id) : undefined
  // Where the popover opens: under "+ Add filter", under the chip being edited, or under a column's
  // menu button (at the header's right edge, so the box lines up with its right side).
  const popover =
    filterLayer?.kind === 'add' ? { anchorKey: ADD_FILTER_ANCHOR, align: 'start' as const }
    : filterLayer?.kind === 'column' ? { anchorKey: filterLayer.anchorKey, align: 'end' as const, startProp: filterLayer.prop }
    : editing ? { anchorKey: `chip:${editing.id}`, align: 'start' as const, editing }
    : null

  return (
    // Two bands split by full-width dividers: saved views (hidden for now), and the filters band, one row:
    // the search, the filter chips and "+ Add filter" on the left; the result count and Columns on the right.
    // While rows are picked, bulk actions take the place of the filters. The import notice joins as an extra band.
    // The page title sits above the card.
    <div className="list-head">
      {SHOW_SAVED_VIEWS && (
        <div className="head-band band-tools">
          <div className="tabs" role="group" aria-label="Saved views">
            {(Object.keys(VIEWS) as ViewId[]).map((id) => (
              <button key={id} type="button" className="tab" aria-pressed={view === id} onClick={() => onViewChange(id)}>
                {VIEWS[id].label}
              </button>
            ))}
          </div>
        </div>
      )}

      <span className="sr-only" role="status">
        {pickedCount > 0 ? `${pickedCount} selected` : hasFilters ? `${fmt(resultCount)} of ${fmt(total)} respondents match` : ''}
      </span>
      <div className="head-band band-filters">
        <label className="field field-sm search">
          <Icon name="search" />
          <span className="sr-only">Search respondents</span>
          <input
            ref={searchInput}
            type="search"
            placeholder="Search respondents"
            title="Search by name, email or ID. Separate several with commas."
            value={filters.query}
            onChange={(e) => onFiltersChange({ query: e.target.value })}
          />
          {/* Our own clear button: not every browser shows one in a search field */}
          {filters.query && (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              onClick={() => {
                onFiltersChange({ query: '' })
                searchInput.current?.focus()
              }}
            >
              <Icon name="x" small />
            </button>
          )}
        </label>
        {pickedCount > 0 ? (
          <BulkActions count={pickedCount} onClear={() => table.resetRowSelection(true)} onRemove={onRemovePicked} />
        ) : (
          // Filters first, in reading order: the applied chips, then "+ Add filter". A chip is only
          // added once its values are chosen and "Add filter" is clicked in the popover.
          <div className="chips-row" role="group" aria-label="Filters">
            {conditions.map((c) => (
              <FilterChip
                key={c.id}
                condition={c}
                open={filterLayer?.kind === 'edit' && filterLayer.id === c.id}
                onEdit={() => openFilterLayer({ kind: 'edit', id: c.id })}
                onRemove={() => removeFilter(c.id)}
              />
            ))}
            <button
              ref={addBtn}
              type="button"
              className="btn btn-sm btn-ghost add-filter"
              data-menu-anchor={ADD_FILTER_ANCHOR}
              aria-haspopup="dialog"
              aria-expanded={filterLayer?.kind === 'add'}
              onClick={() => openFilterLayer({ kind: 'add' })}
            >
              <Icon name="plus" />
              Add filter
            </button>
            {/* Clears the chips it sits next to; the search keeps its own × */}
            {activeConditions(conditions).length > 0 && (
              <button
                type="button"
                className="btn-link muted"
                onClick={() => {
                  setConditions([])
                  setFilterLayer(null)
                  addBtn.current?.focus()
                }}
              >
                Clear all
              </button>
            )}
          </div>
        )}
        {popover && (
          <FilterPopover
            key={JSON.stringify(filterLayer)}
            {...popover}
            filters={filters}
            data={table.options.data}
            toProject={(n) => projectCount(n, table.options.data.length, total)}
            onApply={applyFilter}
            onClose={() => setFilterLayer(null)}
          />
        )}

        <div className="tools">
          {/* The result of the filters and the search; announced by the status region above */}
          {pickedCount === 0 && hasFilters && (
            <span className="band-end">
              <span className="result-count" aria-hidden="true">
                <strong>{fmt(resultCount)}</strong> of {fmt(total)} respondents
              </span>
            </span>
          )}
          <div className="pop-wrap">
            <button
              ref={colsBtn}
              type="button"
              className="btn btn-sm btn-outline btn-icon"
              aria-label="Columns"
              title="Columns"
              aria-haspopup="dialog"
              aria-expanded={panel === 'cols'}
              aria-controls="panel-cols"
              onClick={() => togglePanel('cols')}
            >
              <Icon name="columns" />
            </button>
            {panel === 'cols' && <ColumnsPanel table={table} />}
          </div>

          {onPasteClick && (
            <button type="button" className="btn btn-sm btn-outline" onClick={onPasteClick}>
              <Icon name="clipboard" />
              Paste from Excel
            </button>
          )}
        </div>
      </div>

      {notice}
    </div>
  )
}
