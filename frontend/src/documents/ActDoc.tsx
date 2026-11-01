// The акт выполненных работ (АВР) on an A4 sheet, laid out after form Р-1 (MinFin order No. 562, appendix 50;
// docs/kz-rules.md, row 5): the parties, the contract and the document number and date, the lines with the date of
// each work, the total and the total in words, and the "Сдал / Принял" blocks that both sides sign on paper.
// The client signing the act on screen is post-MVP (spec D5); a signature record, if one is passed, is shown
// as "Подпись на экране" like on the other documents.
//
// The wording of the columns, the lines and the footnotes is the form's own (appendix 50, old.adilet.zan.kz/rus/docs/V1200008265).
// Docura holds no data for column 4 ("Сведения об отчёте", only "при наличии"), the stocks received from the customer
// or the list of attachments, so they keep their place on the form and stay empty, to fill in by hand if they apply.

import { amountInWords } from '../domain'
import { t } from '../i18n/t'
import './ActDoc.css'
import { DEFAULT_TIME_ZONE, formatDate, formatDateTime, formatQty } from './format'
import type { DocProps, RenderableDocument } from './model'
import { DocDate, DocTitle, FreeText, Marked, Money, Party, Sheet, Totals } from './parts'
import { resolveTotals, type ResolvedTotals } from './totals'

// A work date that is not filled in yet (a draft) is left as a dash, so the column keeps its shape.
const MISSING = '—'
const COLUMN_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8]

function ActLines({ document, totals }: { document: RenderableDocument; totals: ResolvedTotals }) {
  return (
    <table className="doc-table act-table" aria-label={t('doc.table.label')}>
      <thead>
        <tr>
          <th scope="col" rowSpan={2} className="doc-col-n act-col-n">
            {t('act.doc.col.n')}
          </th>
          <th scope="col" rowSpan={2} className="doc-col-title">
            {t('act.doc.col.title')}
          </th>
          <th scope="col" rowSpan={2} className="act-col-date">
            {t('act.doc.col.date')}
          </th>
          <th scope="col" rowSpan={2} className="act-col-report">
            {t('act.doc.col.report')}
          </th>
          <th scope="col" rowSpan={2} className="act-col-unit">
            {t('act.doc.col.unit')}
          </th>
          <th scope="colgroup" colSpan={3} className="act-col-done">
            {t('act.doc.col.done')}
          </th>
        </tr>
        <tr>
          <th scope="col" className="doc-col-num">
            {t('act.doc.col.qty')}
          </th>
          <th scope="col" className="doc-col-num">
            {t('act.doc.col.price')}
          </th>
          <th scope="col" className="doc-col-num">
            {t('act.doc.col.sum')}
          </th>
        </tr>
        <tr className="act-col-numbers" aria-hidden="true">
          {COLUMN_NUMBERS.map((number) => (
            <th key={number}>{number}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {document.lines.map((line, index) => (
          <tr key={index}>
            <td className="doc-col-n act-col-n">{index + 1}</td>
            <td className="doc-col-title">
              <Marked text={line.title} />
              {line.description && <span className="doc-line-note">{line.description}</span>}
            </td>
            <td className="act-col-date">{line.workDate ? <DocDate date={line.workDate} /> : MISSING}</td>
            <td className="act-col-report">{MISSING}</td>
            <td className="act-col-unit">{line.unit}</td>
            <td className="doc-col-num">{formatQty(line.qtyMilli)}</td>
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

interface SignBlockProps {
  title: string
  /** Filled in when the document knows it (the executor); left to be written by hand otherwise. */
  position?: string
  name?: string
}

/** Должность · подпись · расшифровка, each a ruled line with its caption under it, then the stamp mark. */
function SignBlock({ title, position, name }: SignBlockProps) {
  const row = (caption: string, value?: string) => (
    <div className="act-sign-row">
      <span className="act-sign-value">{value}</span>
      <span className="act-sign-caption">{caption}</span>
    </div>
  )
  return (
    <section className="act-sign" aria-label={title}>
      <h3 className="doc-label">{title}</h3>
      {row(t('act.doc.position'), position)}
      {row(t('act.doc.signature'))}
      {row(t('act.doc.fullName'), name)}
      <span className="act-sign-stamp">{t('act.doc.stamp')}</span>
    </section>
  )
}

export function ActDoc({ document, signatureImageUrl, timeZone = DEFAULT_TIME_ZONE }: DocProps) {
  const totals = resolveTotals(document)
  const title = t('act.doc.title')
  const { signature } = document
  const when = signature ? formatDateTime(signature.signedAt, timeZone) : null
  return (
    <Sheet kind="act" label={`${title} ${document.number ?? t('doc.draft')}`}>
      <header className="doc-head">
        <DocTitle title={`${title}*`} number={document.number} />
        <div className="doc-meta">
          <p>
            {t('doc.from')} <DocDate date={document.issueDate} />
          </p>
          {document.periodFrom && document.periodTo && (
            <p>
              <span className="doc-fact-label">{t('act.doc.period')}:</span>{' '}
              {t('act.doc.periodRange', { from: formatDate(document.periodFrom), to: formatDate(document.periodTo) })}
            </p>
          )}
        </div>
        {document.contractRef && (
          <p>
            <span className="doc-fact-label">{t('act.doc.contract')}:</span> <Marked text={document.contractRef} />
          </p>
        )}
      </header>
      <div className="doc-parties">
        <Party label={t('doc.party.customer')} party={document.clientSnapshot} />
        <Party label={t('doc.party.executor')} party={document.companySnapshot} />
      </div>
      <ActLines document={document} totals={totals} />
      <Totals document={document} totals={totals} />
      <section className="doc-words">
        <p>
          {t('doc.itemsTotal', { n: document.lines.length })} <Money tiyn={totals.grossTiyn} />
        </p>
        <p>
          <span className="doc-fact-label">{t('doc.inWords')}:</span> <strong>{amountInWords(totals.grossTiyn)}</strong>
        </p>
      </section>
      <FreeText document={document} />
      <section className="act-form-lines">
        <p className="act-sign-date">
          <span className="doc-fact-label">{t('act.doc.stocks')}:</span> <span className="act-sign-blank" aria-hidden="true" />
        </p>
        <p className="act-sign-date">
          <span className="doc-fact-label">{t('act.doc.attachments')}</span> <span className="act-sign-blank" aria-hidden="true" /> <span>{t('act.doc.attachments.pages')}</span>
        </p>
      </section>
      <footer className="act-signatures">
        <div className="act-sign-pair">
          <SignBlock
            title={t('act.doc.handedOver')}
            position={document.companySnapshot.directorPosition}
            name={document.companySnapshot.directorName}
          />
          <SignBlock title={t('act.doc.accepted')} />
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
        <p className="act-sign-date">
          <span className="doc-fact-label">{t('act.doc.signedOn')}:</span> <span className="act-sign-blank" aria-hidden="true" />
        </p>
        <div className="act-notes">
          <p>{t('act.doc.note1')}</p>
          <p>{t('act.doc.note2')}</p>
          <p>{t('act.doc.note3')}</p>
        </div>
      </footer>
    </Sheet>
  )
}
