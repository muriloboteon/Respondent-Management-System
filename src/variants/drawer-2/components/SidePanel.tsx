import type { ReactNode, Ref } from 'react'
import { FILTER_MAX_W, FILTER_MIN_W } from './FilterPanel'
import { Icon, type IconName } from './Icon'
import { PanelResize } from './PanelResize'

interface Props {
  id: string
  title: string
  icon: IconName
  /** True when the panel slides over the page (narrow screens). */
  asDialog: boolean
  /** True when the docked panel can be resized (wide screens). */
  resizable: boolean
  width: number
  onWidthChange: (width: number) => void
  closeRef: Ref<HTMLButtonElement>
  onClose: () => void
  children: ReactNode
}

/**
 * A side panel in the detail panel's place, with the same bar as the filters drawer: Views and
 * Columns open here, so Filters, Views and Columns all open the same way. Shares the filters
 * drawer's width.
 */
export function SidePanel({ id, title, icon, asDialog, resizable, width, onWidthChange, closeRef, onClose, children }: Props) {
  return (
    <aside id={id} className="detail tool-panel" aria-labelledby={`${id}-h`} role={asDialog ? 'dialog' : undefined} aria-modal={asDialog || undefined}>
      {resizable && (
        <PanelResize label={`Resize ${title.toLowerCase()} panel`} width={width} min={FILTER_MIN_W} max={FILTER_MAX_W} onWidthChange={onWidthChange} />
      )}
      <div className="detail-bar">
        <span className="detail-kind" id={`${id}-h`}>
          <Icon name={icon} />
          {title}
        </span>
        <span className="detail-bar-actions">
          <button ref={closeRef} type="button" className="icon-btn detail-close" aria-label={`Close ${title.toLowerCase()}`} title="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </span>
      </div>
      <div className="detail-scroll tool-panel-body">{children}</div>
    </aside>
  )
}
