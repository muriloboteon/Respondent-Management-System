import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import arrow from '../assets/tooltip/arrow.svg'

/** Hover delay before a tooltip shows. */
const SHOW_DELAY = 300

/**
 * Discuss DS "Tooltip" (Content=Simple). Rendered in a fixed layer on <body>, under the anchor
 * (Arrow=Top) or above it when there is no room below (Arrow=Bottom), kept inside the viewport
 * with the arrow still pointing at the anchor's center.
 * Purely visual: it repeats text that is already on the page, so it is hidden from assistive tech.
 */
export function Tooltip({ label, anchor }: { label: string; anchor: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const layer = ref.current
    if (!layer) return
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const center = anchor.left + anchor.width / 2
    const left = Math.max(8, Math.min(center - layer.offsetWidth / 2, vw - layer.offsetWidth - 8))
    const below = anchor.bottom + 4 + layer.offsetHeight <= vh - 8
    layer.dataset.placement = below ? 'bottom' : 'top'
    layer.style.left = `${left}px`
    layer.style.top = `${below ? anchor.bottom + 4 : anchor.top - 4 - layer.offsetHeight}px`
    layer.style.setProperty('--arrow-x', `${center - left}px`)
  }, [anchor])

  return createPortal(
    <div ref={ref} className="tooltip" aria-hidden="true">
      <span className="tooltip-arrow">
        <img src={arrow} width={10.3923} height={6} alt="" />
      </span>
      <span className="tooltip-body">{label}</span>
    </div>,
    document.body,
  )
}

/**
 * Text that truncates with an ellipsis and shows its full value in a tooltip on hover,
 * only while it is actually cut off.
 */
export function TruncatedText({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [tip, setTip] = useState<{ label: string; anchor: DOMRect } | null>(null)

  const show = () => {
    const el = ref.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setTip({ label: el.textContent ?? '', anchor: el.getBoundingClientRect() }), SHOW_DELAY)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setTip(null)
  }

  // Scrolling, clicking (sort, resize, menus) or leaving the window hides it.
  useEffect(() => {
    if (!tip) return
    window.addEventListener('scroll', hide, true)
    window.addEventListener('pointerdown', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('pointerdown', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [tip])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <>
      <span ref={ref} className={className} onMouseEnter={show} onMouseLeave={hide}>
        {children}
      </span>
      {tip && <Tooltip label={tip.label} anchor={tip.anchor} />}
    </>
  )
}
