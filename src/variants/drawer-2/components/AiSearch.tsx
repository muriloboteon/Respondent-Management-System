import { useId, useRef, useState } from 'react'
import { AI_EXAMPLES } from '../filters/aiFilters'
import { Icon } from './Icon'

interface Props {
  query: string
  onQueryChange: (query: string) => void
  /** Turns the text into filters (simulated: takes a moment, see App). */
  onAsk: (prompt: string) => void
  /** The AI is reading the text. */
  busy: boolean
}

/**
 * The search field, which also takes a description. Typing searches names, emails and IDs as
 * before; Enter, or the "Filter with AI" button inside the field, turns the text into filters
 * instead. Nothing opens over the table while there's text, so the search results stay in view;
 * only the empty field, focused, offers a few example descriptions under it.
 */
export function AiSearch({ query, onQueryChange, onAsk, busy }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  /** After a run the field is empty and still focused: the examples stay closed so the new results show. */
  const [asked, setAsked] = useState(false)
  const text = query.trim()
  const showExamples = focused && !text && !busy && !asked

  const ask = (prompt: string) => {
    if (busy || !prompt.trim()) return
    if (prompt !== query) onQueryChange(prompt)
    setActive(-1)
    setAsked(true)
    onAsk(prompt.trim())
  }

  return (
    <div
      className={busy ? 'search search-ai is-busy' : 'search search-ai'}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setFocused(false)
        setAsked(false)
      }}
    >
      <label className="field field-sm">
        <Icon name="search" />
        <span className="sr-only">Search respondents, or describe who you’re looking for and press Enter to filter with AI</span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showExamples}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showExamples && active >= 0 ? `${listId}-${active}` : undefined}
          aria-busy={busy || undefined}
          placeholder="Search or describe with AI"
          title="Search by name, email or ID, or describe who you’re looking for and press Enter."
          value={query}
          readOnly={busy}
          onChange={(e) => {
            onQueryChange(e.target.value)
            setActive(-1)
            setAsked(false)
          }}
          onKeyDown={(e) => {
            if (showExamples && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              // Moves through the examples and back to the field (-1).
              const step = e.key === 'ArrowDown' ? 1 : -1
              setActive((i) => (i + step >= AI_EXAMPLES.length ? -1 : i + step < -1 ? AI_EXAMPLES.length - 1 : i + step))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              ask(showExamples && active >= 0 ? AI_EXAMPLES[active] : query)
            } else if (e.key === 'Escape' && showExamples) {
              // Closes the examples only, not the drawer or panel behind them.
              e.preventDefault()
              e.stopPropagation()
              setFocused(false)
            }
          }}
        />
        {/* Our own clear button: not every browser shows one in a search field */}
        {query && !busy && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              onQueryChange('')
              input.current?.focus()
            }}
          >
            <Icon name="x" small />
          </button>
        )}
        {(text || busy) && (
          <button
            type="button"
            className="ai-inline-btn"
            title="Turn this description into filters (Enter)"
            disabled={busy}
            // Keep focus in the field.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => ask(query)}
          >
            <span className={busy ? 'ai-busy-icon' : undefined}>
              <Icon name="sparkle" small />
            </span>
            {busy ? 'Filtering…' : 'Filter with AI'}
            {!busy && <kbd className="ai-kbd" aria-hidden="true">↵</kbd>}
          </button>
        )}
      </label>

      {showExamples && (
        <div className="ai-suggest" id={listId} role="listbox" aria-label="Example descriptions to filter with AI">
          <div className="ai-suggest-head" aria-hidden="true">
            <Icon name="sparkle" small />
            Describe who you’re looking for, for example
          </div>
          {AI_EXAMPLES.map((prompt, i) => (
            <div
              key={prompt}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              className="menu-item ai-option ai-example"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => ask(prompt)}
            >
              <span className="ai-example-text">{prompt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
