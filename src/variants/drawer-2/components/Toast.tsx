import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export interface ToastMessage {
  /** A new id shows the toast again, even with the same text. */
  id: number
  text: string
  action?: { label: string; onClick: () => void }
}

/** How long a toast stays; one with an action (Undo) stays longer. Hovering or focusing it pauses the timer. */
const SHOW_MS = 4000
const SHOW_WITH_ACTION_MS = 7000

/**
 * A short confirmation at the bottom of the page. While a modal is open the page behind it is inert,
 * so the toast renders inside the topmost open modal (Undo after deleting a view in Manage views
 * stays clickable) and moves back to the page when that modal closes.
 */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!toast) return
    const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
    const top = open[open.length - 1] ?? null
    setHost(top)
    if (!top) return
    const onClose = () => setHost(null)
    top.addEventListener('close', onClose)
    return () => top.removeEventListener('close', onClose)
  }, [toast?.id])

  useEffect(() => {
    if (!toast || paused) return
    const timer = window.setTimeout(onDismiss, toast.action ? SHOW_WITH_ACTION_MS : SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  // The live region stays mounted so screen readers announce each new message.
  return createPortal(
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className="toast"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <Icon name="check" />
          <span className="toast-text">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="btn-link toast-action"
              onClick={() => {
                toast.action!.onClick()
                setPaused(false)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="icon-btn toast-close"
            aria-label="Dismiss"
            onClick={() => {
              setPaused(false)
              onDismiss()
            }}
          >
            <Icon name="x" small />
          </button>
        </div>
      )}
    </div>,
    host ?? document.body,
  )
}
