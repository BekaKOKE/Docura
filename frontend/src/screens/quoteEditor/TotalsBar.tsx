import { ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatMoney } from '../../domain'
import { t, tCount } from '../../i18n/t'
import { Money } from '../clients/parts'
import { VAT_RATE_BP, type DraftTotals } from './draft'

const LIVE_DELAY_MS = 1000
const DETAIL_ID = 'qe-totals-detail'

/** "323 930": an amount for a screen reader, which hears "тенге" instead of the sign. */
export const plainAmount = (tiyn: number): string => formatMoney(tiyn).replace(/\s*₸$/, '')

/** The value after it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export interface TotalsBarProps {
  totals: DraftTotals
  vatEnabled: boolean
  lineCount: number
  expanded: boolean
  onToggle: () => void
}

// components.md "TotalsBar": ink, sticky. One line "Итого 323 930 ₸ · 2 строки"; a tap opens Без НДС / НДС 16 % / Итого.
// The sum is announced politely, one second after the last change (components.md S07, Accessibility).
export function TotalsBar({ totals, vatEnabled, lineCount, expanded, onToggle }: TotalsBarProps) {
  const settled = useDebounced(totals.grossTiyn, LIVE_DELAY_MS)
  const rate = String(VAT_RATE_BP / 100)

  const summary = (
    <>
      <span className="qe-totals-label">{t('qe.totals.label')}</span>
      <span className="qe-totals-sum">{totals.tooLarge ? t('qe.totals.tooLarge') : <Money tiyn={totals.grossTiyn} />}</span>
      <span className="qe-totals-count">{tCount('count.line', lineCount)}</span>
    </>
  )

  return (
    <section className="qe-totals" aria-label={t('qe.totals.label')}>
      {expanded && !totals.tooLarge && (
        <dl id={DETAIL_ID} className="qe-totals-detail">
          <div>
            <dt>{t('qe.totals.net')}</dt>
            <dd>
              <Money tiyn={totals.netTiyn} />
            </dd>
          </div>
          {vatEnabled && (
            <div>
              <dt>{t('qe.totals.vat', { rate })}</dt>
              <dd>
                <Money tiyn={totals.vatTiyn} />
              </dd>
            </div>
          )}
          <div>
            <dt>{t('qe.totals.label')}</dt>
            <dd>
              <Money tiyn={totals.grossTiyn} />
            </dd>
          </div>
        </dl>
      )}
      {totals.tooLarge ? (
        <div className="qe-totals-main">{summary}</div>
      ) : (
        <button
          type="button"
          className="qe-totals-main"
          aria-expanded={expanded}
          aria-controls={expanded ? DETAIL_ID : undefined}
          aria-label={expanded ? t('qe.totals.hide') : t('qe.totals.show')}
          onClick={onToggle}
        >
          {summary}
          <ChevronUp aria-hidden="true" className="qe-totals-chevron" data-open={expanded || undefined} />
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {totals.tooLarge ? '' : t('qe.totals.live', { amount: plainAmount(settled) })}
      </p>
    </section>
  )
}
