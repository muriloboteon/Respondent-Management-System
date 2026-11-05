import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FloatingMenu, type MenuItem } from './FloatingMenu'
import { Icon } from './Icon'
import { ASSIGN_ITEMS, SEGMENT_ITEMS } from './respondentActions'

/** Below this table width Export and Remove drop their labels. */
const COMPACT_BELOW = 760
/** Space between the bar and the table's status bar (or the window's bottom edge). */
const GAP = 12

type Menu = 'assign' | 'segment'

const MENUS: Record<Menu, { label: string; items: MenuItem[] }> = {
  assign: { label: 'Assign selected respondents', items: ASSIGN_ITEMS },
  segment: { label: 'Segment selected respondents', items: SEGMENT_ITEMS },
}

/**
 * Bulk actions as a floating bar (as in Linear): while rows are picked it floats at the bottom,
 * centred on the table (not the window, so a docked side panel never covers it), just above the
 * table's status bar. The toolbar above the table stays as it is. Assign and Segment open their
 * menus upward; Remove asks to confirm (the page does). Escape clears the selection when no menu,
 * panel or dialog is open.
 *
 * It slides up from below when rows get picked and back down when the selection clears: it stays
 * mounted while leaving, still showing the last count, and a new pick mid-way turns it around
 * from where it is (CSS transitions, see .bulk-bar in app.css).
 */
export function BulkActions({ count, onClear, onRemove }: { count: number; onClear: () => void; onRemove: () => void }) {
  const picked = count > 0
  const [mounted, setMounted] = useState(picked)
  /** The count shown, kept while the bar slides away (instead of dropping to 0). */
  const [shownCount, setShownCount] = useState(count)
  if (picked && count !== shownCount) setShownCount(count)
  if (picked && !mounted) setMounted(true)
  if (!mounted) return null
  return <Bar count={shownCount} open={picked} onExited={() => setMounted(false)} onClear={onClear} onRemove={onRemove} />
}

/** How long the exit runs at most, in case its transitionend never comes (e.g. a hidden tab). */
const EXIT_MS = 300

function Bar({ count, open, onExited, onClear, onRemove }: { count: number; open: boolean; onExited: () => void; onClear: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [compact, setCompact] = useState(false)
  /** "open" once it has been painted below, so the entrance transition runs. */
  const [state, setState] = useState<'open' | 'closed'>('closed')

  useEffect(() => {
    if (!open) {
      setState('closed')
      setMenu(null)
      const timer = window.setTimeout(onExited, EXIT_MS)
      return () => window.clearTimeout(timer)
    }
    // Two frames: the bar is painted in its "closed" place first, then slides up.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setState('open'))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [open])

  // Follows the table card: centred on it, above its status bar (or the window's bottom when
  // the card runs below it), through resizes, the side panel docking and page scrolls.
  useLayoutEffect(() => {
    const bar = ref.current
    const card = bar?.closest<HTMLElement>('.list-card')
    if (!bar || !card) return
    const place = () => {
      const rect = card.getBoundingClientRect()
      const status = card.querySelector('.table-status')?.getBoundingClientRect()
      const floor = Math.min(status ? status.top : rect.bottom, window.innerHeight)
      bar.style.setProperty('--bar-x', `${rect.left + rect.width / 2}px`)
      bar.style.setProperty('--bar-bottom', `${Math.max(GAP, window.innerHeight - floor + GAP)}px`)
      setCompact(rect.width < COMPACT_BELOW)
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(card)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [])

  // The bar leaves with the selection, so focus moves to the select-all checkbox.
  const clear = () => {
    const hadFocus = ref.current?.contains(document.activeElement)
    onClear()
    if (hadFocus) document.querySelector<HTMLElement>('[aria-label="Select all shown respondents"]')?.focus()
  }

  useEffect(() => {
    if (!open) return
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
      className="btn btn-sm bulk-btn"
      aria-haspopup="menu"
      aria-expanded={menu === id}
      data-menu-anchor={`bulk-${id}`}
      onClick={() => setMenu((cur) => (cur === id ? null : id))}
    >
      {label}
      <Icon name="caretUp" />
    </button>
  )

  return (
    <div
      ref={ref}
      className="bulk-bar"
      data-state={state}
      role="toolbar"
      aria-label="Actions for selected respondents"
      aria-hidden={!open || undefined}
      // Leaving: out of the tab order and unclickable while it slides away.
      inert={!open || undefined}
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget && e.propertyName === 'opacity') onExited()
      }}
    >
      <span className="bulk-count">
        <span className="count">{count} selected</span>
        <button type="button" className="icon-btn bulk-clear" aria-label="Clear selection" title="Clear selection (Esc)" onClick={clear}>
          <Icon name="x" />
        </button>
      </span>
      <span className="bulk-sep" aria-hidden="true" />
      {menuButton('assign', 'Assign')}
      {menuButton('segment', 'Segment')}
      <button
        type="button"
        className={compact ? 'btn btn-sm bulk-btn btn-icon' : 'btn btn-sm bulk-btn'}
        aria-label={compact ? 'Export to CSV' : undefined}
        title="Export to CSV"
      >
        <Icon name="download" />
        {!compact && 'Export'}
      </button>
      <span className="bulk-sep" aria-hidden="true" />
      <button
        type="button"
        className={compact ? 'btn btn-sm bulk-btn bulk-danger btn-icon' : 'btn btn-sm bulk-btn bulk-danger'}
        aria-label={compact ? 'Remove from project' : undefined}
        title="Remove from project"
        onClick={onRemove}
      >
        <Icon name="trash" />
        {!compact && 'Remove'}
      </button>

      {/* In a portal: the bar's transform (it centres the bar) would otherwise make the menu's
          fixed position relative to the bar instead of the window, pushing it off screen. */}
      {menu &&
        createPortal(
          <FloatingMenu
            anchorKey={`bulk-${menu}`}
            label={MENUS[menu].label}
            align="start"
            width={200}
            items={MENUS[menu].items}
            onClose={() => setMenu(null)}
          />,
          document.body,
        )}
    </div>
  )
}
