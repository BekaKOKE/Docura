import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import { ApiError, type Document, type DocumentSummary } from '../../services'
import { activeActOf, draftErrors, draftOf, previewOf, sameDraft, serverErrors, updateInput, workDateField, type DraftValues } from './actRules'

// The rules behind the act's card (#31): pure functions, no screen.

const line = (id: string, workDate: string | null) => ({
  id,
  position: 0,
  articleId: null,
  kind: 'service' as const,
  title: `Работа ${id}`,
  unit: 'шт',
  qtyMilli: 2000,
  unitPriceTiyn: 1_200_000,
  netTiyn: 2_400_000,
  vatTiyn: 384_000,
  grossTiyn: 2_784_000,
  workDate,
})

const act = {
  id: 'a-1',
  clientId: 'k-1',
  version: 3,
  vatEnabled: true,
  contractRef: 'Договор № 15',
  periodFrom: '2026-10-15',
  periodTo: '2026-10-18',
  lines: [line('l-1', '2026-10-15'), line('l-2', null)],
} as unknown as Document

const valid: DraftValues = { contractRef: 'Договор № 15', periodFrom: '2026-10-15', periodTo: '2026-10-18', workDates: ['2026-10-15', '2026-10-16'] }

describe('draftOf and sameDraft', () => {
  it('reads the form values from the act, with an empty string for what is not set', () => {
    expect(draftOf(act)).toEqual({ contractRef: 'Договор № 15', periodFrom: '2026-10-15', periodTo: '2026-10-18', workDates: ['2026-10-15', ''] })
    expect(draftOf({ ...act, contractRef: null, periodFrom: null, periodTo: null })).toMatchObject({ contractRef: '', periodFrom: '', periodTo: '' })
  })

  it('tells an edit from no edit, ignoring spaces around the contract reference', () => {
    const values = draftOf(act)
    expect(sameDraft(values, { ...values, contractRef: '  Договор № 15 ' })).toBe(true)
    expect(sameDraft(values, { ...values, periodTo: '2026-10-19' })).toBe(false)
    expect(sameDraft(values, { ...values, workDates: ['2026-10-15', '2026-10-16'] })).toBe(false)
  })
})

describe('draftErrors: what "Выставить" needs', () => {
  it('has nothing to say about a complete draft', () => {
    expect(draftErrors(valid)).toEqual({})
    // The same day for both ends of the period is a one-day act.
    expect(draftErrors({ ...valid, periodFrom: '2026-10-15', periodTo: '2026-10-15' })).toEqual({})
  })

  it('asks for the period and for every work date', () => {
    const errors = draftErrors({ ...valid, periodFrom: '', periodTo: '', workDates: ['', '2026-10-16'] })
    expect(errors).toEqual({
      periodFrom: t('act.error.periodRequired'),
      periodTo: t('act.error.periodRequired'),
      [workDateField(0)]: t('act.error.workDateRequired'),
    })
  })

  it('refuses a period that ends before it starts, and a date that is not a day', () => {
    expect(draftErrors({ ...valid, periodFrom: '2026-10-18', periodTo: '2026-10-15' })).toEqual({ periodTo: t('act.error.periodOrder') })
    expect(draftErrors({ ...valid, periodFrom: '2026-02-30' })).toEqual({ periodFrom: t('document.error.dateInvalid') })
    expect(draftErrors({ ...valid, workDates: ['2026-10-15', '15.10.2026'] })).toEqual({ [workDateField(1)]: t('document.error.dateInvalid') })
  })

  it('limits the contract reference to 200 characters', () => {
    expect(draftErrors({ ...valid, contractRef: 'д'.repeat(200) })).toEqual({})
    expect(draftErrors({ ...valid, contractRef: 'д'.repeat(201) })).toEqual({ contractRef: t('act.error.contractRefTooLong') })
  })
})

describe('updateInput', () => {
  it("sends the act's own lines with the dates typed in, and the version it loaded", () => {
    const input = updateInput(act, { ...valid, contractRef: '  Договор № 16 ' })
    expect(input).toMatchObject({
      type: 'act',
      clientId: 'k-1',
      vatEnabled: true,
      version: 3,
      periodFrom: '2026-10-15',
      periodTo: '2026-10-18',
      contractRef: 'Договор № 16',
    })
    expect(input.lines.map((l) => [l.title, l.qtyMilli, l.unitPriceTiyn, l.workDate])).toEqual([
      ['Работа l-1', 2000, 1_200_000, '2026-10-15'],
      ['Работа l-2', 2000, 1_200_000, '2026-10-16'],
    ])
  })

  it('sends null for what is left empty', () => {
    const input = updateInput(act, { contractRef: ' ', periodFrom: '', periodTo: '', workDates: ['', ''] })
    expect(input).toMatchObject({ contractRef: null, periodFrom: null, periodTo: null })
    expect(input.lines.map((l) => l.workDate)).toEqual([null, null])
  })
})

describe('previewOf', () => {
  it('draws the saved act with the values typed in so far', () => {
    const preview = previewOf(act, { ...valid, contractRef: 'Договор № 99', periodTo: '' })
    expect(preview.contractRef).toBe('Договор № 99')
    expect(preview.periodTo).toBeNull()
    expect(preview.lines.map((l) => l.workDate)).toEqual(['2026-10-15', '2026-10-16'])
    // The saved act is not changed.
    expect(act.lines[1]!.workDate).toBeNull()
  })
})

describe('serverErrors', () => {
  it('maps the fields of a validation_error to the form fields', () => {
    const error = new ApiError({
      code: 'validation_error',
      message: 'Проверьте заполненные поля.',
      fields: { periodFrom: 'a', 'lines.1.workDate': 'b', contractRef: 'c', clientId: 'not a field of the form' },
    })
    expect(serverErrors(error)).toEqual({ periodFrom: 'a', [workDateField(1)]: 'b', contractRef: 'c' })
  })

  it('has nothing for any other error, or for fields the form does not have', () => {
    expect(serverErrors(new ApiError({ code: 'version_conflict', message: 'x' }))).toBeNull()
    expect(serverErrors(new ApiError({ code: 'validation_error', message: 'x', fields: { type: 'y' } }))).toBeNull()
    expect(serverErrors(new Error('boom'))).toBeNull()
  })
})

describe('activeActOf: the act that "Создать акт" opens', () => {
  const child = (id: string, type: DocumentSummary['type'], status: DocumentSummary['status']) => ({ id, type, status }) as DocumentSummary

  it('is the first act that is not cancelled', () => {
    const children = [child('i-1', 'invoice', 'issued'), child('a-1', 'act', 'cancelled'), child('a-2', 'act', 'draft')]
    expect(activeActOf({ children })?.id).toBe('a-2')
  })

  it('is nothing when the quote has no act, or only a cancelled one', () => {
    expect(activeActOf({ children: [] })).toBeUndefined()
    expect(activeActOf({ children: [child('i-1', 'invoice', 'issued'), child('a-1', 'act', 'cancelled')] })).toBeUndefined()
  })
})
