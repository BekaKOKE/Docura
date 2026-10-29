// The quote editor's form as something the document renderer can draw (the live preview next to the form on a
// desktop, S07 + S08). Nothing is saved: a line that is not a number yet counts as 0, and the renderer computes the
// totals from quantity and price with src/domain, the same code as the editor's totals bar.

import { parsePriceInput } from '../../domain/article'
import type { RenderableDocument } from '../../documents'
import type { Client, ClientSnapshot, Company, CompanySnapshot, IsoDate } from '../../services'
import { parseQty, validUntilOf, VAT_RATE_BP, type QuoteDraft } from './draft'

/** What a client looks like on the printed quote. */
export function clientSnapshotOf(client: Client): ClientSnapshot {
  return {
    kind: client.kind,
    name: client.name,
    binIin: client.binIin,
    contactName: client.contactName ?? null,
    phone: client.phone,
    email: client.email,
    address: client.address,
  }
}

/** What the company looks like on the printed quote. */
export function companySnapshotOf(company: Company): CompanySnapshot {
  return {
    legalForm: company.legalForm,
    legalName: company.legalName,
    binIin: company.binIin,
    address: company.address,
    phone: company.phone,
    email: company.email,
    directorName: company.directorName,
    directorPosition: company.directorPosition,
    vatPayer: company.vatPayer,
    vatCertificate: company.vatCertificate ?? null,
    bankName: company.bankName,
    iik: company.iik,
    bik: company.bik,
    kbe: company.kbe,
    defaultKnp: company.defaultKnp,
  }
}

const NO_CLIENT: ClientSnapshot = { kind: 'person', name: '', binIin: null, phone: null, email: null, address: null }

export interface PreviewContext {
  client: ClientSnapshot | null
  company: Company
  issueDate: IsoDate
  /** Null while the quote is a draft. */
  number: string | null
}

export function previewDocument(draft: QuoteDraft, context: PreviewContext): RenderableDocument {
  const validUntil = validUntilOf(draft, context.issueDate)
  return {
    number: context.number,
    issueDate: context.issueDate,
    validUntil: validUntil === '' ? null : validUntil,
    clientSnapshot: context.client ?? NO_CLIENT,
    companySnapshot: companySnapshotOf(context.company),
    vatEnabled: draft.vatEnabled,
    vatRateBp: VAT_RATE_BP,
    notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
    lines: draft.lines.map((line) => {
      const qty = parseQty(line.qty)
      const price = parsePriceInput(line.price)
      return {
        title: line.title.trim(),
        unit: line.unit,
        qtyMilli: qty.ok ? qty.milli : 0,
        unitPriceTiyn: price.ok ? price.tiyn : 0,
      }
    }),
  }
}
