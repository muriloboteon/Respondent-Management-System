import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../hooks/useDismiss'
import { useAnchoredPosition } from './FloatingMenu'
import { CELL_PEEK } from './gridCells'
import { useHoverTooltip } from './Tooltip'

/** Natural widths of the tags and of a "+N" tag, measured once per set of values. */
interface Sizes {
  key: string
  tags: number[]
  more: number
  gap: number
}

/**
 * How many tags fit whole in `width`, with room for "+N" when some are left out (at least one),
 * and whether anything is cut off: tags left out, or a first tag too wide on its own.
 */
function fitCount({ tags, more, gap }: Sizes, width: number) {
  let used = 0
  let fit = 0
  for (let i = 0; i < tags.length; i++) {
    const next = used + (i ? gap : 0) + tags[i]
    const rest = tags.length - i - 1
    if (next + (rest ? gap + more : 0) > width) break
    used = next
    fit = i + 1
  }
  const shown = Math.max(1, fit)
  return { shown, cut: fit < tags.length }
}

/**
 * Tags in a one-line cell, like the MUI X Data Grid's multi-select cells: the tags that fit whole,
 * then "+N" for the rest. A tag too wide for the cell on its own ends in an ellipsis. Hovering a
 * cell that hides something shows every value in a tooltip; Space on the selected cell opens them
 * all in a popup. Screen readers get the whole list as text.
 */
export function TagList({ values }: { values: readonly string[] }) {
  const ref = useRef<HTMLSpanElement>(null)
  const anchorKey = `tags:${useId()}`
  // Measured again once the web font has loaded: tags measured in the fallback font are narrower.
  const [fontsLoaded, setFontsLoaded] = useState(() => document.fonts.status === 'loaded')
  useEffect(() => {
    if (!fontsLoaded) document.fonts.ready.then(() => setFontsLoaded(true))
  }, [])
  const key = `${fontsLoaded}\u0000${values.join('\u0000')}`
  const sizes = useRef<Sizes | null>(null)
  const [fit, setFit] = useState<{ key: string; shown: number; cut: boolean } | null>(null)
  const [peek, setPeek] = useState(false)
  const { tooltip, show, hide } = useHoverTooltip()

  // New values render every tag and a "+N" once, to measure them before the first paint.
  const current = fit && fit.key === key ? fit : null
  const shown = current ? current.shown : values.length
  const hidden = values.length - shown
  const cut = !!current?.cut

  useLayoutEffect(() => {
    const list = ref.current!
    if (sizes.current?.key !== key) {
      const tags = Array.from(list.querySelectorAll<HTMLElement>(':scope > .tag'))
      sizes.current = {
        key,
        // A tag the cell squeezes (the first one may shrink) adds back the text it cuts off.
        tags: tags.slice(0, values.length).map((t) => {
          const text = t.firstElementChild!
          return t.offsetWidth + text.scrollWidth - text.clientWidth
        }),
        more: list.querySelector<HTMLElement>(':scope > .tag-count')?.offsetWidth ?? 0,
        gap: parseFloat(getComputedStyle(list).columnGap) || 0,
      }
    }
    const place = () => {
      const next = fitCount(sizes.current!, list.clientWidth)
      setFit((f) => (f?.key === key && f.shown === next.shown && f.cut === next.cut ? f : { key, ...next }))
    }
    place()
    // Resizing the column shows more or fewer tags.
    const observer = new ResizeObserver(place)
    observer.observe(list)
    return () => observer.disconnect()
  }, [key])

  // Space on the cell (see onCellKeyDown) toggles the popup; moving to another cell closes it.
  useEffect(() => {
    const list = ref.current!
    const toggle = () => setPeek((p) => !p)
    list.addEventListener(CELL_PEEK, toggle)
    return () => list.removeEventListener(CELL_PEEK, toggle)
  }, [])
  useEffect(() => {
    if (!peek) return
    const cell = ref.current!.closest('.td')
    const close = () => setPeek(false)
    cell?.addEventListener('focusout', close)
    return () => cell?.removeEventListener('focusout', close)
  }, [peek])

  return (
    <>
      <span
        ref={ref}
        className="chip-list"
        data-menu-anchor={anchorKey}
        data-overflow={cut ? 'true' : undefined}
        aria-hidden="true"
        onMouseEnter={(e) => cut && !peek && show(e.currentTarget, values.join(', '))}
        onMouseLeave={hide}
      >
        {values.slice(0, shown).map((v) => (
          <span key={v} className="tag">
            <span className="tag-text">{v}</span>
          </span>
        ))}
        {(!current || hidden > 0) && <span className="tag-count">+{current ? hidden : values.length}</span>}
      </span>
      <span className="sr-only">{values.join(', ')}</span>
      {tooltip}
      {peek && <TagPeek anchorKey={anchorKey} values={values} onClose={() => setPeek(false)} />}
    </>
  )
}

/** Every value, wrapped, in a popup under the cell. Escape or a press outside closes it. */
function TagPeek({ anchorKey, values, onClose }: { anchorKey: string; values: readonly string[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useAnchoredPosition(ref, anchorKey, 'start')
  useDismiss(true, '.tag-peek', onClose)
  // The cell already reads the whole list, so the popup is for sighted users only.
  return createPortal(
    <div ref={ref} className="tag-peek" aria-hidden="true">
      {values.map((v) => (
        <span key={v} className="tag">{v}</span>
      ))}
    </div>,
    document.body,
  )
}
