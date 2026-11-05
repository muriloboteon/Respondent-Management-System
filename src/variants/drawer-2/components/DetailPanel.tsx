import { useState, type ReactNode, type Ref } from 'react'
import {
  SEGMENTS,
  dupInfo,
  limitPII,
  sourceLabel,
  timezoneLabel,
  type MethodStatus,
  type Respondent,
} from '@data/respondents'
import { FloatingMenu } from './FloatingMenu'
import { Icon } from './Icon'
import { PanelResize } from './PanelResize'
import { StatusTag, Tag } from './Tag'
import { ASSIGN_ITEMS } from './respondentActions'


/** Width limits for the docked side panel. */
export const DETAIL_MIN_W = 360
export const DETAIL_MAX_W = 720

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function techResult(tech: string) {
  if (tech === 'Completed') return '15-second video recorded. MOS score, camera, mic and device ready to review.'
  if (tech === 'Attempted') return 'Attempted, not completed yet.'
  if (tech === 'Not sent') return 'Request not sent yet.'
  return 'No live session, so no tech check.'
}

function addedNote(r: Respondent) {
  if (r.src === 'paste') return 'Added today by pasting from a spreadsheet'
  if (r.src === 'upload') return `Added ${shortDate(r.addedOn)} by [teammate] through upload`
  return `Added ${shortDate(r.addedOn)} through ${sourceLabel(r).toLowerCase()}`
}

const METHODS = [
  { key: 'ai', label: 'AI interview' },
  { key: 'live', label: 'Live IDI' },
] as const

interface Field {
  label: string
  /** Full name shown on hover when the label is shortened or may be clamped. */
  title?: string
  value: ReactNode
}

function segmentFields(r: Respondent): Field[] {
  const tags = (values: readonly string[]) =>
    values.length ? <span className="chip-list">{values.map((v) => <Tag key={v}>{v}</Tag>)}</span> : <span className="cell-dash">Not set</span>
  // Short name when the segment has one; long names are clamped to two lines, so the
  // full name is the tooltip either way.
  return SEGMENTS.map((s) => ({
    label: s.shortLabel ?? s.label,
    title: s.shortLabel || s.label.length > 30 ? s.label : undefined,
    value: tags(r.segments[s.key] ?? []),
  }))
}

function detailFields(r: Respondent, hideContact: boolean): { shown: Field[]; empty: string[] } {
  const shown: Field[] = []
  const empty: string[] = []
  const add = (label: string, value: ReactNode | null) => (value === null ? empty.push(label) : shown.push({ label, value }))

  if (hideContact) {
    add(
      'Contact',
      <span className="field-note">
        <Icon name="lock" small />
        {r.src === 'rio' ? 'Respondent.io shares no contact info for this recruit.' : 'Hidden: Limit Access to PII is on for your role.'}
      </span>,
    )
  } else {
    add('Email', r.email ?? null)
    add('Phone', r.phone ?? null)
  }
  add('Timezone', timezoneLabel(r))
  add('Source', sourceLabel(r))
  add('Prior participation', r.prior)
  add('Incentive', null)
  add('Recruiter', null)
  return { shown, empty }
}

/** A label / value row; editable rows show a pencil on hover. */
function FieldRow({ label, title, editable = false, children }: { label: string; title?: string; editable?: boolean; children: ReactNode }) {
  return (
    <div className={editable ? 'field-row editable' : 'field-row'}>
      <dt title={title}>{label}</dt>
      <dd>
        {children}
        {editable && (
          <button type="button" className="icon-btn field-edit" aria-label={`Edit ${label}`}>
            <Icon name="pencil" />
          </button>
        )}
      </dd>
    </div>
  )
}

/** A collapsible section with a chevron, open by default (Jira's "▾ Description"). */
function Fold({ title, aside, boxed = false, open = true, className = '', children }: {
  title: string
  aside?: ReactNode
  boxed?: boolean
  open?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <details className={['fold', boxed && 'fold-box', className].filter(Boolean).join(' ')} open={open}>
      <summary>
        <Icon name="caretDown" />
        <h3>{title}</h3>
        {aside && <span className="fold-aside">{aside}</span>}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}

/** A closed one-line panel that expands for detail (Jira's app "glances"). */
function Glance({ title, summary, children }: { title: string; summary: ReactNode; children: ReactNode }) {
  return (
    <details className="glance">
      <summary>
        <Icon name="caretDown" />
        <span className="glance-title">{title}</span>
        <span className="glance-summary">{summary}</span>
      </summary>
      <div className="glance-body">{children}</div>
    </details>
  )
}

function WorkItem({ label, m, kind }: { label: string; m: MethodStatus; kind: 'ai' | 'live' }) {
  const action = m.s === 'Not assigned' ? (kind === 'live' ? 'Schedule' : 'Assign') : m.s === 'Not scheduled' ? 'Schedule' : ''
  return (
    <li className="work-item">
      <span className="work-main">
        <span className="work-title">{label}</span>
        <span className="work-sub">
          <StatusTag status={m.s} />
          {m.sub && <span>{m.sub}</span>}
        </span>
      </span>
      {action && <button type="button" className="btn btn-sm btn-outline">{action}</button>}
    </li>
  )
}

interface Props {
  r: Respondent
  all: readonly Respondent[]
  /** True when the panel slides over the page (narrow screens). */
  asDialog: boolean
  /** True when the docked panel can be resized (wide screens). */
  resizable: boolean
  width: number
  hidden: boolean
  closeRef: Ref<HTMLButtonElement>
  prevId: string | null
  nextId: string | null
  onNavigate: (id: string) => void
  onWidthChange: (width: number) => void
  /** True when the panel is shown as a centered modal instead of the side panel. */
  expanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  /** Asks to remove this respondent from the project. */
  onRemove: () => void
}

export function DetailPanel({
  r, all, asDialog, resizable, width, hidden, closeRef, prevId, nextId, onNavigate, onWidthChange, expanded, onToggleExpand, onClose, onRemove,
}: Props) {
  const [assignOpen, setAssignOpen] = useState(false)
  const dup = dupInfo(r, all)
  const hideContact = r.src === 'rio' || limitPII
  const { shown, empty } = detailFields(r, hideContact)

  return (
    <aside
      className="detail"
      aria-labelledby="detail-h"
      role={asDialog ? 'dialog' : undefined}
      aria-modal={asDialog || undefined}
      inert={hidden}
    >
      {resizable && (
        <PanelResize label="Resize respondent panel" width={width} min={DETAIL_MIN_W} max={DETAIL_MAX_W} onWidthChange={onWidthChange} />
      )}

      <div className="detail-bar">
        <span className="detail-kind">
          <Icon name="user" />
          Respondent
        </span>
        <span className="detail-bar-actions">
          <button type="button" className="icon-btn" aria-label="Previous respondent" title="Previous respondent" disabled={!prevId} onClick={() => prevId && onNavigate(prevId)}>
            <Icon name="caretUp" />
          </button>
          <button type="button" className="icon-btn" aria-label="Next respondent" title="Next respondent" disabled={!nextId} onClick={() => nextId && onNavigate(nextId)}>
            <Icon name="caretDown" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={expanded ? 'Collapse to side panel' : 'Expand to modal'}
            title={expanded ? 'Collapse to side panel' : 'Expand'}
            onClick={onToggleExpand}
          >
            <Icon name={expanded ? 'arrowsIn' : 'arrowsOut'} />
          </button>
          <span className="bar-sep" aria-hidden="true" />
          <button ref={closeRef} type="button" className="icon-btn detail-close" aria-label="Close respondent detail" title="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </span>
      </div>

      <div className="detail-scroll">
        <header className="detail-head">
          <span className="crumbs">
            <span>{sourceLabel(r)}</span>
            <span aria-hidden="true">/</span>
            <strong>{r.pid}</strong>
          </span>
          <h2 id="detail-h">{r.name}</h2>
          {dup && <Tag variant="warn">{dup.note}</Tag>}
          {/* Same actions as the bulk actions and the row menu, minus Segment (the Segments
              section below edits them); Export and Remove are icon-only here. */}
          <span className="detail-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              data-menu-anchor="detail-assign"
              aria-haspopup="menu"
              aria-expanded={assignOpen}
              onClick={() => setAssignOpen((open) => !open)}
            >
              Assign
              <Icon name="caretDown" small />
            </button>
            <button type="button" className="btn btn-sm btn-outline btn-icon" aria-label="Export to CSV" title="Export to CSV">
              <Icon name="download" />
            </button>
            <button type="button" className="btn btn-sm btn-ghost btn-danger btn-icon" aria-label="Remove from project" title="Remove from project" onClick={onRemove}>
              <Icon name="trash" />
            </button>
          </span>
        </header>

        {/* Who they are (details), how they're grouped (segments), then what they're doing
            (sessions and activities), followed by the checks and dates. */}
        <div className="detail-body">
          <Fold title="Details" boxed>
            <dl className="field-grid">
              {shown.map((f) => <FieldRow key={f.label} label={f.label}>{f.value}</FieldRow>)}
            </dl>
          </Fold>

          {empty.length > 0 && (
            <Fold title="More fields" boxed open={false} aside={empty.join(', ')}>
              <dl className="field-grid">
                {empty.map((label) => (
                  <FieldRow key={label} label={label} editable>
                    <span className="cell-dash">None</span>
                  </FieldRow>
                ))}
              </dl>
            </Fold>
          )}

          <Fold title="Segments" boxed>
            <dl className="field-grid">
              {segmentFields(r).map((f) => <FieldRow key={f.label} label={f.label} title={f.title} editable>{f.value}</FieldRow>)}
            </dl>
            <button type="button" className="btn-add">
              <Icon name="plus" small />
              Add segment
            </button>
          </Fold>

          <Fold title="Sessions and activities" boxed>
            <ul className="work-list">
              {METHODS.map((m) => <WorkItem key={m.key} label={m.label} m={r[m.key]} kind={m.key} />)}
            </ul>
          </Fold>

          <div className="glance-group">
            <Glance title="Tech check" summary={<StatusTag status={r.tech === '—' ? 'Not needed' : r.tech} />}>
              <p>{techResult(r.tech)}</p>
            </Glance>
            <Glance title="Consent form" summary={<StatusTag status={r.consent} />}>
              <p>{r.consent === 'Signed' ? 'Signed Oct 3' : 'Not signed yet'}</p>
              {r.consent === 'Signed' && <a href="#consent-form">View submitted form</a>}
            </Glance>
          </div>

          <div className="detail-dates">
            <span>{addedNote(r)}</span>
            {r.lastActivity && <span>Last activity {shortDate(r.lastActivity)}</span>}
          </div>
        </div>
      </div>

      {assignOpen && (
        <FloatingMenu
          anchorKey="detail-assign"
          label={`Assign ${r.name}`}
          align="start"
          width={200}
          items={ASSIGN_ITEMS}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </aside>
  )
}
