import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientSnapshot } from '../../services'
import { copyText, greetingName, shareMessage, whatsappLink } from './share'

// What goes out when a quote is shared (S09, #22 AC 4).

const person = (patch: Partial<ClientSnapshot> = {}): ClientSnapshot => ({
  kind: 'person',
  name: 'Қайрат Әбілқасымов',
  binIin: null,
  phone: '+7 701 123 45 67',
  email: null,
  address: null,
  ...patch,
})

const quote = (patch: Partial<Parameters<typeof shareMessage>[0]> = {}) => ({
  clientSnapshot: person(),
  grossTiyn: 32_393_000,
  validUntil: '2026-11-03',
  shareUrl: 'http://localhost:5173/p/tok123',
  ...patch,
})

describe('greetingName', () => {
  it('greets a person by the first word of the name', () => {
    expect(greetingName(person())).toBe('Қайрат')
    expect(greetingName(person({ name: 'Ирина Ёлкина' }))).toBe('Ирина')
  })

  it('greets a company by its contact person, and by nothing when there is none', () => {
    const company = { kind: 'company' as const, name: 'ТОО «Алатау Құрылыс Сервис»', contactName: 'Айдар Серіков' }
    expect(greetingName(company)).toBe('Айдар')
    expect(greetingName({ ...company, contactName: null })).toBeNull()
    expect(greetingName({ ...company, contactName: '  ' })).toBeNull()
  })
})

describe('shareMessage', () => {
  it('is "Здравствуйте, {имя}! Отправляю коммерческое предложение на {сумма}, действует до {дата}: {ссылка}"', () => {
    expect(shareMessage(quote()).replace(/\s/g, ' ')).toBe(
      'Здравствуйте, Қайрат! Отправляю коммерческое предложение на 323 930 ₸, действует до 03.11.2026: http://localhost:5173/p/tok123',
    )
  })

  it('leaves out the date of a quote with no validity, and the name of a client with none', () => {
    const text = shareMessage(quote({ validUntil: null, clientSnapshot: { ...person(), kind: 'company', name: 'ТОО «Алатау»', contactName: null } }))
    expect(text.replace(/\s/g, ' ')).toBe('Здравствуйте! Отправляю коммерческое предложение на 323 930 ₸: http://localhost:5173/p/tok123')
  })

  it('shows tiyn when the amount has them', () => {
    expect(shareMessage(quote({ grossTiyn: 174_176 })).replace(/\s/g, ' ')).toContain('на 1 741,76 ₸')
  })

  it('says "счёт на оплату" and by when to pay for an invoice (#28)', () => {
    const invoice = quote({ type: 'invoice', dueDate: '2026-11-04', validUntil: null })
    expect(shareMessage(invoice).replace(/\s/g, ' ')).toBe(
      'Здравствуйте, Қайрат! Отправляю счёт на оплату на сумму 323 930 ₸, оплатить до 04.11.2026: http://localhost:5173/p/tok123',
    )
    expect(shareMessage({ ...invoice, dueDate: null }).replace(/\s/g, ' ')).toBe(
      'Здравствуйте, Қайрат! Отправляю счёт на оплату на сумму 323 930 ₸: http://localhost:5173/p/tok123',
    )
  })

  it('never says the signature is legally binding', () => {
    expect(shareMessage(quote())).not.toMatch(/юридическ|ЭЦП|legally/i)
  })
})

describe('whatsappLink', () => {
  it('is wa.me with the digits of the phone and the encoded text', () => {
    const text = 'Здравствуйте, Қайрат! Сумма 1 000 ₸: http://x/p/a?b=1'
    const link = whatsappLink('+7 701 123 45 67', text)
    expect(link).toBe(`https://wa.me/77011234567?text=${encodeURIComponent(text)}`)
    expect(decodeURIComponent(link!.split('?text=')[1]!)).toBe(text)
  })

  it('takes the old way of writing the number (8 701 …) as the same phone', () => {
    expect(whatsappLink('8 701 123 45 67', 'x')).toBe('https://wa.me/77011234567?text=x')
  })

  it('is null for a client with no phone, or a phone WhatsApp cannot open', () => {
    expect(whatsappLink(null, 'x')).toBeNull()
    expect(whatsappLink('', 'x')).toBeNull()
    expect(whatsappLink('12345', 'x')).toBeNull()
  })
})

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('puts the text on the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyText('http://localhost:5173/p/tok123')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('http://localhost:5173/p/tok123')
  })
})
