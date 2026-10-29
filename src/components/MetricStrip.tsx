import type { Respondent } from '../data/respondents'
import { METRICS, matchesTree, type MetricId } from '../filters/filters'
import { TruncatedText } from './Tooltip'

type Props = {
  /** The respondents loaded in the prototype (a sample of the project). */
  data: Respondent[]
  /** Respondents in the whole project. */
  total: number
  active: MetricId | null
  onSelect: (id: MetricId) => void
}

const fmt = (n: number) => n.toLocaleString('en-US')

/**
 * Big numbers above the table. Each one filters the list (Stripe-style status tabs with counts).
 * Counts are scaled from the loaded sample to the project total, like the title's count.
 * The strip condenses to one line while the table is scrolled (see .metrics-condensed).
 */
export function MetricStrip({ data, total, active, onSelect }: Props) {
  return (
    <div className="metrics" role="group" aria-label="Respondent metrics. Each one filters the list.">
      {METRICS.map((m) => {
        const share = data.length ? data.filter((r) => matchesTree(r, m.tree)).length / data.length : 0
        const count = m.id === 'all' ? total : Math.round(share * total)
        return (
          <button
            key={m.id}
            type="button"
            className={m.attention && count > 0 ? 'metric is-attention' : 'metric'}
            aria-pressed={active === m.id}
            onClick={() => onSelect(m.id)}
          >
            <TruncatedText className="metric-label">{m.label}</TruncatedText>
            <span className="metric-value">{fmt(count)}</span>
            <TruncatedText className="metric-hint">{m.id === 'all' ? 'in this project' : `${Math.round(share * 100)}% of respondents`}</TruncatedText>
          </button>
        )
      })}
    </div>
  )
}
