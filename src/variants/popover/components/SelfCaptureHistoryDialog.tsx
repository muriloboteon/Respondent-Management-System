import { useEffect, useRef } from 'react'
import { selfCaptures, type Respondent } from '@data/respondents'
import { Icon } from './Icon'
import { StatusTag } from './Tag'

/**
 * The Self Captures activities a respondent completed, newest first. Each Open button takes the
 * user to that activity's page (not built in the prototype, so it does nothing here).
 * Escape or Close closes it.
 */
export function SelfCaptureHistoryDialog({ respondent: r, onClose }: { respondent: Respondent; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const captures = selfCaptures(r)

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal modal-md"
      aria-labelledby="history-title"
      aria-describedby="history-sub"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id="history-title">Async activities</h2>
          <p id="history-sub" className="modal-sub">{r.name} has taken part in the following async activities:</p>
        </div>
        <button type="button" className="icon-btn bordered" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="modal-body">
        <ul className="work-list">
          {captures.map((c) => (
            <li key={c.activity} className="work-item">
              <span className="work-main">
                <span className="work-title">{c.activity}</span>
                <span className="work-sub">
                  <StatusTag status="Completed" />
                  {c.completedOn && <span>{c.completedOn}</span>}
                </span>
              </span>
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Open ${c.activity} on its activity page`}>
                Open
                <Icon name="arrowSquareOut" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}
