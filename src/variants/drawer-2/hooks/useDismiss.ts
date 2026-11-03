import { useEffect, useRef } from 'react'

/** Open layers, oldest first. Escape only closes the newest one (a menu inside a panel). */
const layers: symbol[] = []

/**
 * Calls `onDismiss` on a pointer press outside every element matched by `inside`
 * (a CSS selector), and on Escape. Used by popover panels and floating menus.
 */
export function useDismiss(active: boolean, inside: string, onDismiss: (reason: 'outside' | 'escape') => void) {
  const callback = useRef(onDismiss)
  callback.current = onDismiss

  useEffect(() => {
    if (!active) return
    const layer = Symbol('layer')
    layers.push(layer)
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest(inside)) callback.current('outside')
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && layers[layers.length - 1] === layer) {
        e.stopPropagation()
        callback.current('escape')
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      layers.splice(layers.indexOf(layer), 1)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [active, inside])
}
