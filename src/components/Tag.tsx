import type { ReactNode } from 'react'
import { tone } from '../data/respondents'

type Variant = 'default' | 'outline' | 'feature' | 'warn' | 'more'

/** Discuss DS tag (soft pattern). */
export function Tag({ variant = 'default', large = false, title, children }: { variant?: Variant; large?: boolean; title?: string; children: ReactNode }) {
  const cls = ['tag', variant !== 'default' && `tag-${variant}`, large && 'tag-lg'].filter(Boolean).join(' ')
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  )
}

/** Status tag whose colour comes from the status label (done / in flight / needs attention / not applicable). */
export function StatusTag({ status, prefix = '' }: { status: string; prefix?: string }) {
  return (
    <span className={`tag tag-${tone(status)}`}>
      <span className="dot" aria-hidden="true" />
      {prefix}
      {status}
    </span>
  )
}
