import { formatQty } from '../../documents/format'
import { t } from '../../i18n/t'
import type { Document } from '../../services'
import { TextField } from '../fields'
import { workDateField, type DraftErrors, type DraftValues } from './actRules'

interface Props {
  act: Document
  values: DraftValues
  errors: DraftErrors
  disabled: boolean
  onChange: (values: DraftValues) => void
}

/**
 * The part of an act draft the owner may change (S18): the contract reference, the reporting period and the date each
 * work was done. The lines themselves come from the quote and are shown, not edited.
 */
export function ActDraftForm({ act, values, errors, disabled, onChange }: Props) {
  const setWorkDate = (index: number, date: string) =>
    onChange({ ...values, workDates: values.workDates.map((current, i) => (i === index ? date : current)) })
  return (
    <section className="card act-form" aria-labelledby="act-form-title">
      <h2 id="act-form-title" className="act-label">
        {t('act.form.title')}
      </h2>
      <fieldset className="act-fields" disabled={disabled}>
        <TextField
          id="act-contract-ref"
          label={t('act.form.contractRef')}
          hint={t('act.form.contractRef.hint')}
          optional
          autoComplete="off"
          value={values.contractRef}
          error={errors.contractRef}
          onChange={(contractRef) => onChange({ ...values, contractRef })}
        />
        <TextField
          id="act-period-from"
          type="date"
          label={t('act.form.periodFrom')}
          value={values.periodFrom}
          error={errors.periodFrom}
          onChange={(periodFrom) => onChange({ ...values, periodFrom })}
        />
        <TextField
          id="act-period-to"
          type="date"
          label={t('act.form.periodTo')}
          value={values.periodTo}
          error={errors.periodTo}
          onChange={(periodTo) => onChange({ ...values, periodTo })}
        />
      </fieldset>

      <h3 className="act-label">{t('act.form.lines')}</h3>
      <ul className="act-lines">
        {act.lines.map((line, index) => (
          <li key={line.id}>
            <fieldset className="act-line" disabled={disabled}>
              <legend className="act-line-title">{line.title}</legend>
              <span className="act-line-qty">
                {formatQty(line.qtyMilli)} {line.unit}
              </span>
              <TextField
                id={`act-work-date-${index}`}
                type="date"
                label={t('act.form.workDate')}
                value={values.workDates[index] ?? ''}
                error={errors[workDateField(index)]}
                onChange={(date) => setWorkDate(index, date)}
              />
            </fieldset>
          </li>
        ))}
      </ul>
    </section>
  )
}
