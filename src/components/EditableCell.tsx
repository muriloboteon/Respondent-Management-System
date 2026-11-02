import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../hooks/useDismiss'
import { Checkbox } from './Checkbox'
import { anchorFor, useAnchoredPosition } from './FloatingMenu'
import { Icon } from './Icon'

/**
 * Inline text editing: the cell's usual content is a button that fills the cell.
 * Clicking it swaps in an input. Enter or leaving the field saves, Escape cancels.
 */
export function EditableText({
  label,
  value,
  type = 'text',
  onCommit,
  children,
}: {
  /** Accessible name, e.g. "Email for Ana Costa". */
  label: string
  /** Raw value ('' when empty), not the "—" placeholder shown in the cell. */
  value: string
  type?: 'text' | 'email' | 'tel'
  onCommit: (next: string) => void
  children: ReactNode
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const editing = useRef(false)
  const button = useRef<HTMLButtonElement>(null)

  const start = () => {
    editing.current = true
    setDraft(value)
  }
  // Guarded by a ref: the input's blur can fire after Enter or Escape already finished.
  const finish = (save: boolean, refocus: boolean) => {
    if (!editing.current) return
    editing.current = false
    const next = (draft ?? '').trim()
    if (save && next !== value) onCommit(next)
    setDraft(null)
    if (refocus) requestAnimationFrame(() => button.current?.focus())
  }

  // As a layer, Escape cancels the edit without also closing a panel or drawer behind it.
  useDismiss(draft !== null, '.cell-input', (reason) => {
    if (reason === 'escape') finish(false, true)
  })

  if (draft !== null) {
    return (
      <input
        className="cell-input"
        type={type}
        aria-label={label}
        value={draft}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(true, true)
          }
        }}
      />
    )
  }

  return (
    <button ref={button} type="button" className="cell-edit" aria-label={`Edit ${label}: ${value || 'empty'}`} onClick={start}>
      {children}
      <span className="cell-edit-trail"><Icon name="pencil" small /></span>
    </button>
  )
}

/** One choice only: a search field above the options, for long lists. */
export interface OptionSearch {
  /** Placeholder and accessible name, e.g. "Search timezones". */
  label: string
  /** Text an option matches on; defaults to the option itself. */
  text?: (option: string) => string
}

interface OptionsProps {
  label: string
  /** Unique per cell, e.g. "cell:r4:segAge". */
  anchorKey: string
  value: readonly string[]
  /** A function runs only when the menu opens, for long lists that are costly to build. */
  options: readonly string[] | (() => readonly string[])
  multi?: boolean
  /** One choice only: adds an option that clears the value. */
  emptyLabel?: string
  /** One choice only: a second line under an option, e.g. a session's date. */
  describe?: (option: string) => string
  search?: OptionSearch
  onCommit: (next: string[]) => void
}

/**
 * Inline choice editing: the cell opens a menu of options under it.
 * One choice closes the menu on pick; with `multi`, options are checkboxes and each toggle saves.
 */
export function EditableOptions({ children, ...props }: OptionsProps & { children: ReactNode }) {
  const { label, anchorKey, value, multi = false } = props
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="cell-edit has-menu"
        data-menu-anchor={anchorKey}
        aria-haspopup={multi ? 'dialog' : 'menu'}
        aria-expanded={open}
        aria-label={`Edit ${label}: ${value.join(', ') || 'empty'}`}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
        <span className="cell-edit-trail"><Icon name="caretDown" small /></span>
      </button>
      {open &&
        createPortal(
          <OptionsMenu
            {...props}
            onClose={(restoreFocus) => {
              setOpen(false)
              if (restoreFocus) anchorFor(anchorKey)?.focus()
            }}
          />,
          document.body,
        )}
    </>
  )
}

function OptionsMenu({
  label,
  anchorKey,
  value,
  options: optionsProp,
  multi = false,
  emptyLabel,
  describe,
  search,
  onCommit,
  onClose,
}: OptionsProps & { onClose: (restoreFocus: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const focusables = () =>
    Array.from(ref.current!.querySelectorAll<HTMLElement>('.cell-menu-search input, button.menu-item, .menu-item input'))
  const [options] = useState(() => (typeof optionsProp === 'function' ? optionsProp() : optionsProp))

  useDismiss(true, `.cell-menu, [data-menu-anchor="${anchorKey}"]`, (reason) => onClose(reason === 'escape'))
  useAnchoredPosition(ref, anchorKey, 'start')
  useLayoutEffect(() => {
    if (search) {
      // Focus stays in the search field; the current choice is scrolled to the middle of the list.
      input.current!.focus({ preventScroll: true })
      const current = list.current!.querySelector<HTMLElement>('[aria-checked="true"]')
      if (current) list.current!.scrollTop = current.offsetTop - (list.current!.clientHeight - current.offsetHeight) / 2
      return
    }
    const items = focusables()
    const current = ref.current!.querySelector<HTMLElement>('[aria-checked="true"], input:checked')
    ;(current ?? items[0])?.focus({ preventScroll: true })
  }, [])

  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => (search?.text?.(o) ?? o).toLowerCase().includes(q)) : options

  const pick = (next: string[], checked: boolean) => {
    if (!checked) onCommit(next)
    onClose(true)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const inSearch = e.target === input.current
    // Typing on an option goes to the search field.
    if (search && !inSearch && e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      input.current!.focus()
      return
    }
    if (inSearch && e.key === 'Enter') {
      e.preventDefault()
      const first = shown[0]
      if (first) pick([first], value[0] === first)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = focusables()
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  if (multi) {
    const toggle = (opt: string) =>
      onCommit(value.includes(opt) ? value.filter((v) => v !== opt) : options.filter((o) => o === opt || value.includes(o)))
    return (
      <div ref={ref} className="menu cell-menu" role="dialog" aria-label={label} onKeyDown={onKeyDown}>
        {options.map((opt) => (
          <label key={opt} className="menu-item">
            <Checkbox checked={value.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    )
  }

  const choice = (key: string, text: string, next: string[], checked: boolean, desc?: string) => (
    <button
      key={key}
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      className={desc ? 'menu-item has-desc' : 'menu-item'}
      onClick={() => pick(next, checked)}
    >
      <span className="menu-check">{checked && <Icon name="check" small />}</span>
      {desc ? (
        <span className="menu-item-text">
          {text}
          <span className="menu-item-desc">{desc}</span>
        </span>
      ) : (
        text
      )}
    </button>
  )

  const optionList = shown.map((opt) => choice(opt, opt, [opt], value[0] === opt, describe?.(opt)))
  const clear = emptyLabel && (
    <>
      <div className="menu-sep" role="separator" />
      {choice('', emptyLabel, [], value.length === 0)}
    </>
  )

  if (search) {
    // The list scrolls between the search field and the clearing option, so both stay in reach.
    return (
      <div ref={ref} className="menu cell-menu cell-menu-search" role="dialog" aria-label={label} onKeyDown={onKeyDown}>
        <label className="field field-sm">
          <Icon name="search" />
          <span className="sr-only">{search.label}</span>
          <input ref={input} type="search" placeholder={search.label} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div ref={list} className="cell-menu-list" role="menu" aria-label={label}>
          {optionList.length ? optionList : <p className="menu-empty">No matches for “{query.trim()}”</p>}
        </div>
        {clear}
      </div>
    )
  }

  return (
    <div ref={ref} className="menu cell-menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {optionList}
      {clear}
    </div>
  )
}
