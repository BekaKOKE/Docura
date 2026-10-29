import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { ARTICLE_UNITS, parsePriceInput } from '../../domain/article'
import { formatMoney, type LineTotals } from '../../domain'
import { formatQty } from '../../documents/format'
import { t } from '../../i18n/t'
import { BottomSheet } from '../../shell/BottomSheet'
import { FieldFrame, SegmentedField } from '../fields'
import { Money } from '../clients/parts'
import { parseQty, stepQty, type DraftLine, type FieldKey, type LineProblems } from './draft'
import { plainAmount } from './TotalsBar'
import './pickers.css'

export interface LineCardProps {
  /** 1-based position, for the spoken name of the line. */
  n: number
  line: DraftLine
  /** Null while the quantity or the price is not a number yet. */
  totals: LineTotals | null
  vatEnabled: boolean
  expanded: boolean
  /** A signed quote: the line is text, not a button. */
  readOnly: boolean
  /** Only the mistakes the person has already been told about (on blur or on save). */
  problems: LineProblems
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: () => void
  onChange: (patch: Partial<DraftLine>) => void
  onBlur: (field: FieldKey) => void
  onMove: (step: -1 | 1) => void
  onRemove: () => void
}

/** The id of a field of a line; the screen focuses a field by it. */
export const lineFieldId = (key: string, field: FieldKey | 'toggle') => `${key}-${field}`

function UnitSheet({ unit, onPick, onClose }: { unit: string; onPick: (unit: string) => void; onClose: () => void }) {
  return (
    <BottomSheet open title={t('qe.unit.sheet')} onClose={onClose}>
      <div className="pk-body">
        <ul className="card pk-list">
          {ARTICLE_UNITS.map((option) => (
            <li key={option}>
              <button type="button" className="pk-row" data-with-price="" aria-pressed={option === unit} onClick={() => onPick(option)}>
                <span className="pk-row-text">
                  <span className="pk-row-title">{option}</span>
                </span>
                {option === unit && <Check aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  )
}

export function LineCard({
  n,
  line,
  totals,
  vatEnabled,
  expanded,
  readOnly,
  problems,
  canMoveUp,
  canMoveDown,
  onToggle,
  onChange,
  onBlur,
  onMove,
  onRemove,
}: LineCardProps) {
  const [unitOpen, setUnitOpen] = useState(false)

  const qty = parseQty(line.qty)
  const price = parsePriceInput(line.price)
  const title = line.title.trim() === '' ? t('qe.line.untitled') : line.title
  const hasProblems = Object.keys(problems).length > 0
  const ariaLabel = totals
    ? t('qe.line.aria', { n, title, amount: plainAmount(totals.netTiyn) })
    : t('qe.line.ariaNoAmount', { n, title })

  const summary = (
    <>
      <span className="qe-line-title">{title}</span>
      <span className="qe-line-total">{totals && <Money tiyn={totals.netTiyn} />}</span>
      <span className="qe-line-meta">
        {t('qe.line.times', {
          qty: qty.ok ? formatQty(qty.milli) : line.qty,
          unit: line.unit,
          price: price.ok ? formatMoney(price.tiyn) : line.price,
        })}
      </span>
      <span className="qe-line-vat">
        {vatEnabled && totals && <span className="dc-money">{t('qe.line.vat', { amount: formatMoney(totals.vatTiyn) })}</span>}
      </span>
      {hasProblems && <span className="qe-line-bad">{t('qe.line.error')}</span>}
    </>
  )

  const error = (field: FieldKey) => {
    const key = problems[field]
    return key ? t(key) : null
  }
  const bodyId = `${line.key}-body`

  return (
    <li className="qe-line card" data-open={expanded || undefined} data-invalid={hasProblems || undefined}>
      {readOnly ? (
        <div className="qe-line-head" aria-label={ariaLabel} role="group">
          {summary}
        </div>
      ) : (
        <button
          type="button"
          id={lineFieldId(line.key, 'toggle')}
          className="qe-line-head"
          aria-expanded={expanded}
          aria-controls={expanded ? bodyId : undefined}
          aria-label={ariaLabel}
          onClick={onToggle}
        >
          {summary}
          {expanded ? <ChevronUp aria-hidden="true" className="qe-line-chevron" /> : <ChevronDown aria-hidden="true" className="qe-line-chevron" />}
        </button>
      )}

      {expanded && !readOnly && (
        <div id={bodyId} className="qe-line-body">
          <FieldFrame id={lineFieldId(line.key, 'title')} label={t('qe.line.title')} error={error('title')}>
            {(describedBy) => (
              <textarea
                id={lineFieldId(line.key, 'title')}
                name={lineFieldId(line.key, 'title')}
                className="input qe-textarea"
                rows={2}
                value={line.title}
                aria-invalid={problems.title ? 'true' : undefined}
                aria-describedby={describedBy}
                onChange={(event) => onChange({ title: event.target.value })}
                onBlur={() => onBlur('title')}
              />
            )}
          </FieldFrame>

          <div className="qe-kind">
            <SegmentedField
              id={`${line.key}-kind`}
              label={t('qe.line.kind')}
              value={line.kind}
              options={[
                { value: 'service', label: t('catalog.kind.service') },
                { value: 'material', label: t('catalog.kind.material') },
              ]}
              onChange={(kind) => onChange({ kind })}
            />
          </div>

          <FieldFrame id={lineFieldId(line.key, 'qty')} label={t('qe.line.qty')} error={error('qty')}>
            {(describedBy) => (
              <div className="qe-qty">
                <button type="button" className="icon-btn" aria-label={t('qe.line.qty.less')} onClick={() => onChange({ qty: stepQty(line.qty, -1) })}>
                  <Minus aria-hidden="true" />
                </button>
                <input
                  id={lineFieldId(line.key, 'qty')}
                  name={lineFieldId(line.key, 'qty')}
                  className="input qe-qty-input"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  value={line.qty}
                  aria-invalid={problems.qty ? 'true' : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => onChange({ qty: event.target.value })}
                  onBlur={() => onBlur('qty')}
                />
                <button type="button" className="icon-btn" aria-label={t('qe.line.qty.more')} onClick={() => onChange({ qty: stepQty(line.qty, 1) })}>
                  <Plus aria-hidden="true" />
                </button>
              </div>
            )}
          </FieldFrame>

          <div className="field">
            <span className="field-label">{t('qe.line.unit')}</span>
            <button
              type="button"
              className="qe-unit"
              aria-haspopup="dialog"
              aria-label={t('qe.line.unit.change', { unit: line.unit })}
              onClick={() => setUnitOpen(true)}
            >
              <span className="qe-unit-value">{line.unit}</span>
              <ChevronDown aria-hidden="true" />
            </button>
          </div>

          <FieldFrame id={lineFieldId(line.key, 'price')} label={t('qe.line.price')} error={error('price')}>
            {(describedBy) => (
              <MoneyInput
                id={lineFieldId(line.key, 'price')}
                name={lineFieldId(line.key, 'price')}
                value={line.price}
                invalid={Boolean(problems.price)}
                describedBy={describedBy}
                onChange={(next) => onChange({ price: next })}
                onBlur={() => onBlur('price')}
              />
            )}
          </FieldFrame>

          {line.articleId === null ? (
            <label className="qe-check" htmlFor={`${line.key}-catalog`}>
              <input
                id={`${line.key}-catalog`}
                type="checkbox"
                checked={line.saveToCatalog}
                onChange={(event) => onChange({ saveToCatalog: event.target.checked })}
              />
              <span>{t('qe.line.saveToCatalog')}</span>
            </label>
          ) : (
            <p className="qe-line-catalog muted">{t('qe.line.inCatalog')}</p>
          )}

          <div className="qe-line-moves">
            <button type="button" className="icon-btn" aria-label={t('qe.line.moveUp')} disabled={!canMoveUp} onClick={() => onMove(-1)}>
              <ArrowUp aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" aria-label={t('qe.line.moveDown')} disabled={!canMoveDown} onClick={() => onMove(1)}>
              <ArrowDown aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-block qe-remove" onClick={onRemove}>
            <Trash2 aria-hidden="true" />
            <span className="dc-label">{t('qe.line.remove')}</span>
          </button>
        </div>
      )}

      {unitOpen && (
        <UnitSheet
          unit={line.unit}
          onClose={() => setUnitOpen(false)}
          onPick={(unit) => {
            onChange({ unit })
            setUnitOpen(false)
          }}
        />
      )}
    </li>
  )
}
