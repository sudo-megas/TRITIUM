// The one question TRITIUM asks (XTRITIUM §8):
//
//   "Currency is asked ONCE at first launch and then fixed forever.
//    No exchange rates, no conversion, ever."
//
// It is asked because settings.toml has no `currency` key — not because the
// data directory is new. A file written before the key existed is still owed
// the question, exactly once.
//
// Nothing is detected. §3.6 forbids reading a locale, and a currency guessed
// from the machine would be the same mistake as a language guessed from it.

import { useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { currencySymbol } from '../../shared/format.js'
import { useSettings } from '../state/settings.js'

/** Offered because they are the likely answers, not because they are the only ones. */
const OFFERED = ['TRY', 'USD', 'EUR', 'GBP'] as const

export function CurrencyAsk(): JSX.Element {
  const { t } = useTranslation()
  const setCurrency = useSettings((s) => s.setCurrency)
  const [choice, setChoice] = useState<string>(OFFERED[0])
  const [other, setOther] = useState('')

  const custom = choice === 'other'
  const answer = (custom ? other : choice).trim().toUpperCase()

  function confirm(): void {
    if (answer.length === 0) return
    setCurrency(answer)
    void window.tritium.closeForm()
  }

  return (
    <div className="form form--ask">
      <h1 className="form__title">{t('currency.title')}</h1>
      <p className="form__note">{t('currency.note')}</p>

      <label className="field">
        <span className="field__label">{t('currency.label')}</span>
        <select
          className="control"
          data-testid="currency-select"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          {OFFERED.map((code) => (
            <option key={code} value={code}>
              {`${code} ${currencySymbol(code)}`}
            </option>
          ))}
          <option value="other">{t('currency.other')}</option>
        </select>
      </label>

      {custom && (
        <label className="field">
          <span className="field__label">{t('currency.code')}</span>
          <input
            className="control"
            type="text"
            maxLength={8}
            data-testid="currency-other"
            value={other}
            onChange={(event) => setOther(event.target.value)}
          />
        </label>
      )}

      <div className="form__actions">
        <button
          type="button"
          className="button button--primary"
          data-testid="currency-confirm"
          disabled={answer.length === 0}
          onClick={confirm}
        >
          {t('currency.confirm')}
        </button>
      </div>
    </div>
  )
}
