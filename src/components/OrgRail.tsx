import avatar from '../assets/sidebar/avatar.png'
import brain from '../assets/sidebar/brain.svg'
import chartDonut from '../assets/sidebar/chart-donut.svg'
import folderSelected from '../assets/sidebar/folder-selected.svg'
import folder from '../assets/sidebar/folder.svg'
import gear from '../assets/sidebar/gear.svg'
import sparkle from '../assets/sidebar/sparkle.svg'
import userCircle from '../assets/sidebar/user-circle.svg'

type NavItem = { label: string; icon: string; selectedIcon?: string }

const NAV_ITEMS: NavItem[] = [
  { label: 'Projects', icon: folder, selectedIcon: folderSelected },
  { label: 'Personas', icon: userCircle },
  { label: 'Intelligence', icon: brain },
  { label: 'Segments', icon: chartDonut },
  { label: 'Admin', icon: gear },
]

/**
 * Discuss DS "Org Rail" (Figma: 03 — Project Sidebar): org monogram, the org-level areas,
 * then the AI button and the account avatar pinned to the bottom. This page lives under Projects.
 */
export function OrgRail({ current = 'Projects' }: { current?: string }) {
  return (
    <aside className="org-rail" aria-label="Organization">
      <div className="org-rail-top">
        <span className="org-monogram" aria-hidden="true">O</span>
      </div>
      <nav className="org-rail-nav" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const selected = item.label === current
          return (
            <button key={item.label} type="button" className="org-rail-item" aria-current={selected ? 'page' : undefined}>
              <span className="org-rail-icon">
                <img src={selected && item.selectedIcon ? item.selectedIcon : item.icon} width={24} height={24} alt="" />
              </span>
              <span className="org-rail-label">{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="org-rail-bottom">
        <button type="button" className="org-rail-ai" aria-label="Ask AI">
          <img src={sparkle} width={16} height={16} alt="" />
        </button>
        <div className="org-rail-account">
          <button type="button" className="org-rail-avatar" aria-label="Account">
            <img src={avatar} alt="" />
          </button>
        </div>
      </div>
    </aside>
  )
}
