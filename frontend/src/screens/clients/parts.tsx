import { CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import './clients.css'

interface BannerProps {
  tone: 'danger' | 'success'
  title?: string
  children?: ReactNode
  /** A button at the end of the banner ("Повторить"). */
  action?: ReactNode
}

// components.md "Banner (inline)": a tint, an icon and words. Errors are announced at once (role=alert).
export function Banner({ tone, title, children, action }: BannerProps) {
  const Icon: LucideIcon = tone === 'danger' ? CircleAlert : CircleCheck
  return (
    <div className="cl-banner" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div className="cl-banner-text">
        {title && <strong>{title}</strong>}
        {children && <span>{children}</span>}
      </div>
      {action}
    </div>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  text: string
  action?: ReactNode
}

// components.md "EmptyState": an icon, a title, one sentence, at most one action.
export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <section className="cl-empty" aria-label={title}>
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  )
}

/** Sunken blocks shaped like list rows, with a spoken "loading" for screen readers. */
export function ListSkeleton({ rows, label }: { rows: number; label: string }) {
  return (
    <div className="cl-skeleton" role="status" aria-busy="true">
      <span className="cl-sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="cl-skeleton-row" aria-hidden="true">
          <span className="cl-skeleton-line" />
          <span className="cl-skeleton-line cl-skeleton-short" />
        </div>
      ))}
    </div>
  )
}

// components.md "Money (display)": the amount never wraps; the tenge sign is decoration, "тенге" is read out.
export function Money({ tiyn }: { tiyn: number }) {
  const text = formatMoney(tiyn)
  const digits = text.replace(/[\s ]*₸$/, '')
  return (
    <span className="dc-money">
      {digits}
      <span aria-hidden="true">&nbsp;₸</span>
      <span className="cl-sr-only"> {t('money.tengeWord')}</span>
    </span>
  )
}
