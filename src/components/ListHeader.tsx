import type { ReactTable } from '@tanstack/react-table'
import { Fragment, useRef, type ReactNode } from 'react'
import type { GroupBy, Respondent } from '../data/respondents'
import {
  EMPTY_TREE,
  GROUP_BY_OPTIONS,
  VIEWS,
  activeItems,
  isViewDirty,
  isComplete,
  pruneEmpty,
  searchTerms,
  summarize,
  type Filters,
  type ViewId,
} from '../filters/filters'
import { useDismiss } from '../hooks/useDismiss'
import { COLUMN_PANEL_GROUPS, type features } from '../table/respondentsTable'
import { Checkbox } from './Checkbox'
import { FilterPanel } from './FilterPanel'
import { BulkActions } from './BulkActions'
import { Icon } from './Icon'
import { Tag } from './Tag'

type Table = ReactTable<typeof features, Respondent>
export type Panel = 'filter' | 'cols' | null

interface Props {
  table: Table
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  view: ViewId
  onViewChange: (view: ViewId) => void
  groupBy: GroupBy
  onGroupByChange: (groupBy: GroupBy) => void
  panel: Panel
  onPanelChange: (panel: Panel) => void
  pickedCount: number
  /** Asks to remove the picked respondents from the project. */
  onRemovePicked: () => void
  /** Omit to hide the "Paste from Excel" button. */
  onPasteClick?: () => void
  /** Confirmation shown after adding respondents. */
  notice?: ReactNode
}

export function ListHeader({ table, filters, onFiltersChange, view, onViewChange, groupBy, onGroupByChange, panel, onPanelChange, pickedCount, onRemovePicked, onPasteClick, notice }: Props) {
  const filterBtn = useRef<HTMLButtonElement>(null)
  const colsBtn = useRef<HTMLButtonElement>(null)

  // Closing the filter panel drops rows that never got a property.
  const setPanel = (next: Panel) => {
    if (panel === 'filter' && next !== 'filter') {
      const pruned = pruneEmpty(filters.tree)
      if (pruned !== filters.tree) onFiltersChange({ tree: pruned })
    }
    onPanelChange(next)
  }

  useDismiss(panel !== null, '.pop-wrap, .chips-row', (reason) => {
    const trigger = panel === 'filter' ? filterBtn.current : colsBtn.current
    setPanel(null)
    if (reason === 'escape') trigger?.focus()
  })

  const items = activeItems(filters.tree)
  const terms = searchTerms(filters.query)
  const hasFilters = items.length > 0 || terms.length > 0
  const dirty = isViewDirty(view, filters)
  const filterCount = items.length + (groupBy !== 'none' ? 1 : 0)
  const togglePanel = (p: Exclude<Panel, null>) => setPanel(panel === p ? null : p)
  // Removing a chip unmounts it, so focus moves to the Filters button.
  const focusFilters = () => filterBtn.current?.focus()
  const removeItem = (id: string) => {
    onFiltersChange({ tree: { ...filters.tree, items: filters.tree.items.filter((item) => item.id !== id) } })
    focusFilters()
  }
  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide() && c.columnDef.meta!.kind !== 'internal')

  return (
    // Two bands split by full-width dividers: saved views, and the filters band (applied
    // filters, then search, Filters and Columns). While rows are picked, bulk actions take the
    // place of the applied filters. The import notice joins as an extra band.
    // The page title sits above the card.
    <div className="list-head">
      <div className="head-band band-tools">
        <div className="tabs" role="group" aria-label="Saved views">
          {(Object.keys(VIEWS) as ViewId[]).map((id) => (
            <button key={id} type="button" className="tab" aria-pressed={view === id} onClick={() => onViewChange(id)}>
              {VIEWS[id].label}
            </button>
          ))}
        </div>
      </div>

      <span className="sr-only" role="status">{pickedCount > 0 ? `${pickedCount} selected` : ''}</span>
      <div className="head-band band-filters">
        {pickedCount > 0 ? (
          <BulkActions count={pickedCount} onClear={() => table.resetRowSelection(true)} onRemove={onRemovePicked} />
        ) : (
        <>
        {hasFilters && (
        <div className="chips-row" role="group" aria-label="Active filters">
          {terms.length > 0 && (
            <span className="chip">
              <span className="k">Search</span>
              <span className="op">{terms.length > 1 ? 'matches any of' : 'contains'}</span>
              <span className="v">{terms.length > 1 ? `${terms.length} terms` : filters.query.trim()}</span>
              <button
                type="button"
                aria-label="Remove search"
                onClick={() => {
                  onFiltersChange({ query: '' })
                  focusFilters()
                }}
              >
                <Icon name="x" small />
              </button>
            </span>
          )}
          {items.map((item, i) => {
            const join = i > 0 && filters.tree.join === 'or' && <span className="chip-join">or</span>
            if (item.kind === 'group') {
              // A group chip spells out its conditions ("A or B"), truncated with the full text on hover.
              const parts = item.conditions.filter(isComplete).map(summarize)
              const text = parts.map((s) => `${s.prop} ${s.op} ${s.val}`.trim()).join(` ${item.join} `)
              return (
                <Fragment key={item.id}>
                  {join}
                  <span className="chip chip-group">
                    <button type="button" className="chip-body chip-text" title={text} aria-label={`Edit filter group: ${text}`} onClick={() => setPanel('filter')}>
                      {parts.map((s, j) => (
                        <Fragment key={j}>
                          {j > 0 && <span className="chip-or">{item.join}</span>}
                          <span className="k">{s.prop}</span> {s.op} <span className="v">{s.val}</span>
                        </Fragment>
                      ))}
                    </button>
                    <button type="button" aria-label="Remove filter group" onClick={() => removeItem(item.id)}>
                      <Icon name="x" small />
                    </button>
                  </span>
                </Fragment>
              )
            }
            const s = summarize(item)
            return (
              <Fragment key={item.id}>
                {join}
                <span className="chip">
                  <button type="button" className="chip-body" aria-label={`Edit filter: ${s.prop} ${s.op} ${s.val}`} onClick={() => setPanel('filter')}>
                    <span className="k">{s.prop}</span>
                    <span className="op">{s.op}</span>
                    {s.val && <span className="v">{s.val}</span>}
                  </button>
                  <button type="button" aria-label={`Remove filter ${s.prop}`} onClick={() => removeItem(item.id)}>
                    <Icon name="x" small />
                  </button>
                </span>
              </Fragment>
            )
          })}
        </div>
        )}

        {(hasFilters || dirty) && (
          <div className="band-end">
            {dirty && (
              <span className="unsaved">
                <span className="dot" aria-hidden="true" />
                Unsaved changes
                <button type="button" className="btn-link">Save as view</button>
              </span>
            )}
            {hasFilters && (
              <button
                type="button"
                className="btn-link muted"
                onClick={() => {
                  onFiltersChange({ query: '', tree: EMPTY_TREE })
                  focusFilters()
                }}
              >
                Clear all
              </button>
            )}
          </div>
        )}
        </>
        )}

        <div className="tools">
          <label className="field field-sm search">
            <Icon name="search" />
            <span className="sr-only">Search respondents</span>
            <input
              type="search"
              placeholder="Search respondents"
              title="Search by name, email or ID. Separate several with commas."
              value={filters.query}
              onChange={(e) => onFiltersChange({ query: e.target.value })}
            />
          </label>

          <div className="pop-wrap">
            <button
              ref={filterBtn}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={panel === 'filter'}
              aria-controls="panel-filter"
              className="btn btn-sm btn-outline"
              onClick={() => togglePanel('filter')}
            >
              <Icon name="sliders" />
              Filters
              {filterCount > 0 && <span className="count-badge">{filterCount}</span>}
            </button>
            {panel === 'filter' && (
              <div className="panel filter-panel" role="dialog" aria-label="Filters" id="panel-filter">
                <FilterPanel
                  tree={filters.tree}
                  onTreeChange={(tree) => onFiltersChange({ tree })}
                  data={table.options.data}
                  resultCount={table.getFilteredRowModel().rows.length}
                  onDone={() => {
                    setPanel(null)
                    filterBtn.current?.focus()
                  }}
                />
              </div>
            )}
          </div>

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
            {panel === 'cols' && (
              <div className="panel" role="dialog" aria-label="Columns" id="panel-cols">
                <span className="sheet-handle" aria-hidden="true" />
                <p className="panel-title">Show columns</p>
                {COLUMN_PANEL_GROUPS.map((group) => (
                  <fieldset key={group.name}>
                    <legend>{group.name}</legend>
                    {hideableColumns
                      .filter((c) => group.match(c.columnDef.meta!))
                      .map((c) => (
                        <label key={c.id} className="check-row">
                          <Checkbox checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} />
                          <span>{String(c.columnDef.header)}</span>
                          {c.columnDef.meta!.multi && <Tag>Multi-select</Tag>}
                        </label>
                      ))}
                  </fieldset>
                ))}
                <label className="form-label panel-section">
                  Group rows by
                  <select className="select select-sm" value={groupBy} onChange={(e) => onGroupByChange(e.target.value as GroupBy)}>
                    {GROUP_BY_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>
              </div>
            )}
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
