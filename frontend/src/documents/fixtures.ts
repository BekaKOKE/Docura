// Documents for the renderer tests, cut from the seed (contracts/fixtures/seed.json) so the tests read the same
// data the app shows. Test code only: nothing in the app imports this file. It reads the seed file itself, because
// code outside src/services never imports the mock (boundary.test.ts).

import seedFile from '../../../contracts/fixtures/seed.json'
import type { RenderableDocument } from './model'

interface SeedRow {
  companyId: string
  number: string | null
  lines: ({ qtyText?: string } & Record<string, unknown>)[]
}
const seed = seedFile as unknown as {
  companies: { id: string; legalName: string }[]
  documents: SeedRow[]
}

/** A seed document as the renderers get it: the stored row without the fields only the mock store keeps. */
export function seedDocument(number: string, companyName = 'ИП Сейткали Б.'): RenderableDocument {
  const company = seed.companies.find((c) => c.legalName === companyName)
  const row = seed.documents.find((d) => d.number === number && d.companyId === company?.id)
  if (!row) throw new Error(`The seed has no document ${number} for ${companyName}`)
  return {
    ...row,
    lines: row.lines.map(({ qtyText: _qtyText, ...line }) => line),
    signature: null,
  } as unknown as RenderableDocument
}

/** The reference quote of 323 930 ₸ (КП-2026-0001), VAT on. */
export const referenceQuote = () => seedDocument('КП-2026-0001')

/** The same document with VAT switched off: the saved totals are dropped, so they are computed without VAT. */
export function withoutVat(doc: RenderableDocument): RenderableDocument {
  return {
    ...doc,
    vatEnabled: false,
    netTiyn: undefined,
    vatTiyn: undefined,
    grossTiyn: undefined,
    lines: doc.lines.map((line) => ({ ...line, netTiyn: undefined, vatTiyn: undefined, grossTiyn: undefined })),
  }
}
