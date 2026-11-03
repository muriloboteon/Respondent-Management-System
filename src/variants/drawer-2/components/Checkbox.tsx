import { useEffect, useRef, type InputHTMLAttributes } from 'react'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Partly selected (e.g. "select all" with only some rows picked). Shown only while unchecked. */
  indeterminate?: boolean
}

/**
 * Discuss DS checkbox (24px frame: empty, mixed, selected). The mixed and selected
 * icons come from the DS and are painted in the primary color (see .checkbox-icon).
 * A transparent native input sits on top, so keyboard, labels and screen readers work as usual.
 */
export function Checkbox({ indeterminate = false, className, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  const mixed = indeterminate && !props.checked
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed
  }, [mixed])

  return (
    <span className={['checkbox', className].filter(Boolean).join(' ')}>
      <input ref={ref} type="checkbox" {...props} />
      <span className="checkbox-box" aria-hidden="true">
        {props.checked ? (
          <span className="checkbox-icon is-checked" />
        ) : mixed ? (
          <span className="checkbox-icon is-mixed" />
        ) : (
          <span className="checkbox-empty" />
        )}
      </span>
    </span>
  )
}
