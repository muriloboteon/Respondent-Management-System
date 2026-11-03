import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Small modal that asks before a destructive action. Focus starts on Cancel,
 * and Escape cancels.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('[data-cancel]')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal modal-sm"
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="modal-body">
        <h2 id="confirm-title" className="modal-title">{title}</h2>
        <p id="confirm-body" className="modal-sub">{children}</p>
      </div>
      <div className="modal-foot">
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" data-cancel onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-destructive" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
