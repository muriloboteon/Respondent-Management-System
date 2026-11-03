import { VARIANTS, variantHref } from './variants'
import './variantBar.css'

/**
 * Prototype chrome, not product UI: a thin dark bar above the page with one tab per variant.
 * Each tab is a link to that variant's page, so switching reloads into a fully separate app.
 */
export function VariantBar({ current }: { current: string }) {
  return (
    <nav className="proto-bar" aria-label="Prototype variants">
      <span className="proto-bar-label">Prototype</span>
      <span className="proto-bar-tabs">
        {VARIANTS.map((v) => (
          <a
            key={v.id}
            className="proto-bar-tab"
            href={variantHref(v.id)}
            title={v.description}
            aria-current={v.id === current ? 'page' : undefined}
          >
            {v.label}
          </a>
        ))}
      </span>
    </nav>
  )
}
