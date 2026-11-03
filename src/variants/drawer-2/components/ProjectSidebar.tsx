import { useState, type CSSProperties } from 'react'
import caretDown from '../assets/sidebar/caret-down.svg'
import caretUp from '../assets/sidebar/caret-up.svg'
import clipboard from '../assets/sidebar/clipboard.svg'
import houseFill from '../assets/sidebar/house-fill.svg'
import house from '../assets/sidebar/house.svg'
import leftSidebar from '../assets/sidebar/left-sidebar.svg'
import lightbulb from '../assets/sidebar/lightbulb.svg'
import pencilRuler from '../assets/sidebar/pencil-ruler.svg'
import rightSidebar from '../assets/sidebar/right-sidebar.svg'
import sliders from '../assets/sidebar/sliders.svg'
import video from '../assets/sidebar/video.svg'

type Section = { label: string; icon: string; selectedIcon?: string; items?: string[] }

/** Sections with `items` expand into a submenu; the others are plain links. */
const SECTIONS: Section[] = [
  { label: 'Overview', icon: house, selectedIcon: houseFill },
  { label: 'Research Design', icon: pencilRuler, items: ['Live Interviews', 'AI Interviews', 'Self-Paced Activities'] },
  { label: 'Fielding', icon: clipboard, items: ['Respondents'] },
  { label: 'Responses', icon: video, items: [] },
  { label: 'Insights', icon: lightbulb, items: [] },
  { label: 'Settings', icon: sliders, items: [] },
]

export const PROJECT_SIDEBAR_ID = 'project-sidebar'

/** The DS icons are single-color (foreground) SVGs, painted with currentColor so hover can tint them. */
function MaskIcon({ src }: { src: string }) {
  return <span className="ps-icon" style={{ '--icon': `url("${src}")` } as CSSProperties} aria-hidden="true" />
}

/** DS "Collapse sidebar": the left-panel icon while the sidebar is open, the right-panel one while it is closed. */
export function ProjectSidebarToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="nav-toggle"
      aria-label={open ? 'Hide project menu' : 'Show project menu'}
      aria-expanded={open}
      aria-controls={PROJECT_SIDEBAR_ID}
      onClick={onToggle}
    >
      <MaskIcon src={open ? leftSidebar : rightSidebar} />
    </button>
  )
}

type ProjectSidebarProps = {
  hidden: boolean
  /** The page being shown: a section, or a submenu item inside one. */
  current: { section: string; item?: string }
}

/**
 * Discuss DS "Project Sidebar" (Figma: 04 — Collapsible): project switcher, then the project's
 * sections. Sections with a submenu toggle open and closed; the current page's section starts open.
 */
export function ProjectSidebar({ hidden, current }: ProjectSidebarProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([current.section]))
  const toggle = (label: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(label)) next.add(label)
      return next
    })

  return (
    <aside className="project-sidebar" id={PROJECT_SIDEBAR_ID} aria-label="Project" hidden={hidden}>
      <button type="button" className="project-switcher">
        <span className="project-switcher-name">Project One</span>
        <MaskIcon src={caretDown} />
      </button>
      <nav className="ps-nav" aria-label="Project">
        {SECTIONS.map((s) => {
          if (!s.items) {
            const selected = s.label === current.section
            return (
              <button key={s.label} type="button" className="ps-item" aria-current={selected ? 'page' : undefined}>
                <MaskIcon src={selected && s.selectedIcon ? s.selectedIcon : s.icon} />
                <span className="ps-label">{s.label}</span>
              </button>
            )
          }
          const expanded = open.has(s.label)
          const submenuId = `ps-sub-${s.label.toLowerCase().replace(/\s+/g, '-')}`
          return (
            <div key={s.label} className="ps-group">
              <button
                type="button"
                className="ps-item"
                aria-expanded={expanded}
                aria-controls={s.items.length > 0 ? submenuId : undefined}
                onClick={() => toggle(s.label)}
              >
                <MaskIcon src={s.icon} />
                <span className="ps-label">{s.label}</span>
                {/* As in the DS: caret down while open, caret up while closed */}
                <MaskIcon src={expanded ? caretDown : caretUp} />
              </button>
              {expanded && s.items.length > 0 && (
                <ul className="ps-submenu" id={submenuId}>
                  {s.items.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className="ps-subitem"
                        aria-current={s.label === current.section && item === current.item ? 'page' : undefined}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
