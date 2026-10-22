import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { Icon, type IconName } from './Icon'

export interface MenuItem {
  label: string
  icon?: IconName
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
  onSelect?: () => void
}

export function anchorFor(key: string) {
  return document.querySelector<HTMLElement>(`[data-menu-anchor="${key}"]`)
}

/**
 * Keeps a fixed-position layer under (or, when there is no room, above) the element
 * marked `data-menu-anchor={anchorKey}`, following scrolls and resizes.
 */
export function useAnchoredPosition(ref: RefObject<HTMLElement | null>, anchorKey: string, align: 'start' | 'end') {
  useLayoutEffect(() => {
    const layer = ref.current
    if (!layer) return
    const place = () => {
      const anchor = anchorFor(anchorKey)
      if (!anchor) return
      const a = anchor.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      let left = align === 'end' ? a.right - layer.offsetWidth : a.left
      left = Math.max(8, Math.min(left, vw - layer.offsetWidth - 8))
      let top = a.bottom + 4
      if (top + layer.offsetHeight > vh - 8 && a.top - layer.offsetHeight - 4 > 8) top = a.top - layer.offsetHeight - 4
      layer.style.left = `${left}px`
      layer.style.top = `${Math.max(8, top)}px`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [ref, anchorKey, align])
}

/**
 * A menu rendered in a fixed layer and positioned under its trigger, so the
 * table's horizontal scroll container never clips it.
 */
export function FloatingMenu({
  anchorKey,
  label,
  align,
  width,
  items,
  onClose,
}: {
  anchorKey: string
  label: string
  align: 'start' | 'end'
  width: number
  items: MenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const close = (restoreFocus: boolean) => {
    onClose()
    if (restoreFocus) anchorFor(anchorKey)?.focus()
  }

  useDismiss(true, `.menu, [data-menu-anchor="${anchorKey}"]`, (reason) => close(reason === 'escape'))

  useAnchoredPosition(ref, anchorKey, align)
  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.menu-item:not(:disabled)')?.focus({ preventScroll: true })
  }, [anchorKey])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const enabled = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('.menu-item:not(:disabled)'))
    const i = enabled.indexOf(document.activeElement as HTMLButtonElement)
    enabled[(i + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]?.focus()
  }

  const nodes: ReactNode[] = []
  items.forEach((item, i) => {
    if (item.separatorBefore) nodes.push(<div key={`sep-${i}`} className="menu-sep" role="separator" />)
    nodes.push(
      <button
        key={item.label}
        type="button"
        role="menuitem"
        className={item.danger ? 'menu-item danger' : 'menu-item'}
        disabled={item.disabled}
        onClick={() => {
          item.onSelect?.()
          close(true)
        }}
      >
        {item.icon && <Icon name={item.icon} />}
        {item.label}
      </button>,
    )
  })

  return (
    <div ref={ref} className="menu" role="menu" aria-label={label} style={{ width }} onKeyDown={onKeyDown}>
      {nodes}
    </div>
  )
}
