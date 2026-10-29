import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { Respondent } from '../data/respondents'
import { METRICS, matchesTree, type MetricId } from '../filters/filters'
import { TruncatedText } from './Tooltip'

type Props = {
  /** The respondents loaded in the prototype (a sample of the project). */
  data: Respondent[]
  /** Respondents in the whole project. */
  total: number
  active: MetricId | null
  onSelect: (id: MetricId) => void
  /** The table is scrolled, so the strip shows one line per metric (see .metrics-condensed). */
  condensed: boolean
}

const fmt = (n: number) => n.toLocaleString('en-US')

/**
 * Big numbers above the table. Each one filters the list (Stripe-style status tabs with counts).
 * Counts are scaled from the loaded sample to the project total, like the title's count.
 * The strip condenses to one line while the table is scrolled (see .metrics-condensed).
 */
export function MetricStrip({ data, total, active, onSelect, condensed }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useMetricGlide(ref, condensed)

  return (
    <div ref={ref} className="metrics" role="group" aria-label="Respondent metrics. Each one filters the list.">
      {METRICS.map((m) => {
        const share = data.length ? data.filter((r) => matchesTree(r, m.tree)).length / data.length : 0
        const count = m.id === 'all' ? total : Math.round(share * total)
        return (
          <button
            key={m.id}
            type="button"
            className={m.attention && count > 0 ? 'metric is-attention' : 'metric'}
            aria-pressed={active === m.id}
            onClick={() => onSelect(m.id)}
          >
            <TruncatedText className="metric-label">{m.label}</TruncatedText>
            <span className="metric-value">{fmt(count)}</span>
            <TruncatedText className="metric-hint">{m.id === 'all' ? 'in this project' : `${Math.round(share * 100)}% of respondents`}</TruncatedText>
          </button>
        )
      })}
    </div>
  )
}

/** Shrinking is a little quicker than growing back; each card starts a beat after the previous one. */
const GLIDE = { condenseMs: 420, expandMs: 500, staggerMs: 35, easing: 'cubic-bezier(.4, 0, .2, 1)' }

type Box = { x: number; y: number; w: number }
// Layout position inside the card (offsets ignore transforms, so a running glide doesn't skew them)
const boxOf = (el: HTMLElement): Box => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth })

/**
 * FLIP: when the strip condenses or expands, each label, number and hint starts where it was
 * drawn before the switch and glides to its new spot; the number also scales between its two
 * sizes. Positions are remembered after every layout, so the "before" is known when the
 * switch has already happened. Reduced motion skips this (the CSS crossfades instead).
 */
function useMetricGlide(strip: RefObject<HTMLDivElement | null>, condensed: boolean) {
  const boxes = useRef(new WeakMap<HTMLElement, Box>())
  const parts = () => Array.from(strip.current?.querySelectorAll<HTMLElement>('.metric > *') ?? [])
  const remember = () => parts().forEach((el) => boxes.current.set(el, boxOf(el)))

  useLayoutEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cards = Array.from(strip.current?.children ?? [])
    for (const el of parts()) {
      const before = boxes.current.get(el)
      if (!before) continue
      // Where it is drawn right now: its old layout plus any glide still running
      const t = getComputedStyle(el).transform
      const m = new DOMMatrixReadOnly(t === 'none' ? undefined : t)
      el.getAnimations().forEach((a) => a.cancel())
      const after = boxOf(el)
      const dx = before.x + m.e - after.x
      const dy = before.y + m.f - after.y
      const scale = el.classList.contains('metric-value') && after.w > 0 ? (before.w * m.a) / after.w : 1
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.01) continue
      el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: 'none' }], {
        duration: condensed ? GLIDE.condenseMs : GLIDE.expandMs,
        delay: cards.indexOf(el.parentElement!) * GLIDE.staggerMs,
        easing: GLIDE.easing,
        fill: 'backwards',
      })
    }
  }, [condensed])

  // Runs after the glide above (same commit) and after every other render
  useLayoutEffect(remember)
  // Window and panel resizes move things without a render
  useEffect(() => {
    const el = strip.current
    if (!el) return
    const observer = new ResizeObserver(remember)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
}
