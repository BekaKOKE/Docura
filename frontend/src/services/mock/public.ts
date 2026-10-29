// The mock PublicService (#24): what the client sees at /p/:token and the finger signature ("Подпись на экране").
// The token in the link is the credential, so the link is found across companies (store.readAll); everything after
// that runs scoped to the link's company. The result is a whitelist (replica/architecture.md, "Public links"): no id
// of the company, the client or the user, no share token and no internal flag. `isExpired` is derived from
// `validUntil` in the company's time zone and never stored; signing stops after it, viewing doesn't.

import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import type { PublicService } from '../contracts'
import { ApiError } from '../errors'
import type { PublicDocument, PublicSignInput } from '../types'
import { canonicalJson, mockDigest } from './digest'
import { newId } from './ids'
import type { MockRuntime } from './runtime'
import { notFound, type ScopedDb } from './scopedDb'
import type { StoredDocument, StoredShareLink } from './storeTypes'
import { todayInZone, utcTimestamp } from './time'

export const SIGNER_NAME_MAX = 200
export const SIGNATURE_MAX_BYTES = 200 * 1024
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const DATA_URL_PREFIX = /^data:image\/png;base64,/i

/** The two consent sentences the client agrees to; kept with the signature as evidence of what was shown. */
function consentTextFor(number: string | null, grossTiyn: number): string {
  return [
    `Я ознакомился с коммерческим предложением № ${number ?? ''} на сумму ${formatMoney(grossTiyn)} и принимаю его.`,
    'Согласен на обработку моих персональных данных (имя, подпись, IP-адрес) для подтверждения подписи.',
  ].join('\n')
}

const apiError = (code: ConstructorParameters<typeof ApiError>[0]['code']) =>
  new ApiError({ code, message: t(`apiError.${code}`) })

// ---------------------------------------------------------------- the signature image

/** The base64 of `input` without a `data:` prefix and whitespace. */
function cleanBase64(input: string): string {
  return input.replace(DATA_URL_PREFIX, '').replace(/\s+/g, '')
}

/** The decoded bytes, or null when `base64` is not valid base64. */
function decodeBase64(base64: string): Uint8Array | null {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return null
  try {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

/** The drawn image is valid base64 of a PNG, at most 200 KB decoded. */
function imageIsValid(base64: string): boolean {
  if (base64 === '') return false
  // Refuse a huge text before decoding it: 4 base64 characters carry 3 bytes.
  if (base64.length > Math.ceil(SIGNATURE_MAX_BYTES / 3) * 4) return false
  const bytes = decodeBase64(base64)
  if (!bytes || bytes.length > SIGNATURE_MAX_BYTES || bytes.length < PNG_MAGIC.length) return false
  return PNG_MAGIC.every((byte, index) => bytes[index] === byte)
}

// ---------------------------------------------------------------- stored rows to the client's view

interface Linked {
  link: StoredShareLink
  /** The signed-in user belongs to the link's company (the owner looking at their own link). */
  member: boolean
}

function expired(row: StoredDocument, today: string): boolean {
  return row.type === 'quote' && row.status === 'sent' && row.validUntil !== null && row.validUntil < today
}

function publicView(db: ScopedDb, row: StoredDocument, now: Date): PublicDocument {
  const company = db.company()
  const isExpired = expired(row, todayInZone(company.timezone, now))
  const signature = db.rows('signatures').find((s) => s.documentId === row.id)
  const drawn = row.status === 'signed' && signature?.method === 'drawn' && signature.imagePngBase64
  return {
    type: row.type,
    status: row.status,
    number: row.number,
    issueDate: row.issueDate,
    validUntil: row.validUntil,
    dueDate: row.dueDate,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    contractRef: row.contractRef,
    clientSnapshot: row.clientSnapshot,
    companySnapshot: row.companySnapshot,
    vatEnabled: row.vatEnabled,
    vatRateBp: row.vatRateBp,
    currency: row.currency,
    netTiyn: row.netTiyn,
    vatTiyn: row.vatTiyn,
    grossTiyn: row.grossTiyn,
    notes: row.notes,
    terms: row.terms,
    // The catalog's article id is internal; the client has no use for it.
    lines: row.lines.map(({ qtyText: _qtyText, ...line }) => ({ ...line, articleId: null })),
    version: row.version,
    canSign: row.type === 'quote' && row.status === 'sent' && !isExpired,
    isExpired,
    signature: signature
      ? {
          method: signature.method,
          signerName: signature.signerName,
          signedAt: signature.signedAt,
          documentVersion: signature.documentVersion,
        }
      : null,
    logoUrl: company.logoDataUrl ?? null,
    signatureImageUrl: drawn ? `data:image/png;base64,${drawn}` : null,
  }
}

/** The document as the client signs it: what the evidence hash covers. */
function snapshotOf(row: StoredDocument) {
  return {
    type: row.type,
    number: row.number,
    issueDate: row.issueDate,
    validUntil: row.validUntil,
    clientSnapshot: row.clientSnapshot,
    companySnapshot: row.companySnapshot,
    vatEnabled: row.vatEnabled,
    vatRateBp: row.vatRateBp,
    netTiyn: row.netTiyn,
    vatTiyn: row.vatTiyn,
    grossTiyn: row.grossTiyn,
    notes: row.notes,
    terms: row.terms,
    lines: row.lines.map((line) => ({
      position: line.position,
      kind: line.kind,
      title: line.title,
      description: line.description ?? null,
      unit: line.unit,
      qtyMilli: line.qtyMilli,
      unitPriceTiyn: line.unitPriceTiyn,
      discountBp: line.discountBp,
      netTiyn: line.netTiyn,
      vatTiyn: line.vatTiyn,
      grossTiyn: line.grossTiyn,
    })),
  }
}

// ---------------------------------------------------------------- the checks of a signature

/** Per-field problems of the sign input (camelCase keys). The messages are the generic one until the screen's own are in i18n. */
function inputProblems(input: PublicSignInput, image: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const message = t('apiError.validation_error')
  const name = typeof input.signerName === 'string' ? input.signerName.trim() : ''
  if (name === '' || name.length > SIGNER_NAME_MAX) fields.signerName = message
  if (typeof input.signaturePng !== 'string' || !imageIsValid(image)) fields.signaturePng = message
  if ((input.consentAccepted as unknown) !== true) fields.consentAccepted = message
  if ((input.personalDataConsent as unknown) !== true) fields.personalDataConsent = message
  return fields
}

// ---------------------------------------------------------------- the service

export function createMockPublic(getRuntime: () => MockRuntime): PublicService {
  /** The link of a token (any company). `not_found` for an unknown one, `link_revoked` for a withdrawn one. */
  function findLink(runtime: MockRuntime, token: string): Linked {
    return runtime.store.readAll((data) => {
      const link = data.shareLinks.find((l) => l.token === token)
      if (!link) throw notFound()
      if (link.revokedAt !== null) throw apiError('link_revoked')
      const session = data.session
      const user = session ? data.users.find((u) => u.id === session.userId) : undefined
      return { link, member: user?.companyId === link.companyId }
    })
  }

  function documentOf(db: ScopedDb, link: StoredShareLink): StoredDocument {
    const row = db.find('documents', link.documentId)
    // A draft has no link to begin with; if the data says otherwise it is still not reachable.
    if (!row || row.status === 'draft') throw notFound()
    return row
  }

  return {
    get(token) {
      const runtime = getRuntime()
      return runtime.call(() => {
        const { link, member } = findLink(runtime, token)
        const now = runtime.now()
        if (member) return runtime.store.readIn(link.companyId, (db) => publicView(db, documentOf(db, link), now))
        return runtime.store.writeIn(link.companyId, (db) => {
          const row = documentOf(db, link)
          const stamp = utcTimestamp(now)
          db.patch('shareLinks', link.id, {
            viewCount: link.viewCount + 1,
            firstViewedAt: link.firstViewedAt ?? stamp,
            lastViewedAt: stamp,
          })
          return publicView(db, row, now)
        })
      })
    },

    sign(token, input) {
      const runtime = getRuntime()
      return runtime.call(() => {
        const { link } = findLink(runtime, token)
        const now = runtime.now()
        return runtime.store.writeIn(link.companyId, (db) => {
          const row = documentOf(db, link)
          if (row.status === 'signed' || db.rows('signatures').some((s) => s.documentId === row.id)) {
            throw apiError('already_signed')
          }
          if (expired(row, todayInZone(db.company().timezone, now))) throw apiError('link_expired')
          if (row.type !== 'quote' || row.status !== 'sent') throw apiError('document_locked')
          if (input.version !== row.version) throw apiError('version_conflict')

          const image = typeof input.signaturePng === 'string' ? cleanBase64(input.signaturePng) : ''
          const fields = inputProblems(input, image)
          if (Object.keys(fields).length > 0) {
            throw new ApiError({ code: 'validation_error', message: t('apiError.validation_error'), fields })
          }

          const signedAt = utcTimestamp(now)
          const snapshot = snapshotOf(row)
          db.insert('signatures', {
            id: newId(),
            documentId: row.id,
            shareLinkId: link.id,
            method: 'drawn',
            signerRole: 'client',
            signerName: input.signerName.trim(),
            imagePngBase64: image,
            imageSha256: mockDigest(image),
            documentSha256: mockDigest(canonicalJson(snapshot)),
            documentVersion: row.version,
            documentSnapshot: snapshot,
            consentText: consentTextFor(row.number, row.grossTiyn),
            ip: '127.0.0.1',
            userAgent: globalThis.navigator?.userAgent ?? null,
            signedAt,
          })
          const saved = db.patch('documents', row.id, { status: 'signed', signedAt, version: row.version + 1 })
          return publicView(db, saved, now)
        })
      })
    },
  }
}
