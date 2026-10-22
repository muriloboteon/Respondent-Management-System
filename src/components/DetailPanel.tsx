import type { Ref } from 'react'
import { answersIn, dupInfo, idLine, limitPII, viaLabel, viaSub, type MethodStatus, type Respondent } from '../data/respondents'
import { Icon } from './Icon'
import { StatusTag, Tag } from './Tag'

function Activity({ method, m, kind }: { method: string; m: MethodStatus; kind: 'diary' | 'ai' | 'live' }) {
  const action = m.s === 'Not assigned' ? (kind === 'live' ? 'Schedule' : 'Assign') : m.s === 'Not scheduled' ? 'Schedule' : ''
  return (
    <div className="box box-row">
      <span className="box-stack">
        <span className="box-title">{method}</span>
        <span className="box-sub">
          <StatusTag status={m.s} />
          {m.sub && <span>{m.sub}</span>}
        </span>
      </span>
      {action && <button type="button" className="btn btn-sm btn-outline">{action}</button>}
    </div>
  )
}

function techResult(tech: string) {
  if (tech === 'Completed') return '15-second video recorded. MOS score, camera, mic and device ready to review.'
  if (tech === 'Attempted') return 'Attempted, not completed yet.'
  if (tech === 'Not sent') return 'Request not sent yet.'
  return 'No live session, so no tech check.'
}

interface Props {
  r: Respondent
  all: readonly Respondent[]
  /** True when the panel is a modal drawer (narrow screens). */
  asDrawer: boolean
  hidden: boolean
  closeRef: Ref<HTMLButtonElement>
  onClose: () => void
}

function addedNote(r: Respondent) {
  if (r.src === 'paste') return 'Added today by pasting from a spreadsheet'
  if (r.via === 'Agency upload') return 'Added Oct 3 by [teammate] through upload'
  return `Added Oct 2 through ${viaLabel(r.via).toLowerCase()}`
}

function answeredNote(r: Respondent) {
  if (r.src === 'paste') return 'Pasted from a spreadsheet, today'
  return r.via === 'Agency upload' ? 'Mapped from upload, Oct 3' : 'Answered Oct 2'
}

export function DetailPanel({ r, all, asDrawer, hidden, closeRef, onClose }: Props) {
  const dup = dupInfo(r, all)
  const hideContact = r.src === 'rio' || limitPII
  const screener = answersIn(r)

  return (
    <aside
      className="card detail"
      aria-labelledby="detail-h"
      role={asDrawer ? 'dialog' : undefined}
      aria-modal={asDrawer || undefined}
      inert={hidden}
    >
      <div className="detail-head">
        <div className="detail-id">
          <span className={`avatar ${r.avatarClass}`} aria-hidden="true">{r.initials}</span>
          <div className="detail-id-text">
            <h2 id="detail-h">{r.name}</h2>
            <span className="meta"><strong>{r.pid}</strong> · {idLine(r)}</span>
            <span className="meta">{viaLabel(r.via)} · {viaSub(r)}</span>
            {dup && <Tag variant="warn">{dup.note}</Tag>}
          </div>
        </div>
        <button ref={closeRef} type="button" className="icon-btn bordered" aria-label="Close respondent detail" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>

      <div className="detail-body">
        <section className="d-section">
          <h3 className="overline">Contact info</h3>
          {hideContact ? (
            <div className="note">
              <Icon name="lock" />
              <span>{r.src === 'rio' ? 'Respondent.io shares no contact info for this recruit.' : 'Hidden: Limit Access to PII is on for your role.'}</span>
            </div>
          ) : (
            <div className="contact"><span>{r.email}</span><span>{r.phone}</span></div>
          )}
        </section>

        <section className="d-section">
          <h3 className="overline">Sessions and activities</h3>
          <Activity method="Diary (self-paced activity)" m={r.diary} kind="diary" />
          <Activity method="AI interview" m={r.ai} kind="ai" />
          <Activity method="Live IDI" m={r.live} kind="live" />
        </section>

        <section className="d-section">
          <h3 className="overline">Tech check and consent form</h3>
          <div className="box">
            <span className="box-row">
              <span className="box-title">Tech check</span>
              <StatusTag status={r.tech === '—' ? 'Not needed' : r.tech} />
            </span>
            <span className="box-sub">{techResult(r.tech)}</span>
          </div>
          <div className="box">
            <span className="box-row">
              <span className="box-title">Consent form</span>
              <StatusTag status={r.consent} />
            </span>
            <span className="box-sub box-row" style={{ width: '100%' }}>
              <span>{r.consent === 'Signed' ? 'Signed Oct 3' : 'Not signed yet'}</span>
              {r.consent === 'Signed' && <a href="#consent-form">View submitted form</a>}
            </span>
          </div>
        </section>

        <section className="d-section">
          <div className="d-section-head">
            <h3 className="overline">Segments</h3>
            <button type="button" className="btn-link">Edit</button>
          </div>
          <div className="seg-grid">
            {([['Market', [r.market]], ['Buyer status', r.buyer ? [r.buyer] : []], ['Shopper type', r.shopper]] as const).map(([attr, values]) => (
              <SegmentRow key={attr} attr={attr} values={values} />
            ))}
          </div>
          <button type="button" className="btn-dashed">+ Add segment</button>
        </section>

        <section className="d-section">
          <h3 className="overline">Screener answers</h3>
          <div className="screener">
            <div className="screener-head">
              <strong>Screener: {screener}</strong>
              <span>{answeredNote(r)}</span>
            </div>
            <div className="screener-body">
              <Answer q="Which brands have you bought in the last 6 months? (multi-select)" values={r.brands} />
              <Answer q="How often do you buy snacks?" values={r.freq ? [r.freq] : []} />
            </div>
          </div>
        </section>

        <div className="detail-actions">
          <button type="button" className="btn btn-primary">Schedule live session</button>
          <button type="button" className="btn btn-outline">Assign AI interview</button>
          <button type="button" className="btn btn-outline">Assign activity</button>
        </div>
        <span className="added-by">{addedNote(r)}</span>
      </div>
    </aside>
  )
}

function SegmentRow({ attr, values }: { attr: string; values: readonly string[] }) {
  return (
    <>
      <span className="attr">{attr}</span>
      <span className="chip-list">{values.length ? values.map((v) => <Tag key={v} large>{v}</Tag>) : <span className="cell-dash">Not set</span>}</span>
    </>
  )
}

function Answer({ q, values }: { q: string; values: string[] }) {
  return (
    <div className="answer">
      <span className="q">{q}</span>
      <span className="chip-list">{values.length ? values.map((v) => <Tag key={v} variant="outline" large>{v}</Tag>) : <span className="cell-dash">No answer</span>}</span>
    </div>
  )
}
