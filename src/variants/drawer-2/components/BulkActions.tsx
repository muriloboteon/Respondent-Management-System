import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FloatingMenu, type MenuItem } from './FloatingMenu'
import { Icon } from './Icon'
import { ASSIGN_ITEMS, SEGMENT_ITEMS } from './respondentActions'

/** Below this band width Export and Remove drop their labels. */
const COMPACT_BELOW = 1080

type Menu = 'assign' | 'segment'

const MENUS: Record<Menu, { label: string; items: MenuItem[] }> = {
  assign: { label: 'Assign selected respondents', items: ASSIGN_ITEMS },
  segment: { label: 'Segment selected respondents', items: SEGMENT_ITEMS },
}

/**
 * Bulk actions shown in the filters band while rows are picked, in place of the applied
 * filters: Assign and Segment menus, Export, and Remove (the page asks to confirm). All are
 * secondary, so "Upload Respondents" stays the page's only primary button.
 * Escape clears the selection when no menu, panel or dialog is open.
 */
export function BulkActions({ count, onClear, onRemove }: { count: number; onClear: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [compact, setCompact] = useState(false)

  // Compact mode follows the band's width, which the docked detail panel also narrows.
  useLayoutEffect(() => {
    const band = ref.current?.closest('.head-band')
    if (!band) return
    const ro = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < COMPACT_BELOW))
    ro.observe(band)
    return () => ro.disconnect()
  }, [])

  // The actions leave with the selection, so focus moves to the select-all checkbox.
  const clear = () => {
    const hadFocus = ref.current?.contains(document.activeElement)
    onClear()
    if (hadFocus) document.querySelector<HTMLElement>('[aria-label="Select all shown respondents"]')?.focus()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (e.target instanceof Element && e.target.closest('input:not([type="checkbox"]), textarea, select')) return
      if (document.querySelector('dialog[open], .menu, .panel, .is-drawer-open')) return
      clear()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const menuButton = (id: Menu, label: string) => (
    <button
      type="button"
      className="btn btn-sm btn-outline"
      aria-haspopup="menu"
      aria-expanded={menu === id}
      data-menu-anchor={`bulk-${id}`}
      onClick={() => setMenu((cur) => (cur === id ? null : id))}
    >
      {label}
      <Icon name="caretDown" />
    </button>
  )

  return (
    <div ref={ref} className="bulk-actions" role="toolbar" aria-label="Actions for selected respondents">
      <span className="bulk-count">
        <span className="count">{count} selected</span>
        <button type="button" className="icon-btn" aria-label="Clear selection" title="Clear selection" onClick={clear}>
          <Icon name="x" />
        </button>
      </span>
      <span className="bulk-sep" aria-hidden="true" />
      {menuButton('assign', 'Assign')}
      {menuButton('segment', 'Segment')}
      <button
        type="button"
        className={compact ? 'btn btn-sm btn-outline btn-icon' : 'btn btn-sm btn-outline'}
        aria-label={compact ? 'Export to CSV' : undefined}
        title="Export to CSV"
      >
        <Icon name="download" />
        {!compact && 'Export'}
      </button>
      <span className="bulk-sep" aria-hidden="true" />
      <button
        type="button"
        className={compact ? 'btn btn-sm btn-ghost btn-danger btn-icon' : 'btn btn-sm btn-ghost btn-danger'}
        aria-label={compact ? 'Remove from project' : undefined}
        title="Remove from project"
        onClick={onRemove}
      >
        <Icon name="trash" />
        {!compact && 'Remove'}
      </button>

      {menu && (
        <FloatingMenu
          anchorKey={`bulk-${menu}`}
          label={MENUS[menu].label}
          align="start"
          width={200}
          items={MENUS[menu].items}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
