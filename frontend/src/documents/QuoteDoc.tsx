// The коммерческое предложение on an A4 sheet. One renderer for the preview, the public page and print.

import { t } from '../i18n/t'
import { DEFAULT_TIME_ZONE } from './format'
import type { DocProps } from './model'
import { DocDate, DocTitle, FreeText, LinesTable, Party, Sheet, Signatures, Totals } from './parts'
import { resolveTotals } from './totals'

export function QuoteDoc({ document, signatureImageUrl, timeZone = DEFAULT_TIME_ZONE }: DocProps) {
  const totals = resolveTotals(document)
  const title = t('doc.quote.title')
  return (
    <Sheet kind="quote" label={`${title} ${document.number ?? t('doc.draft')}`}>
      <header className="doc-head">
        <DocTitle title={title} number={document.number} />
        <div className="doc-meta">
          <p>
            {t('doc.from')} <DocDate date={document.issueDate} />
          </p>
          {document.validUntil && (
            <p>
              {t('doc.validUntil')} <DocDate date={document.validUntil} />
            </p>
          )}
        </div>
      </header>
      <div className="doc-parties">
        <Party label={t('doc.party.executor')} party={document.companySnapshot} />
        <Party label={t('doc.party.customer')} party={document.clientSnapshot} />
      </div>
      <LinesTable document={document} totals={totals} />
      <Totals document={document} totals={totals} />
      <FreeText document={document} />
      <Signatures
        company={document.companySnapshot}
        signature={document.signature}
        signatureImageUrl={signatureImageUrl}
        timeZone={timeZone}
      />
    </Sheet>
  )
}
