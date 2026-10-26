import { useEffect } from 'react'
import { t } from '../i18n/t'
import './check.css'

// How Docura formats money everywhere: Intl, with a no-break space between the digit groups and before ₸.
const tenge = new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', minimumFractionDigits: 0 })

// A service page, not an MVP screen: it shows what has to render right at 360 px (the ₸ sign, Kazakh letters,
// amounts and document numbers on one line, a long button label) so it can be checked by eye and in DevTools.
export function DesignCheck() {
  useEffect(() => {
    document.title = t('app.pageTitle', { title: t('check.title') })
  }, [])

  return (
    <div className="page" data-screen="check">
      <h1>{t('check.title')}</h1>
      <p className="muted">{t('check.lead')}</p>

      <section className="group" aria-labelledby="check-glyphs">
        <h2 id="check-glyphs">{t('check.glyphs')}</h2>
        <div className="card">
          <div className="card-body">
            <div className="fact">
              <span className="fact-label">{t('check.tenge')}</span>
              <span className="check-glyphs" data-sample="tenge">{t('check.tengeSample')}</span>
            </div>
            <div className="fact">
              <span className="fact-label">{t('check.kazakh')}</span>
              <span className="check-glyphs" data-sample="kazakh">{t('check.kazakhSample')}</span>
            </div>
            <div className="fact">
              <span className="fact-label">{t('check.yoNumero')}</span>
              <span className="check-glyphs" data-sample="yo-numero">{t('check.yoNumeroSample')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="group" aria-labelledby="check-names">
        <h2 id="check-names">{t('check.names')}</h2>
        <div className="card">
          <div className="card-body">
            <span data-sample="name-kazakh">{t('check.nameKazakh')}</span>
            <span data-sample="name-yo">{t('check.nameYo')}</span>
            <span data-sample="name-company">{t('check.nameCompany')}</span>
          </div>
        </div>
      </section>

      <section className="group" aria-labelledby="check-numbers">
        <h2 id="check-numbers">{t('check.numbers')}</h2>
        <div className="card">
          <div className="check-row">
            <span className="check-row-title" data-sample="row-name">{t('check.nameCompany')}</span>
            <span className="dc-money check-row-amount" data-sample="money">{tenge.format(1874300)}</span>
            <span className="dc-code" data-sample="code">{t('check.documentNumber')}</span>
          </div>
        </div>
      </section>

      <section className="group" aria-labelledby="check-buttons">
        <h2 id="check-buttons">{t('check.buttons')}</h2>
        <button type="button" className="btn btn-primary btn-block">
          <span className="dc-label">{t('check.buttonLong')}</span>
        </button>
        <button type="button" className="btn btn-secondary btn-block">
          <span className="dc-label">{t('check.buttonWrap')}</span>
        </button>
        <div className="check-pair">
          <button type="button" className="btn btn-secondary">
            <span className="dc-label">{t('check.buttonPair1')}</span>
          </button>
          <button type="button" className="btn btn-primary">
            <span className="dc-label">{t('check.buttonPair2')}</span>
          </button>
        </div>
      </section>
    </div>
  )
}
