import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import arrow from '../assets/tooltip/arrow.svg'
import { Icon, type IconName } from './Icon'

/** Hover delay before a tooltip shows. */
const SHOW_DELAY = 300

/** A tooltip with a title line (and optional icon) above its text. */
export interface TooltipTitle {
  text: string
  icon?: IconName
}

/**
 * Discuss DS "Tooltip" (Content=Simple, or with a `title` line above the text). Rendered in a
 * fixed layer on <body>, under the anchor (Arrow=Top) or above it when there is no room below
 * (Arrow=Bottom), kept inside the viewport with the arrow still pointing at the anchor's center.
 * Purely visual: it repeats text that is already on the page, so it is hidden from assistive tech.
 */
export function Tooltip({ label, title, anchor }: { label: string; title?: TooltipTitle; anchor: DOMRect }) {
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
      {title ? (
        <span className="tooltip-body tooltip-rich">
          <span className="tooltip-title">
            {title.icon && <Icon name={title.icon} />}
            {title.text}
          </span>
          <span className="tooltip-text">{label}</span>
        </span>
      ) : (
        <span className="tooltip-body">{label}</span>
      )}
    </div>,
    document.body,
  )
}

/** Shows a tooltip for an element after the hover delay; `hide` cancels or removes it. */
function useHoverTooltip() {
  const timer = useRef<number | undefined>(undefined)
  const [tip, setTip] = useState<{ label: string; title?: TooltipTitle; anchor: DOMRect } | null>(null)

  const show = (el: HTMLElement, label: string, title?: TooltipTitle) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setTip({ label, title, anchor: el.getBoundingClientRect() }), SHOW_DELAY)
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

  return { tooltip: tip && <Tooltip label={tip.label} title={tip.title} anchor={tip.anchor} />, show, hide }
}

/**
 * Text that truncates with an ellipsis and shows its full value in a tooltip on hover,
 * only while it is actually cut off. With a `hint`, the tooltip always shows and carries
 * the hint, after the full value when the text is cut off.
 */
export function TruncatedText({ className, hint, children }: { className: string; hint?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const { tooltip, show, hide } = useHoverTooltip()

  const onEnter = () => {
    const el = ref.current
    if (!el) return
    const cutOff = el.scrollWidth > el.clientWidth
    const text = el.textContent ?? ''
    if (hint) show(el, cutOff ? `${text} · ${hint}` : hint)
    else if (cutOff) show(el, text)
  }

  return (
    <>
      <span ref={ref} className={className} onMouseEnter={onEnter} onMouseLeave={hide}>
        {children}
      </span>
      {tooltip}
    </>
  )
}

/** An icon-only button: `tip` shows in a tooltip on hover, `label` names it for screen readers. */
export function IconButton({
  className,
  label,
  tip,
  onClick,
  children,
}: {
  className: string
  label: string
  tip: string
  onClick: () => void
  children: ReactNode
}) {
  const { tooltip, show, hide } = useHoverTooltip()
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        onClick={onClick}
        onMouseEnter={(e) => show(e.currentTarget, tip)}
        onMouseLeave={hide}
      >
        {children}
      </button>
      {tooltip}
    </>
  )
}

/**
 * An icon that stands in for a text label: the label is in a tooltip and for screen readers.
 * With a `detail`, the tooltip shows the label as its title (with `icon`) above the detail.
 */
export function IconLabel({
  className,
  label,
  detail,
  icon,
  children,
}: {
  className: string
  label: string
  detail?: string
  icon?: IconName
  children: ReactNode
}) {
  const { tooltip, show, hide } = useHoverTooltip()
  return (
    <>
      <span
        className={className}
        onMouseEnter={(e) => (detail ? show(e.currentTarget, detail, { text: label, icon }) : show(e.currentTarget, label))}
        onMouseLeave={hide}
      >
        {children}
        <span className="sr-only">{detail ? `${label}. ${detail}` : label}</span>
      </span>
      {tooltip}
    </>
  )
}
