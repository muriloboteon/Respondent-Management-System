import type { ReactTable } from '@tanstack/react-table'
import { useRef, type ReactNode } from 'react'
import { projectCount, type Respondent } from '@data/respondents'
import { activeConditions, isComplete, searchTerms, type Condition, type Filters } from '../filters/filters'
import type { features } from '../table/respondentsTable'
import type { SavedViewsApi } from '../views/useSavedViews'
import { AiSearch } from './AiSearch'
import { FilterChip } from './FilterChips'
import { BulkActions } from './BulkActions'
import { Icon } from './Icon'
import { ViewsButton } from './SavedViews'

type Table = ReactTable<typeof features, Respondent>
/** Side panels the toolbar opens besides Filters (all three open in the detail panel's place). */
export type Tool = 'views' | 'columns'

const fmt = (n: number) => n.toLocaleString('en-US')

interface Props {
  table: Table
  /** Respondents in the whole project; filter results are scaled to it from the loaded sample. */
  total: number
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  /** Saved views: the open view's name for the Views button. */
  views: SavedViewsApi
  /** The Views or Columns side panel, when open. */
  tool: Tool | null
  onToggleTool: (tool: Tool) => void
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
  /** Turns a description typed in the search into filters. */
  onAskAi: (prompt: string) => void
  aiBusy: boolean
}

export function ListHeader({ table, total, filters, onFiltersChange, views, tool, onToggleTool, pickedCount, onRemovePicked, onPasteClick, notice, filtersOpen, onToggleFilters, onEditFilter, onAskAi, aiBusy }: Props) {
  const filtersBtn = useRef<HTMLButtonElement>(null)

  const conditions = filters.conditions
  const terms = searchTerms(filters.query)
  const activeCount = activeConditions(conditions).length
  const hasFilters = activeCount > 0 || terms.length > 0
  const resultCount = projectCount(table.getFilteredRowModel().rows.length, table.options.data.length, total)
  const setConditions = (next: Condition[]) => onFiltersChange({ conditions: next })

  // Removing a chip unmounts it, so focus moves to the Filters button.
  const removeFilter = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id))
    filtersBtn.current?.focus()
  }

  return (
    // One band, one row: what is applied on the left (the search and the filter chips that follow
    // it, which the AI search also fills); the tools on the right (Filters, Views, Columns), each
    // opening a panel. Counts are in the status bar under the table.
    // While rows are picked, bulk actions take the place of the chips. The import notice joins as an extra band.
    // The page title sits above the card.
    <div className="list-head">
      <span className="sr-only" role="status">
        {pickedCount > 0 ? `${pickedCount} selected` : hasFilters ? `${fmt(resultCount)} of ${fmt(total)} respondents match` : ''}
      </span>
      <div className="head-band band-filters">
        <AiSearch query={filters.query} onQueryChange={(query) => onFiltersChange({ query })} onAsk={onAskAi} busy={aiBusy} />
        {pickedCount > 0 ? (
          <BulkActions count={pickedCount} onClear={() => table.resetRowSelection(true)} onRemove={onRemovePicked} />
        ) : activeCount > 0 ? (
          // The applied filters as chips; a chip's text opens its section in the drawer.
          <div className="chips-row" role="group" aria-label="Applied filters">
            {conditions.filter(isComplete).map((c) => (
              <FilterChip key={c.id} condition={c} onEdit={() => onEditFilter(c.prop)} onRemove={() => removeFilter(c.id)} />
            ))}
            {/* Clears the chips it sits next to; the search keeps its own × */}
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
          </div>
        ) : null}

        <div className="tools">
          {/* The result count lives in the status bar under the table; the status region above announces it. */}
          {/* Filters, Views and Columns sit together and open the same way: each opens the side panel
              (in the detail panel's place) with its own content; the open one stays pressed, and
              clicking it again closes the panel. */}
          <button
            ref={filtersBtn}
            type="button"
            className="btn btn-sm btn-outline"
            data-filters-toggle=""
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            onClick={onToggleFilters}
          >
            <Icon name="funnel" />
            Filters
            {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
          </button>
          <ViewsButton views={views} open={tool === 'views'} onToggle={() => onToggleTool('views')} />
          <button
            type="button"
            className="btn btn-sm btn-outline btn-icon"
            data-tool="columns"
            aria-label="Columns"
            title="Columns"
            aria-expanded={tool === 'columns'}
            aria-controls="columns-panel"
            onClick={() => onToggleTool('columns')}
          >
            <Icon name="columns" />
          </button>

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
