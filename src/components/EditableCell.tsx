import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../hooks/useDismiss'
import { Checkbox } from './Checkbox'
import { anchorFor, useAnchoredPosition } from './FloatingMenu'
import { CELL_START, focusAfterEdit, type EditEnd } from './gridCells'
import { Icon } from './Icon'

/** Limits on a text cell's value (trimmed, as it is saved). */
export interface TextRule {
  /** Field name for the messages, e.g. "Email". */
  label: string
  max: number
  required?: boolean
  /** Format check on a non-empty value: the error message, or null when it's valid. */
  check?: (value: string) => string | null
}

/** The counter shows from this share of the limit on. */
const COUNTER_FROM = 0.8

/**
 * Over the limit shows while typing; an empty or badly formatted value only once saving was
 * tried, so the message doesn't appear before the user is done.
 */
function ruleError(rule: TextRule, value: string, tried: boolean) {
  if (value.length > rule.max) return `${rule.label} can't be longer than ${rule.max} characters.`
  if (!tried) return null
  if (!value) return rule.required ? `${rule.label} can't be empty.` : null
  return rule.check?.(value) ?? null
}

/**
 * Draft state for inline text editing. `start` swaps in the input, with the current value
 * selected or with `initial` (a typed key, or '' to clear) and the caret after it. Enter, Tab
 * or leaving the field saves, Escape cancels. `onEnd` runs after Enter, Tab or Escape, to move
 * focus. `inputProps` is null while not editing.
 *
 * With a `rule`, a changed value that breaks it isn't saved: Enter and Tab keep the edit open
 * with the error shown, so it can be fixed; Escape, or leaving the field (a click on another
 * cell, which gets selected), drops the change, like AG Grid's default "revert" mode. `hint`
 * (render it next to the input) shows the counter near the limit and the error, under the cell.
 */
export function useInlineEdit(
  value: string,
  onCommit: (next: string) => void,
  onEnd: (how: EditEnd) => void,
  rule?: TextRule,
) {
  const [draft, setDraft] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const editing = useRef(false)
  const selectAll = useRef(true)
  const focused = useRef(false)
  const id = useId()

  const start = (initial?: string) => {
    editing.current = true
    selectAll.current = initial === undefined
    focused.current = false
    setTried(false)
    setDraft(initial ?? value)
  }
  const next = (draft ?? '').trim()
  const changed = next !== value
  // A value that was already there (e.g. imported) isn't flagged until it's changed.
  const error = rule && changed ? ruleError(rule, next, tried) : null

  // Guarded by a ref: the input's blur can fire after Enter or Escape already finished.
  // `how` is missing when the field lost focus.
  const finish = (save: boolean, how?: EditEnd) => {
    if (!editing.current) return
    const invalid = save && !!rule && changed && !!ruleError(rule, next, true)
    if (invalid && how) {
      setTried(true)
      return
    }
    editing.current = false
    if (save && changed && !invalid) onCommit(next)
    setDraft(null)
    if (how) requestAnimationFrame(() => onEnd(how))
  }

  // As a layer, Escape cancels the edit without also closing a panel or drawer behind it.
  useDismiss(draft !== null, '.cell-input', (reason) => {
    if (reason === 'escape') finish(false, 'escape')
  })

  const showCount = rule && next.length >= rule.max * COUNTER_FROM
  const inputProps =
    draft === null
      ? null
      : {
          className: 'cell-input',
          value: draft,
          autoFocus: true,
          'data-menu-anchor': `edit:${id}`,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': rule ? `${id}-hint` : undefined,
          onFocus: (e: FocusEvent<HTMLInputElement>) => {
            // Coming back to a field that kept an error leaves the caret where the click put it.
            if (focused.current) return
            focused.current = true
            const input = e.currentTarget
            if (selectAll.current) return input.select()
            // Email fields don't support moving the caret
            try {
              input.setSelectionRange(input.value.length, input.value.length)
            } catch {}
          },
          onChange: (e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
          onBlur: () => {
            // Switching to another window keeps an invalid edit open instead of dropping it
            if (!document.hasFocus() && rule && changed && ruleError(rule, next, true)) return
            finish(true)
          },
          onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              finish(true, e.key === 'Enter' ? 'enter' : e.shiftKey ? 'shiftTab' : 'tab')
            }
          },
        }
  const hint =
    draft !== null && rule ? (
      <EditHint
        anchorKey={`edit:${id}`}
        id={`${id}-hint`}
        error={error}
        count={showCount ? `${next.length}/${rule.max}` : null}
        over={next.length > rule.max}
      />
    ) : null
  return { start, inputProps, hint }
}

/**
 * Under the field being edited: the error, and the character count near the limit. The error
 * sits in a live region that is there from the start, so screen readers announce it when it
 * appears; the count isn't announced on each key, but is read with the field.
 */
function EditHint({ anchorKey, id, error, count, over }: { anchorKey: string; id: string; error: string | null; count: string | null; over: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useAnchoredPosition(ref, anchorKey, 'start')
  return createPortal(
    <div ref={ref} id={id} className={['cell-hint', error && 'is-error', !error && !count && 'is-empty'].filter(Boolean).join(' ')}>
      <span className="cell-hint-msg" role="alert">
        {error && (
          <>
            <Icon name="warningCircleFill" small />
            {error}
          </>
        )}
      </span>
      {count && <span className={over ? 'cell-hint-count is-over' : 'cell-hint-count'}>{count}</span>}
    </div>,
    document.body,
  )
}

/** Calls `onStart` when the grid asks the cell to start editing (see onCellKeyDown). */
function useCellStart(ref: RefObject<HTMLElement | null>, onStart: (key: string) => void) {
  const callback = useRef(onStart)
  callback.current = onStart
  // No deps: the element mounts again each time an edit ends.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const listener = (e: Event) => callback.current((e as CustomEvent<string>).detail)
    el.addEventListener(CELL_START, listener)
    return () => el.removeEventListener(CELL_START, listener)
  })
}

const cellOf = (el: Element | null) => el?.closest<HTMLElement>('.td') ?? null

/**
 * Inline text editing, like the MUI X Data Grid: a click selects the cell; a double-click, Enter,
 * F2 or the pencil starts editing with the value selected, a printable key replaces the value,
 * and Backspace or Delete clear it. Enter saves and moves down, Tab saves and moves sideways,
 * leaving the field saves, Escape cancels.
 */
export function EditableText({
  label,
  value,
  type = 'text',
  rule,
  onCommit,
  children,
}: {
  /** Accessible name, e.g. "Email for Ana Costa". */
  label: string
  /** Raw value ('' when empty), not the "—" placeholder shown in the cell. */
  value: string
  type?: 'text' | 'email' | 'tel'
  rule?: TextRule
  onCommit: (next: string) => void
  children: ReactNode
}) {
  const display = useRef<HTMLDivElement>(null)
  const cell = useRef<HTMLElement | null>(null)
  const { start, inputProps, hint } = useInlineEdit(value, onCommit, (how) => focusAfterEdit(cell.current, how), rule)
  const begin = (key: string) => {
    cell.current = cellOf(display.current)
    start(key === 'Backspace' || key === 'Delete' ? '' : key.length === 1 ? key : undefined)
  }
  useCellStart(display, begin)

  if (inputProps)
    return (
      <>
        <input {...inputProps} type={type} aria-label={label} />
        {hint}
      </>
    )

  return (
    <div ref={display} className="cell-edit" onDoubleClick={() => begin('click')}>
      {children}
      <span className="cell-edit-trail" onClick={() => begin('click')}><Icon name="pencil" /></span>
    </div>
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

/** How the menu opened: a typed key starts the search; Backspace or Delete focus the clearing option. */
interface MenuStart {
  query: string
  toClear: boolean
}

/**
 * Inline choice editing: the cell opens a menu of options under it, like the MUI X Data Grid's
 * select cells: a click selects the cell; a double-click, Enter, F2, Alt+↓, a printable key or the
 * caret opens the menu. One choice closes the menu on pick; with `multi`, options are checkboxes
 * and each toggle saves.
 */
export function EditableOptions({ children, ...props }: OptionsProps & { children: ReactNode }) {
  const { anchorKey } = props
  const display = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<MenuStart | null>(null)
  const begin = (key: string) =>
    setOpen({ query: props.search && key.length === 1 ? key : '', toClear: key === 'Backspace' || key === 'Delete' })
  useCellStart(display, begin)

  return (
    <>
      <div
        ref={display}
        className="cell-edit has-menu"
        data-menu-anchor={anchorKey}
        data-open={open ? 'true' : undefined}
        onDoubleClick={() => begin('click')}
      >
        {children}
        <span className="cell-edit-trail" onClick={() => (open ? setOpen(null) : begin('click'))}>
          <Icon name="caretDown" />
        </span>
      </div>
      {open &&
        createPortal(
          <OptionsMenu
            {...props}
            start={open}
            onClose={(restoreFocus) => {
              setOpen(null)
              if (restoreFocus) cellOf(anchorFor(anchorKey))?.focus()
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
  start,
  onClose,
}: OptionsProps & { start: MenuStart; onClose: (restoreFocus: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(start.query)
  const focusables = () =>
    Array.from(ref.current!.querySelectorAll<HTMLElement>('.cell-menu-search input, button.menu-item, .menu-item input'))
  const [options] = useState(() => (typeof optionsProp === 'function' ? optionsProp() : optionsProp))

  // The caret toggles the menu itself, so a press on it isn't an outside press.
  useDismiss(true, `.cell-menu, [data-menu-anchor="${anchorKey}"] .cell-edit-trail`, (reason) => onClose(reason === 'escape'))
  useAnchoredPosition(ref, anchorKey, 'start', true)
  useLayoutEffect(() => {
    const clear = start.toClear && ref.current!.querySelector<HTMLElement>('[data-clear]')
    if (clear) {
      clear.focus({ preventScroll: true })
      return
    }
    if (search) {
      // Focus stays in the search field; the current choice is scrolled to the middle of the list.
      input.current!.focus({ preventScroll: true })
      const current = !start.query && list.current!.querySelector<HTMLElement>('[aria-checked="true"]')
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
      data-clear={key === '' || undefined}
      onClick={() => pick(next, checked)}
    >
      {desc ? (
        <span className="menu-item-text">
          {text}
          <span className="menu-item-desc">{desc}</span>
        </span>
      ) : (
        text
      )}
      <span className="menu-check">{checked && <Icon name="check" />}</span>
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
