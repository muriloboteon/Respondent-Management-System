import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import type { Respondent } from '../data/respondents'
import {
  IMPORT_FIELDS,
  checkRows,
  createRespondents,
  guessMapping,
  mappingProblems,
  readPaste,
  type ImportField,
  type Mapping,
} from '../import/spreadsheetPaste'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { Tag } from './Tag'

const PREVIEW_LIMIT = 300
export const PASTE_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘V' : 'Ctrl+V'

type GridRow = { id: number; cells: string[] }

function columnLetter(i: number): string {
  return (i >= 26 ? columnLetter(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26))
}

interface Props {
  /** Clipboard text from a paste on the page; empty when opened from the button. */
  initialText: string
  existing: readonly Respondent[]
  onClose: () => void
  onAdd: (added: Respondent[]) => void
}

export function PasteImportDialog({ initialText, existing, onClose, onAdd }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [grid, setGrid] = useState<GridRow[] | null>(null)
  const [hasHeader, setHasHeader] = useState(false)
  const [mapping, setMapping] = useState<Mapping>([])
  const [pasteError, setPasteError] = useState('')
  const [problemsOnly, setProblemsOnly] = useState(false)

  const load = (text: string) => {
    const result = readPaste(text)
    if ('error' in result) {
      setPasteError(result.error)
      setGrid(null)
      return
    }
    setPasteError('')
    setGrid(result.rows.map((cells, id) => ({ id, cells })))
    setHasHeader(result.hasHeader)
    setMapping(result.mapping)
    setProblemsOnly(false)
  }

  useEffect(() => {
    const dialog = dialogRef.current!
    dialog.showModal()
    if (initialText) load(initialText)
    // showModal() focuses the first control (Close); start in the paste area instead.
    else dialog.querySelector<HTMLTextAreaElement>('.paste-target')?.focus()
    return () => dialog.close()
    // Runs once on open: the initial paste is loaded a single time.
  }, [])

  const headerRow = grid && hasHeader ? grid[0] : null
  const dataRows = useMemo(() => (grid ? (hasHeader ? grid.slice(1) : grid) : []), [grid, hasHeader])
  const checked = useMemo(() => checkRows(dataRows.map((r) => r.cells), mapping, existing), [dataRows, mapping, existing])
  const problems = mappingProblems(mapping)
  const readyCount = problems.length ? 0 : checked.filter((c) => c.draft).length
  const problemCount = checked.filter((c) => c.errors.length).length
  const visible = dataRows
    .map((row, i) => ({ row, check: checked[i] }))
    .filter(({ check }) => !problemsOnly || check.errors.length)
  const width = grid?.[0]?.cells.length ?? 0

  const onPasteZone = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    load(e.clipboardData.getData('text/plain'))
  }
  const setColumnField = (col: number, field: ImportField | null) =>
    setMapping((m) => m.map((f, i) => (i === col ? field : f)))
  const editCell = (id: number, col: number, value: string) =>
    setGrid((g) => g!.map((r) => (r.id === id ? { ...r, cells: r.cells.map((c, i) => (i === col ? value : c)) } : r)))
  const removeRow = (id: number) => setGrid((g) => g!.filter((r) => r.id !== id))
  const toggleHeader = (value: boolean) => {
    setHasHeader(value)
    setMapping(guessMapping(grid!.map((r) => r.cells), value))
  }
  const add = () => {
    const drafts = checked.flatMap((c) => (c.draft ? [c.draft] : []))
    onAdd(createRespondents(drafts, existing))
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal paste-modal"
      aria-labelledby="paste-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id="paste-title">Add respondents from a spreadsheet</h2>
          <p className="modal-sub">
            {grid ? 'Check how each column maps, fix any rows with problems, then add them.' : 'Copy rows in Excel or Google Sheets and paste them here.'}
          </p>
        </div>
        <button type="button" className="icon-btn bordered" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>

      {!grid ? (
        <div className="modal-body">
          <label className="paste-zone">
            <Icon name="clipboard" />
            <span className="paste-zone-title">Press {PASTE_SHORTCUT} to paste your rows</span>
            <span className="paste-zone-hint">Include the header row if you have one: we use it to match columns.</span>
            <textarea
              className="paste-target"
              aria-label={`Paste spreadsheet rows here with ${PASTE_SHORTCUT}`}
              value=""
              onChange={() => {}}
              onPaste={onPasteZone}
            />
          </label>
          {pasteError && <p className="form-error" role="alert">{pasteError}</p>}
          <div className="paste-fields">
            <span className="overline">Columns you can paste</span>
            <span className="chip-list">
              {IMPORT_FIELDS.map((f) => <Tag key={f.key}>{f.label}</Tag>)}
            </span>
            <span className="paste-zone-hint">
              Name and Market are required. Session, tech check and consent statuses are filled in by the product as respondents take part.
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="modal-toolbar">
            <label className="check-inline">
              <Checkbox checked={hasHeader} onChange={(e) => toggleHeader(e.target.checked)} />
              First row is a header
            </label>
            <label className="check-inline">
              <Checkbox checked={problemsOnly} disabled={!problemCount} onChange={(e) => setProblemsOnly(e.target.checked)} />
              Show only rows with problems
            </label>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setGrid(null)
                requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLTextAreaElement>('.paste-target')?.focus())
              }}
            >
              Paste different rows
            </button>
          </div>

          {problems.length > 0 && (
            <div className="alert alert-error" role="alert">
              {problems.map((p) => <span key={p}>{p}</span>)}
            </div>
          )}

          <div className="modal-body import-scroll">
            <table className="import-table">
              <thead>
                <tr>
                  <th scope="col" className="col-num">Row</th>
                  <th scope="col" className="col-status">Status</th>
                  {Array.from({ length: width }, (_, col) => (
                    <th key={col} scope="col">
                      <span className="src-header" title={headerRow?.cells[col]}>
                        {columnLetter(col)}
                        {headerRow?.cells[col] ? ` · ${headerRow.cells[col]}` : ''}
                      </span>
                      <select
                        className="select select-sm"
                        aria-label={`Field for column ${columnLetter(col)}`}
                        value={mapping[col] ?? ''}
                        onChange={(e) => setColumnField(col, (e.target.value || null) as ImportField | null)}
                      >
                        <option value="">Don’t add</option>
                        {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </th>
                  ))}
                  <th scope="col" className="col-remove"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, PREVIEW_LIMIT).map(({ row, check }) => (
                  <tr key={row.id} className={check.errors.length ? 'has-error' : undefined}>
                    <td className="col-num">{row.id + 1}</td>
                    <td className="col-status">
                      {check.errors.length ? (
                        <ul className="row-errors">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                      ) : (
                        <span className="tag tag-ok"><span className="dot" aria-hidden="true" />Ready</span>
                      )}
                    </td>
                    {row.cells.map((value, col) => (
                      <td key={col} className={mapping[col] ? undefined : 'unmapped'}>
                        <input
                          className="cell-input"
                          value={value}
                          aria-label={`Row ${row.id + 1}, column ${columnLetter(col)}`}
                          onChange={(e) => editCell(row.id, col, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="col-remove">
                      <button type="button" className="icon-btn" aria-label={`Remove row ${row.id + 1}`} onClick={() => removeRow(row.id)}>
                        <Icon name="x" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > PREVIEW_LIMIT && (
              <p className="paste-zone-hint">
                Showing the first {PREVIEW_LIMIT} of {visible.length} rows. All rows are checked{problemCount ? '; turn on “Show only rows with problems” to fix the rest' : ''}.
              </p>
            )}
            {!dataRows.length && <p className="empty">No rows left. Paste different rows to start again.</p>}
          </div>
        </>
      )}

      <div className="modal-foot">
        <span className="modal-summary" aria-live="polite">
          {grid && (
            <>
              <strong>{readyCount} ready to add</strong>
              {problemCount > 0 && ` · ${problemCount} with problems won’t be added`}
            </>
          )}
        </span>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!readyCount} onClick={add}>
            {readyCount ? `Add ${readyCount} respondent${readyCount === 1 ? '' : 's'}` : 'Add respondents'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
