// The счёт на оплату on an A4 sheet. Beyond the quote it carries what the payer needs to fill a payment order:
// the beneficiary's ИИК, БИК, Кбе and КНП (docs/kz-rules.md, row 4), the due date, what it was made from, and the
// total in words (spec §6). The prepayment line ("Предоплата 50% по КП № … от …") is an ordinary line of the invoice.

import type { ReactNode } from 'react'
import { amountInWords } from '../domain'
import { t } from '../i18n/t'
import type { CompanySnapshot } from '../services'
import { DEFAULT_TIME_ZONE, taxIdLabel } from './format'
import type { DocProps } from './model'
import {
  Code,
  DocDate,
  DocTitle,
  FreeText,
  LinesTable,
  Marked,
  Money,
  Party,
  Sheet,
  Signatures,
  Totals,
} from './parts'
import { resolveTotals } from './totals'

// A requisite that the company has not filled in yet is left as a dash, so the block keeps its shape.
const MISSING = '—'

function PayCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="doc-pay-cell">
      <span className="doc-label">{label}</span> <span className="doc-pay-value">{children}</span>
    </div>
  )
}

/** Бенефициар · ИИК · Кбе / Банк бенефициара · БИК · КНП: the block a bank clerk or a banking app reads. */
function PaymentDetails({ company }: { company: CompanySnapshot }) {
  const code = (value: string | null | undefined) => (value ? <Code>{value}</Code> : MISSING)
  return (
    <section className="doc-pay" aria-label={t('doc.pay.title')}>
      <PayCell label={t('doc.pay.beneficiary')}>
        {company.legalName}
        {company.binIin && (
          <>
            {' '}
            <span className="doc-pay-muted">{t(taxIdLabel(company))}</span> <Code>{company.binIin}</Code>
          </>
        )}
      </PayCell>
      <PayCell label={t('doc.pay.iik')}>{code(company.iik)}</PayCell>
      <PayCell label={t('doc.pay.kbe')}>{code(company.kbe)}</PayCell>
      <PayCell label={t('doc.pay.bank')}>{company.bankName ?? MISSING}</PayCell>
      <PayCell label={t('doc.pay.bik')}>{code(company.bik)}</PayCell>
      <PayCell label={t('doc.pay.knp')}>{code(company.defaultKnp)}</PayCell>
    </section>
  )
}

export function InvoiceDoc({ document, signatureImageUrl, timeZone = DEFAULT_TIME_ZONE }: DocProps) {
  const totals = resolveTotals(document)
  const title = t('doc.invoice.title')
  return (
    <Sheet kind="invoice" label={`${title} ${document.number ?? t('doc.draft')}`}>
      <PaymentDetails company={document.companySnapshot} />
      <header className="doc-head">
        <DocTitle title={title} number={document.number} />
        <div className="doc-meta">
          <p>
            {t('doc.from')} <DocDate date={document.issueDate} />
          </p>
          {document.dueDate && (
            <p>
              {t('doc.dueDate')} <DocDate date={document.dueDate} />
            </p>
          )}
        </div>
        {document.contractRef && (
          <p>
            <span className="doc-fact-label">{t('doc.basis')}:</span> <Marked text={document.contractRef} />
          </p>
        )}
      </header>
      <div className="doc-parties">
        <Party label={t('doc.party.supplier')} party={document.companySnapshot} />
        <Party label={t('doc.party.buyer')} party={document.clientSnapshot} />
      </div>
      <LinesTable document={document} totals={totals} />
      <Totals document={document} totals={totals} />
      <section className="doc-words">
        <p>
          {t('doc.itemsTotal', { n: document.lines.length })} <Money tiyn={totals.grossTiyn} />
        </p>
        <p>
          <span className="doc-fact-label">{t('doc.inWords')}:</span>{' '}
          <strong>{amountInWords(totals.grossTiyn)}</strong>
        </p>
      </section>
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
