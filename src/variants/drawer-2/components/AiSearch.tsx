import { useId, useRef, useState } from 'react'
import { AI_EXAMPLES } from '../filters/aiFilters'
import { Icon, type IconName } from './Icon'

/** A description the AI couldn't turn into any filter. */
export interface AiFailure {
  prompt: string
  /** Words that fit more than one property ("completed": self captures or tech check?). */
  ambiguous: string[]
}

interface Props {
  query: string
  onQueryChange: (query: string) => void
  /** Turns the text into filters (simulated: takes a moment, see App). */
  onAsk: (prompt: string) => void
  /** The AI is reading the text. */
  busy: boolean
  /** The last description gave no filters: explained right under the field until dismissed. */
  failure: AiFailure | null
  onDismissFailure: () => void
  onOpenFilters: () => void
}

interface Option {
  key: string
  label: string
  icon?: IconName
  run: () => void
}

/**
 * The search field, which also takes a description. Typing searches names, emails and IDs as
 * before; Enter, or the "Filter with AI" button inside the field, turns the text into filters
 * instead. Nothing opens over the table while there's text, so the search results stay in view;
 * only the empty field, focused, offers a few example descriptions under it. When a description
 * gives no filters, the same spot says so (with examples and a way to the filters drawer) until
 * the text changes or focus leaves; the text stays in the field to edit.
 */
export function AiSearch({ query, onQueryChange, onAsk, busy, failure, onDismissFailure, onOpenFilters }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  /** After a run the field is empty and still focused: the examples stay closed so the new results show. */
  const [asked, setAsked] = useState(false)
  const text = query.trim()
  const failed = failure !== null && !busy
  const showExamples = focused && !text && !busy && !asked

  const ask = (prompt: string) => {
    if (busy || !prompt.trim()) return
    if (prompt !== query) onQueryChange(prompt)
    if (failure) onDismissFailure()
    setActive(-1)
    setAsked(true)
    onAsk(prompt.trim())
  }

  const examples: Option[] = AI_EXAMPLES.map((prompt) => ({ key: prompt, label: prompt, run: () => ask(prompt) }))
  const options: Option[] = failed
    ? [
        // An unclear word needs the user's words, not an example.
        ...(failure.ambiguous.length ? [] : examples),
        {
          key: 'open-filters',
          label: 'Open filters',
          icon: 'funnel',
          run: () => {
            onDismissFailure()
            onOpenFilters()
          },
        },
      ]
    : showExamples
      ? examples
      : []
  const listOpen = failed || showExamples

  const option = (o: Option, i: number) => (
    <div
      key={o.key}
      id={`${listId}-${i}`}
      role="option"
      aria-selected={active === i}
      // Actions (Open filters) follow the examples under a divider.
      className={o.icon ? 'menu-item ai-option ai-action' : 'menu-item ai-option ai-example'}
      // Keep focus in the field.
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(i)}
      onClick={o.run}
    >
      {o.icon && <Icon name={o.icon} />}
      <span className="ai-example-text">{o.label}</span>
    </div>
  )

  return (
    <div
      className={busy ? 'search search-ai is-busy' : 'search search-ai'}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setFocused(false)
        setAsked(false)
        setActive(-1)
        if (failure) onDismissFailure()
      }}
    >
      <label className="field field-sm">
        <Icon name="search" />
        <span className="sr-only">Search respondents, or describe who you’re looking for and press Enter to filter with AI</span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listOpen && active >= 0 ? `${listId}-${active}` : undefined}
          aria-busy={busy || undefined}
          placeholder="Search or describe with AI"
          title="Search by name, email or ID, or describe who you’re looking for and press Enter."
          value={query}
          readOnly={busy}
          onChange={(e) => {
            onQueryChange(e.target.value)
            setActive(-1)
            setAsked(false)
            if (failure) onDismissFailure()
          }}
          onKeyDown={(e) => {
            if (listOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              // Moves through the options and back to the field (-1).
              const step = e.key === 'ArrowDown' ? 1 : -1
              setActive((i) => (i + step >= options.length ? -1 : i + step < -1 ? options.length - 1 : i + step))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (listOpen && active >= 0) options[active]?.run()
              else ask(query)
            } else if (e.key === 'Escape' && listOpen) {
              // Closes the list only, not the drawer or panel behind it.
              e.preventDefault()
              e.stopPropagation()
              setActive(-1)
              if (failure) onDismissFailure()
              else setFocused(false)
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
              if (failure) onDismissFailure()
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

      {listOpen && (
        <div className="ai-suggest">
          {failed ? (
            <div className="ai-fail" role="status">
              <span className="ai-fail-icon">
                <Icon name="sparkle" small />
              </span>
              <span className="ai-fail-text">
                {failure.ambiguous.length ? (
                  <>
                    <strong>“{failure.ambiguous.join('”, “')}” could mean self captures or tech check</strong>
                    <span>Say which one, for example “self captures {failure.ambiguous[0]}”.</span>
                  </>
                ) : (
                  <>
                    <strong>
                      No filters found for <q>{failure.prompt}</q>
                    </strong>
                    <span>Try describing a value, for example:</span>
                  </>
                )}
              </span>
            </div>
          ) : (
            <div className="ai-suggest-head" aria-hidden="true">
              <Icon name="sparkle" small />
              Describe who you’re looking for, for example
            </div>
          )}
          <div id={listId} role="listbox" aria-label={failed ? 'What to try next' : 'Example descriptions to filter with AI'} className="ai-options">
            {options.map(option)}
          </div>
        </div>
      )}
    </div>
  )
}
