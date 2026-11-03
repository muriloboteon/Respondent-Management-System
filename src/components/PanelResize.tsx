import type { KeyboardEvent, PointerEvent } from 'react'

/**
 * The drag handle on the left edge of a side panel docked to the right (respondent detail,
 * filters). Dragging sets the width from the pointer; arrow keys step it (Shift for bigger steps).
 */
export function PanelResize({ label, width, min, max, onWidthChange }: {
  label: string
  width: number
  min: number
  max: number
  onWidthChange: (width: number) => void
}) {
  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const move = (ev: globalThis.PointerEvent) => onWidthChange(window.innerWidth - ev.clientX)
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      document.body.classList.remove('is-resizing')
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    document.body.classList.add('is-resizing')
  }
  const onResizeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16
    if (e.key === 'ArrowLeft') onWidthChange(width + step)
    else if (e.key === 'ArrowRight') onWidthChange(width - step)
    else return
    e.preventDefault()
  }

  return (
    <div
      className="detail-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={startResize}
      onKeyDown={onResizeKey}
    />
  )
}
