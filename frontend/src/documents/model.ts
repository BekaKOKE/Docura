// What the renderers need from a document. A `Document` (services), a `PublicDocument` (the client's link) and
// the editor's draft all fit, so one renderer serves the preview, the public page and print (spec §4, row 5).

import type {
  BasisPoints,
  ClientSnapshot,
  CompanySnapshot,
  IsoDate,
  QtyMilli,
  SignatureSummary,
  Tiyn,
} from '../services'

export interface RenderableLine {
  title: string
  description?: string | null
  unit: string
  qtyMilli: QtyMilli
  unitPriceTiyn: Tiyn
  discountBp?: BasisPoints
  /**
   * The line totals as saved. The editor's draft has none yet: then the renderer computes them from quantity and
   * price with src/domain, the same way the editor does, so the preview matches it to the tiyn.
   */
  netTiyn?: Tiyn
  vatTiyn?: Tiyn
  grossTiyn?: Tiyn
}

export interface RenderableDocument {
  /** Null while the document is a draft. */
  number: string | null
  issueDate: IsoDate
  /** Quote only. */
  validUntil?: IsoDate | null
  /** Invoice only. */
  dueDate?: IsoDate | null
  /** "КП № КП-2026-0004 от 05.10.2026": what an invoice was made from. */
  contractRef?: string | null
  clientSnapshot: ClientSnapshot
  companySnapshot: CompanySnapshot
  vatEnabled: boolean
  vatRateBp: BasisPoints
  notes?: string | null
  terms?: string | null
  lines: readonly RenderableLine[]
  /** Document totals as saved; computed from the lines when absent. */
  netTiyn?: Tiyn
  vatTiyn?: Tiyn
  grossTiyn?: Tiyn
  /** The sign-on-screen record of a signed document. */
  signature?: SignatureSummary | null
}

/** What every renderer takes. */
export interface DocProps {
  document: RenderableDocument
  /** The client's drawn signature as an image URL (the public page and the signed preview). */
  signatureImageUrl?: string
  /** IANA zone the signing time is shown in. The company's zone; Asia/Almaty by default (spec §8). */
  timeZone?: string
}
