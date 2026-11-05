import type { ReactTable } from '@tanstack/react-table'
import { useRef, type ReactNode } from 'react'
import { projectCount, type Respondent } from '@data/respondents'
import {
  VIEWS,
  activeConditions,
  isComplete,
  searchTerms,
  type Condition,
  type Filters,
  type ViewId,
} from '../filters/filters'
import { useDismiss } from '../hooks/useDismiss'
import type { features } from '../table/respondentsTable'
import { ColumnsPanel } from './ColumnsPanel'
import { FilterChip } from './FilterChips'
import { BulkActions } from './BulkActions'
import { Icon } from './Icon'

type Table = ReactTable<typeof features, Respondent>
export type Panel = 'cols' | null

const fmt = (n: number) => n.toLocaleString('en-US')

/** The saved views band is hidden for now to give the table more room. */
const SHOW_SAVED_VIEWS = false

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
  /** The filters drawer (in the detail panel's place) is open. */
  filtersOpen: boolean
  onToggleFilters: () => void
  /** Opens the filters drawer on one property (a chip's text). */
  onEditFilter: (prop: string) => void
}

export function ListHeader({ table, total, filters, onFiltersChange, view, onViewChange, panel, onPanelChange: setPanel, pickedCount, onRemovePicked, onPasteClick, notice, filtersOpen, onToggleFilters, onEditFilter }: Props) {
  const filtersBtn = useRef<HTMLButtonElement>(null)
  const colsBtn = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  useDismiss(panel !== null, '.pop-wrap', (reason) => {
    setPanel(null)
    if (reason === 'escape') colsBtn.current?.focus()
  })

  const conditions = filters.conditions
  const terms = searchTerms(filters.query)
  const activeCount = activeConditions(conditions).length
  const hasFilters = activeCount > 0 || terms.length > 0
  const resultCount = projectCount(table.getFilteredRowModel().rows.length, table.options.data.length, total)
  const togglePanel = (p: Exclude<Panel, null>) => setPanel(panel === p ? null : p)
  const setConditions = (next: Condition[]) => onFiltersChange({ conditions: next })

  // Removing a chip unmounts it, so focus moves to the Filters button.
  const removeFilter = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id))
    filtersBtn.current?.focus()
  }

  return (
    // Two bands split by full-width dividers: saved views (hidden for now), and the filters band, one row:
    // the search, the Filters button and the filter chips on the left; the result count and Columns on the right.
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
          activeCount > 0 && (
          // The applied filters as chips after the search; a chip's text opens its section in the
          // drawer (the Filters button sits with Columns, on the right).
          <div className="chips-row" role="group" aria-label="Applied filters">
            {conditions.filter(isComplete).map((c) => (
              <FilterChip key={c.id} condition={c} onEdit={() => onEditFilter(c.prop)} onRemove={() => removeFilter(c.id)} />
            ))}
            {/* Clears the chips it sits next to; the search keeps its own × */}
            {activeCount > 0 && (
              <button
                type="button"
                className="btn-link muted"
                onClick={() => {
                  setConditions([])
                  filtersBtn.current?.focus()
                }}
              >
                Clear all
              </button>
            )}
          </div>
          )
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
          {/* Opens the filters drawer, in the detail panel's place */}
          <button
            ref={filtersBtn}
            type="button"
            className="btn btn-sm btn-outline add-filter"
            data-filters-toggle=""
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            onClick={onToggleFilters}
          >
            <Icon name="funnel" />
            Filters
            {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
          </button>
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
