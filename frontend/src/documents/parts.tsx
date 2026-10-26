// The pieces both renderers (QuoteDoc, InvoiceDoc) and the later act are made of. Money, numbers and dates are
// atomic: they carry `dc-money` / `dc-code` / `doc-nowrap`, so an amount or a document number never wraps
// (components.md §0, rules 2 and 3).

import type { ReactNode } from 'react'
import { formatMoney } from '../domain'
import { t } from '../i18n/t'
import type { ClientSnapshot, CompanySnapshot, SignatureSummary } from '../services'
import './documents.css'
import './print.css'
import { formatDate, formatDateTime, formatQty, formatRate, taxIdLabel } from './format'
import type { RenderableDocument } from './model'
import type { ResolvedTotals } from './totals'

/** An amount on a document: always with tiyn ("323 930,00 ₸"). The ₸ is decoration, "тенге" is read out. */
export function Money({ tiyn }: { tiyn: number }) {
  const text = formatMoney(tiyn, 'document')
  const digits = text.replace(/[\s ]*₸$/, '')
  return (
    <span className="dc-money">
      {digits}
      <span aria-hidden="true">&nbsp;₸</span>
      <span className="doc-sr-only"> {t('doc.tengeWord')}</span>
    </span>
  )
}

/** A document number or a tax number: one identifier per element, in the mono face, never split. */
export function Code({ children }: { children: ReactNode }) {
  return <span className="dc-code">{children}</span>
}

/** A dd.mm.yyyy date that stays on one line. */
export function DocDate({ date }: { date: string }) {
  return <span className="doc-nowrap">{formatDate(date)}</span>
}

const MARKED = /((?:КП|СЧ|АВР)-\d{4}-\d{4})|(\d{2}\.\d{2}\.\d{4})/g

/**
 * Free text that mentions documents ("Предоплата 50% по КП № КП-2026-0002 от 02.10.2026"): the document numbers
 * and dates inside it are kept whole, so they never split across lines.
 */
export function Marked({ text }: { text: string }) {
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(MARKED)) {
    if (match.index > last) out.push(text.slice(last, match.index))
    out.push(
      match[1] ? (
        <Code key={match.index}>{match[1]}</Code>
      ) : (
        <span key={match.index} className="doc-nowrap">
          {match[2]}
        </span>
      ),
    )
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

/** The A4 sheet: 595 × 842 pt on screen, the page margins of the print dialog in print (documents.css). */
export function Sheet({ kind, label, children }: { kind: string; label: string; children: ReactNode }) {
  return (
    <article className="doc-sheet" data-doc={kind} lang="ru" aria-label={label}>
      {children}
    </article>
  )
}

/** "Коммерческое предложение № КП-2026-0001": the number is an identifier, the words around it may wrap. */
export function DocTitle({ title, number }: { title: string; number: string | null }) {
  return (
    <h2 className="doc-title">
      {title}{' '}
      {number ? (
        <>
          {t('doc.numberSign')} <Code>{number}</Code>
        </>
      ) : (
        <span className="doc-draft">({t('doc.draft')})</span>
      )}
    </h2>
  )
}

interface FactProps {
  label: string
  children: ReactNode
}

function Fact({ label, children }: FactProps) {
  return (
    <p className="doc-fact">
      <span className="doc-fact-label">{label}</span> {children}
    </p>
  )
}

/** One side of the deal: the label, the name, and whatever requisites are filled in. */
export function Party({ label, party }: { label: string; party: CompanySnapshot | ClientSnapshot }) {
  const name = 'legalName' in party ? party.legalName : party.name
  return (
    <section className="doc-party">
      <h3 className="doc-label">{label}</h3>
      <p className="doc-party-name">{name}</p>
      {party.binIin && (
        <Fact label={t(taxIdLabel(party))}>
          <Code>{party.binIin}</Code>
        </Fact>
      )}
      {party.address && <p className="doc-line">{party.address}</p>}
      {party.phone && (
        <Fact label={t('doc.phone')}>
          <span className="doc-nowrap">{party.phone}</span>
        </Fact>
      )}
      {party.email && (
        <Fact label={t('doc.email')}>
          <span className="doc-email">{party.email}</span>
        </Fact>
      )}
      {'vatCertificate' in party && party.vatCertificate && (
        <Fact label={t('doc.vatCertificate')}>
          <Code>{party.vatCertificate}</Code>
        </Fact>
      )}
    </section>
  )
}

/** The lines: № · Наименование · Кол-во · Ед. · Цена · Сумма (before VAT). Rows never split across pages. */
export function LinesTable({ document, totals }: { document: RenderableDocument; totals: ResolvedTotals }) {
  return (
    <table className="doc-table" aria-label={t('doc.table.label')}>
      <thead>
        <tr>
          <th scope="col" className="doc-col-n">
            {t('doc.col.n')}
          </th>
          <th scope="col" className="doc-col-title">
            {t('doc.col.title')}
          </th>
          <th scope="col" className="doc-col-num">
            {t('doc.col.qty')}
          </th>
          <th scope="col" className="doc-col-unit">
            {t('doc.col.unit')}
          </th>
          <th scope="col" className="doc-col-num">
            {t('doc.col.price')}
          </th>
          <th scope="col" className="doc-col-num">
            {t('doc.col.sum')}
          </th>
        </tr>
      </thead>
      <tbody>
        {document.lines.map((line, index) => (
          <tr key={index}>
            <td className="doc-col-n">{index + 1}</td>
            <td className="doc-col-title">
              <Marked text={line.title} />
              {line.description && <span className="doc-line-note">{line.description}</span>}
            </td>
            <td className="doc-col-num">{formatQty(line.qtyMilli)}</td>
            <td className="doc-col-unit">{line.unit}</td>
            <td className="doc-col-num">
              <Money tiyn={line.unitPriceTiyn} />
            </td>
            <td className="doc-col-num">
              <Money tiyn={totals.lines[index].netTiyn} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Без НДС / НДС 16 % / Итого. A document without VAT prints the words "Без НДС" in place of the VAT amount
 * (spec §6), and its Итого is the plain sum.
 */
export function Totals({ document, totals }: { document: RenderableDocument; totals: ResolvedTotals }) {
  return (
    <table className="doc-totals">
      <tbody>
        {document.vatEnabled ? (
          <>
            <tr>
              <th scope="row">{t('doc.total.net')}</th>
              <td>
                <Money tiyn={totals.netTiyn} />
              </td>
            </tr>
            <tr>
              <th scope="row">{t('doc.total.vat', { rate: formatRate(document.vatRateBp) })}</th>
              <td>
                <Money tiyn={totals.vatTiyn} />
              </td>
            </tr>
          </>
        ) : (
          <tr>
            <th scope="row">{t('doc.total.vatLabel')}</th>
            <td>{t('doc.total.noVat')}</td>
          </tr>
        )}
        <tr className="doc-total-gross">
          <th scope="row">{t('doc.total.gross')}</th>
          <td>
            <Money tiyn={totals.grossTiyn} />
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Примечание and Условия, when filled in. Line breaks of the text are kept. */
export function FreeText({ document }: { document: RenderableDocument }) {
  const blocks = [
    { key: 'doc.notes', text: document.notes },
    { key: 'doc.terms', text: document.terms },
  ] as const
  const filled = blocks.filter((block) => block.text && block.text.trim() !== '')
  if (filled.length === 0) return null
  return (
    <>
      {filled.map(({ key, text }) => (
        <section key={key} className="doc-free">
          <h3 className="doc-label">{t(key)}</h3>
          <p className="doc-free-text">{text}</p>
        </section>
      ))}
    </>
  )
}

interface SignaturesProps {
  company: CompanySnapshot
  signature?: SignatureSummary | null
  signatureImageUrl?: string
  timeZone: string
}

/**
 * The executor's line, and the client's signature when there is one. The client's signature is only ever
 * "Подпись на экране" (spec §7): never a legal claim.
 */
export function Signatures({ company, signature, signatureImageUrl, timeZone }: SignaturesProps) {
  const when = signature ? formatDateTime(signature.signedAt, timeZone) : null
  return (
    <footer className="doc-signatures">
      <div className="doc-sign-executor">
        <span className="doc-label">{t('doc.sign.executor')}</span>
        <span className="doc-sign-position">{company.directorPosition}</span>
        <span className="doc-sign-rule" aria-hidden="true" />
        <span className="doc-sign-name">{company.directorName}</span>
        <span className="doc-sign-caption">{t('doc.sign.line')}</span>
      </div>
      {signature && when && (
        <div className="doc-sign-screen">
          <span className="doc-label">{t('doc.sign.onScreen')}</span>
          {signatureImageUrl && (
            <img
              className="doc-sign-image"
              src={signatureImageUrl}
              alt={t('doc.sign.imageAlt', { name: signature.signerName })}
            />
          )}
          <span>
            {t('doc.sign.signed', { when: t('doc.sign.at', { date: when.date, time: when.time }) })}
            {' · '}
            {signature.signerName}
          </span>
        </div>
      )}
    </footer>
  )
}
