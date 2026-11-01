// What the act's card knows about an act draft (#31): the values the form holds, the checks before "Выставить", the
// request that saves them and the document the live preview draws. Pure functions, no React and no services, so
// the rules can be tested without a screen. The checks are the ones the mock `documents.issue` makes (the backend
// makes the same), so a refusal on the screen and a refusal from the service say the same thing.

import { isIsoDate } from '../../domain/dates'
import { t } from '../../i18n/t'
import { isApiError, type Document, type DocumentLineInput, type DocumentSummary, type DocumentUpdateInput } from '../../services'

/** What the form of a draft holds. Dates are `YYYY-MM-DD` as a date field gives them, or '' when empty. */
export interface DraftValues {
  contractRef: string
  periodFrom: string
  periodTo: string
  /** One per line of the act, in the order of the lines. */
  workDates: string[]
}

/** Message per field: `contractRef`, `periodFrom`, `periodTo` and `workDate.<index>`. */
export type DraftErrors = Partial<Record<string, string>>

export const workDateField = (index: number) => `workDate.${index}`

export function draftOf(act: Pick<Document, 'contractRef' | 'periodFrom' | 'periodTo' | 'lines'>): DraftValues {
  return {
    contractRef: act.contractRef ?? '',
    periodFrom: act.periodFrom ?? '',
    periodTo: act.periodTo ?? '',
    workDates: act.lines.map((line) => line.workDate ?? ''),
  }
}

export function sameDraft(a: DraftValues, b: DraftValues): boolean {
  return (
    a.contractRef.trim() === b.contractRef.trim() &&
    a.periodFrom === b.periodFrom &&
    a.periodTo === b.periodTo &&
    a.workDates.length === b.workDates.length &&
    a.workDates.every((date, index) => date === b.workDates[index])
  )
}

/** What is wrong with the values before the act can be issued; empty when nothing is. */
export function draftErrors(values: DraftValues): DraftErrors {
  const errors: DraftErrors = {}
  const bad = (date: string) => date !== '' && !isIsoDate(date)
  if (values.periodFrom === '') errors.periodFrom = t('act.error.periodRequired')
  else if (bad(values.periodFrom)) errors.periodFrom = t('document.error.dateInvalid')
  if (values.periodTo === '') errors.periodTo = t('act.error.periodRequired')
  else if (bad(values.periodTo)) errors.periodTo = t('document.error.dateInvalid')
  if (!errors.periodFrom && !errors.periodTo && values.periodTo < values.periodFrom) {
    errors.periodTo = t('act.error.periodOrder')
  }
  if (values.contractRef.trim().length > 200) errors.contractRef = t('act.error.contractRefTooLong')
  values.workDates.forEach((date, index) => {
    if (date === '') errors[workDateField(index)] = t('act.error.workDateRequired')
    else if (bad(date)) errors[workDateField(index)] = t('document.error.dateInvalid')
  })
  return errors
}

/** The save request: the act's own lines with the dates typed in. The quote's lines are not changed by it. */
export function updateInput(act: Document, values: DraftValues): DocumentUpdateInput {
  const lines: DocumentLineInput[] = act.lines.map((line, index) => ({
    articleId: line.articleId,
    kind: line.kind,
    title: line.title,
    description: line.description,
    unit: line.unit,
    qtyMilli: line.qtyMilli,
    unitPriceTiyn: line.unitPriceTiyn,
    discountBp: line.discountBp,
    workDate: values.workDates[index] || null,
  }))
  return {
    type: 'act',
    clientId: act.clientId,
    vatEnabled: act.vatEnabled,
    periodFrom: values.periodFrom || null,
    periodTo: values.periodTo || null,
    contractRef: values.contractRef.trim() || null,
    lines,
    version: act.version,
  }
}

/** The act as the live preview draws it: the saved act with the values typed in so far. */
export function previewOf(act: Document, values: DraftValues): Document {
  return {
    ...act,
    contractRef: values.contractRef.trim() || null,
    periodFrom: values.periodFrom || null,
    periodTo: values.periodTo || null,
    lines: act.lines.map((line, index) => ({ ...line, workDate: values.workDates[index] || null })),
  }
}

/** The messages a `validation_error` carries, by the field names of the form (`lines.2.workDate` is `workDate.2`). */
export function serverErrors(error: unknown): DraftErrors | null {
  if (!isApiError(error) || error.code !== 'validation_error' || !error.fields) return null
  const errors: DraftErrors = {}
  for (const [field, message] of Object.entries(error.fields)) {
    const line = /^lines\.(\d+)\.workDate$/.exec(field)
    if (line) errors[workDateField(Number(line[1]))] = message
    else if (field === 'periodFrom' || field === 'periodTo' || field === 'contractRef') errors[field] = message
  }
  return Object.keys(errors).length > 0 ? errors : null
}

/** The act already made from a quote, if any: the one that "Создать акт" opens instead of making a second. */
export function activeActOf(quote: Pick<Document, 'children'>): DocumentSummary | undefined {
  return quote.children.find((child) => child.type === 'act' && child.status !== 'cancelled')
}
