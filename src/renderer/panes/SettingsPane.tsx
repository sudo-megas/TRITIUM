// Settings (XTRITIUM §4.4, §8) — language, units, precision, the payment-method
// list, and the eleven palettes.
//
// F1 built language and palette. F11 adds everything else §4.4's schema has
// held since F2, and settles what four earlier milestones deferred here by name.
//
// The currency is SHOWN AND NOT EDITABLE. §4.4 — "asked ONCE at first launch,
// then fixed forever". Hiding it would leave the maker wondering where it lives;
// offering it would be offering something the constitution forbids.

import { useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CONSUMPTION_UNITS,
  DISTANCE_UNITS,
  LANGUAGES,
  PALETTES,
  VOLUME_UNITS,
  isConsumptionUnit,
  isDistanceUnit,
  isLanguage,
  isPalette,
  isVolumeUnit
} from '../../shared/settings.js'
import { categorySlug } from '../../shared/slug.js'
import {
  CONSUMPTION_SYMBOL,
  DISTANCE_SYMBOL,
  LITRES_PER_US_GALLON,
  VOLUME_SYMBOL
} from '../../shared/units.js'
import { useSettings } from '../state/settings.js'

// Endonyms: a language is named in its own language, in both catalogues.
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', tr: 'Türkçe' }

/** 0–6, which is the range `readDecimals` already accepts. */
const DECIMALS = [0, 1, 2, 3, 4, 5, 6]

export function SettingsPane(): JSX.Element {
  const { t } = useTranslation()
  const settings = useSettings()
  const [method, setMethod] = useState('')

  const addMethod = (): void => {
    const slug = categorySlug(method)
    if (slug.length === 0 || settings.payment_methods.includes(slug)) return
    settings.setPaymentMethods([...settings.payment_methods, slug])
    setMethod('')
  }

  const removeMethod = (value: string): void => {
    settings.setPaymentMethods(settings.payment_methods.filter((entry) => entry !== value))
  }

  return (
    <div className="panes">
      <section className="pane">
        <h2 className="section__title">{t('settings.title')}</h2>

        <Field label={t('settings.language')} id="language">
          <select
            className="control"
            aria-labelledby="label-language"
            data-testid="language-select"
            value={settings.language}
            onChange={(event) => {
              if (isLanguage(event.target.value)) settings.setLanguage(event.target.value)
            }}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </Field>

        {/* §4.4 — asked once, then fixed forever. Shown, never offered. */}
        <Field label={t('settings.currency')} id="currency">
          <input
            className="control"
            type="text"
            readOnly
            disabled
            aria-labelledby="label-currency"
            data-testid="currency-value"
            value={settings.currency ?? ''}
          />
          <span className="field__hint">{t('settings.currencyFixed')}</span>
        </Field>

        <h2 className="section__title">{t('settings.units')}</h2>
        <p className="field__hint">{t('settings.unitsHint')}</p>

        {/* §8 — each unit is independent of the others AND of the language.
            `mi` with `l` describes a real car, not a mistake. */}
        <Field label={t('settings.distance')} id="distance">
          <select
            className="control"
            aria-labelledby="label-distance"
            data-testid="distance-select"
            value={settings.distance}
            onChange={(event) => {
              if (isDistanceUnit(event.target.value)) settings.setDistance(event.target.value)
            }}
          >
            {DISTANCE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {DISTANCE_SYMBOL[unit]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('settings.volume')} id="volume">
          <select
            className="control"
            aria-labelledby="label-volume"
            data-testid="volume-select"
            value={settings.volume}
            onChange={(event) => {
              if (isVolumeUnit(event.target.value)) settings.setVolume(event.target.value)
            }}
          >
            {VOLUME_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {VOLUME_SYMBOL[unit]}
              </option>
            ))}
          </select>
          {/* There are two gallons and they differ by twenty per cent. The page
              says which one this is rather than leaving the maker to work it
              out from a figure that looks wrong (F11.md decision 3). */}
          <span className="field__hint" data-testid="gallon-note">
            {t('settings.gallonNote', { litres: LITRES_PER_US_GALLON.toString() })}
          </span>
        </Field>

        <Field label={t('settings.consumption')} id="consumption">
          <select
            className="control"
            aria-labelledby="label-consumption"
            data-testid="consumption-select"
            value={settings.consumption}
            onChange={(event) => {
              if (isConsumptionUnit(event.target.value)) settings.setConsumption(event.target.value)
            }}
          >
            {CONSUMPTION_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {CONSUMPTION_SYMBOL[unit]}
              </option>
            ))}
          </select>
        </Field>

        <h2 className="section__title">{t('settings.precision')}</h2>
        <p className="field__hint">{t('settings.precisionHint')}</p>

        <Field label={t('settings.decimalsConsumption')} id="decimals-consumption">
          <select
            className="control"
            aria-labelledby="label-decimals-consumption"
            data-testid="decimals-consumption-select"
            value={settings.decimals_consumption}
            onChange={(event) => settings.setDecimalsConsumption(Number(event.target.value))}
          >
            {DECIMALS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('settings.decimalsCostPerKm')} id="decimals-cost">
          <select
            className="control"
            aria-labelledby="label-decimals-cost"
            data-testid="decimals-cost-select"
            value={settings.decimals_cost_per_km}
            onChange={(event) => settings.setDecimalsCostPerKm(Number(event.target.value))}
          >
            {DECIMALS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </Field>

        <h2 className="section__title">{t('settings.paymentMethods')}</h2>
        {/* §4.4 calls it an editable list; F5 shipped it fixed and said F11
            would make it so. Removing one never touches a record that uses it. */}
        <p className="field__hint">{t('settings.paymentMethodsHint')}</p>

        <ul className="methods" data-testid="payment-methods">
          {settings.payment_methods.map((value) => (
            <li className="methods__row" key={value} data-testid={`method-${value}`}>
              <span className="methods__name">
                {t(`costs.methods.${value}`, { defaultValue: value })}
              </span>
              <button
                type="button"
                className="button"
                data-testid={`method-remove-${value}`}
                onClick={() => removeMethod(value)}
              >
                {t('settings.remove')}
              </button>
            </li>
          ))}
        </ul>

        <div className="field field--inline">
          <input
            className="control"
            type="text"
            aria-label={t('settings.addMethod')}
            data-testid="method-input"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          />
          <button
            type="button"
            className="button"
            data-testid="method-add"
            onClick={addMethod}
          >
            {t('settings.addMethod')}
          </button>
        </div>
      </section>

      <section className="pane">
        <h2 className="section__title">{t('settings.palette')}</h2>

        <Field label={t('settings.palette')} id="palette">
          <select
            className="control"
            aria-labelledby="label-palette"
            data-testid="palette-select"
            value={settings.palette}
            onChange={(event) => {
              if (isPalette(event.target.value)) settings.setPalette(event.target.value)
            }}
          >
            {PALETTES.map((id) => (
              <option key={id} value={id}>
                {t(`palettes.${id}`)}
              </option>
            ))}
          </select>
        </Field>

        <p className="field__hint">{t('settings.paletteHint')}</p>

        {/*
         * Each swatch carries its own data-palette, and palettes.css selects on
         * that attribute rather than on the root alone — so the tokens inside a
         * swatch resolve to the palette it stands for, not the one in force.
         * That makes every swatch a small picture of the application under that
         * palette: bar, accent rule, ground, and two lines of text. All eleven
         * can be compared without switching to any of them.
         */}
        <div className="swatches">
          {PALETTES.map((id) => (
            <button
              type="button"
              key={id}
              className="swatch"
              data-palette={id}
              data-testid={`swatch-${id}`}
              aria-pressed={id === settings.palette}
              aria-label={t(`palettes.${id}`)}
              onClick={() => settings.setPalette(id)}
            >
              <span className="swatch__bar" />
              <span className="swatch__body">
                <span className="swatch__line" />
                <span className="swatch__line swatch__line--short" />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  id,
  children
}: {
  label: string
  id: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="field">
      <span className="field__label" id={`label-${id}`}>
        {label}
      </span>
      {children}
    </div>
  )
}
