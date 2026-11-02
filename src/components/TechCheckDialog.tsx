import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { SEGMENTS, limitPII, techCheckResult, type Respondent } from '../data/respondents'
import { Icon } from './Icon'
import { Tag } from './Tag'

type TabId = 'contact' | 'segments' | 'screener'
const TABS: Array<{ id: TabId; label: string; beta?: boolean }> = [
  { id: 'contact', label: 'Contact' },
  { id: 'segments', label: 'Segments', beta: true },
  { id: 'screener', label: 'Screener' },
]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function ContactPanel({ r }: { r: Respondent }) {
  const [first, ...rest] = r.name.split(' ')
  const hidden = r.src === 'rio' || limitPII
  return (
    <dl className="field-grid">
      <Field label="First name">{first}</Field>
      <Field label="Last name">{rest.join(' ') || <span className="cell-dash">None</span>}</Field>
      {hidden ? (
        <Field label="Contact">
          <span className="field-note">
            <Icon name="lock" small />
            {r.src === 'rio' ? 'Respondent.io shares no contact info for this recruit.' : 'Hidden: Limit Access to PII is on for your role.'}
          </span>
        </Field>
      ) : (
        <>
          <Field label="Email">{r.email ?? <span className="cell-dash">None</span>}</Field>
          <Field label="Phone">{r.phone ?? <span className="cell-dash">None</span>}</Field>
        </>
      )}
    </dl>
  )
}

function SegmentsPanel({ r }: { r: Respondent }) {
  return (
    <dl className="field-grid">
      {SEGMENTS.map((s) => {
        const values = r.segments[s.key] ?? []
        return (
          <Field key={s.key} label={s.label}>
            {values.length ? <span className="chip-list">{values.map((v) => <Tag key={v}>{v}</Tag>)}</span> : <span className="cell-dash">Not set</span>}
          </Field>
        )
      })}
    </dl>
  )
}

/**
 * A respondent's tech check: the recorded video in a player on the left (no real recording in
 * the prototype), then who they are, what the check measured, and their contact, segment and
 * screener answers in tabs. Escape or Close closes it.
 */
export function TechCheckDialog({ respondent: r, onClose }: { respondent: Respondent; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [tab, setTab] = useState<TabId>('contact')
  const [mosHelp, setMosHelp] = useState(false)
  // The prototype has no recording: play only toggles the control.
  const [playing, setPlaying] = useState(false)
  const result = techCheckResult(r)

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = TABS.findIndex((t) => t.id === tab)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id
    setTab(next)
    document.getElementById(`${ids}-tab-${next}`)?.focus()
  }

  return (
    <dialog
      ref={ref}
      className="modal modal-tech"
      aria-labelledby={`${ids}-title`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2 id={`${ids}-title`}>Respondent details</h2>
        <button type="button" className="icon-btn bordered" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>

      <div className="modal-body tech-body">
        <figure className="player">
          <div className="player-screen">
            <div className="player-controls">
              <button type="button" className="player-btn" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
                <Icon name={playing ? 'pauseFill' : 'playFill'} />
              </button>
              <span className="player-time">0:00 / 0:15</span>
              <button type="button" className="player-btn player-push" aria-label="Mute"><Icon name="speakerHigh" /></button>
              <button type="button" className="player-btn" aria-label="Full screen"><Icon name="cornersOut" /></button>
              <button type="button" className="player-btn" aria-label="More options"><Icon name="dotsVertical" /></button>
            </div>
            <div className="player-progress" role="progressbar" aria-label="Video progress" aria-valuemin={0} aria-valuemax={15} aria-valuenow={0}>
              <span />
            </div>
          </div>
          <figcaption className="player-caption">
            <span className="player-name">{r.name}</span>
            {r.role && <span>{r.role}</span>}
          </figcaption>
        </figure>

        <div className="tech-main">
          <h3 className="tech-name">
            {r.name}
            <span className="tech-pid">{r.pid}</span>
          </h3>
          {result && (
            <section aria-label="Tech check results">
              <ul className="check-list">
                <li>
                  <Icon name="checkCircleFill" />
                  <span>
                    <strong>{result.mos.toFixed(2)}</strong> MOS score
                  </span>
                  <button
                    type="button"
                    className="btn-link muted check-help"
                    aria-expanded={mosHelp}
                    aria-controls={`${ids}-mos-help`}
                    onClick={() => setMosHelp((v) => !v)}
                  >
                    What’s this?
                  </button>
                </li>
                {mosHelp && (
                  <li id={`${ids}-mos-help`} className="check-note">
                    MOS (Mean Opinion Score) rates the connection quality from 1 to 5. A score of 3.5 or higher is good enough for a live session.
                  </li>
                )}
                <li><Icon name="checkCircleFill" /><span>Camera working</span></li>
                <li><Icon name="checkCircleFill" /><span>Microphone working</span></li>
                <li><Icon name="checkCircleFill" /><span>{result.browser} · {result.os}</span></li>
              </ul>
            </section>
          )}

          <div className="line-tabs" role="tablist" aria-label="Respondent answers" onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`${ids}-tab-${t.id}`}
                type="button"
                role="tab"
                className="line-tab"
                aria-selected={tab === t.id}
                aria-controls={`${ids}-panel`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.beta && <Tag variant="feature">Beta</Tag>}
              </button>
            ))}
          </div>
          <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${tab}`} className="tech-panel">
            {tab === 'contact' && <ContactPanel r={r} />}
            {tab === 'segments' && <SegmentsPanel r={r} />}
            {tab === 'screener' && <p className="tech-empty">No screener answers for this respondent yet.</p>}
          </div>
        </div>
      </div>
    </dialog>
  )
}
