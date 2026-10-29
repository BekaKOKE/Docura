// What goes out when a quote is shared (S09, #22): the message, the WhatsApp address and the copy. Pure functions,
// no React, so the wording and the address can be tested without a screen.

import { formatMoney } from '../../domain'
import { normalizeKzPhone } from '../../domain/phone'
import { formatDate } from '../../documents/format'
import { t } from '../../i18n/t'
import type { ClientSnapshot, Document } from '../../services'

/** The first word of a name: «Қайрат» from «Қайрат Әбілқасымов». */
const firstWord = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/**
 * How the message greets the client: a person by their first name, a company by its contact person's first name.
 * A company with no contact person is greeted without a name.
 */
export function greetingName(client: Pick<ClientSnapshot, 'kind' | 'name' | 'contactName'>): string | null {
  const source = client.kind === 'person' ? client.name : (client.contactName ?? '')
  const word = firstWord(source)
  return word === '' ? null : word
}

/** "Здравствуйте, Қайрат! Отправляю коммерческое предложение на 323 930 ₸, действует до 03.11.2026: {ссылка}". */
export function shareMessage(quote: Pick<Document, 'clientSnapshot' | 'grossTiyn' | 'validUntil' | 'shareUrl'>): string {
  const name = greetingName(quote.clientSnapshot)
  const hello = name ? t('qs.hello', { name }) : t('qs.helloAnon')
  const amount = formatMoney(quote.grossTiyn)
  const link = quote.shareUrl ?? ''
  const body = quote.validUntil
    ? t('qs.body', { amount, date: formatDate(quote.validUntil), link })
    : t('qs.bodyNoDate', { amount, link })
  return `${hello} ${body}`
}

/** `https://wa.me/77011234567?text=…`, or null when the client has no phone that WhatsApp can open. */
export function whatsappLink(phone: string | null, message: string): string | null {
  const normalized = phone ? normalizeKzPhone(phone) : null
  if (!normalized) return null
  return `https://wa.me/${normalized.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}

/**
 * Puts `text` on the clipboard. The clipboard API exists only on https and localhost, and a phone that opens the dev
 * server over the LAN has neither, so the old way (a hidden field and the copy command) is the second try.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Refused (no permission, not focused): try the old way.
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
