// Settings — the F1 working subset: language and palette, both instant, both
// persisted to settings.toml through the atomic write helper.
// Units, precision and currency arrive at F11 / F3.

import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, PALETTES, isLanguage, isPalette } from '../../shared/settings.js'
import { useSettings } from '../state/settings.js'

// Endonyms: a language is named in its own language, in both catalogues.
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', tr: 'Türkçe' }

export function SettingsPane(): JSX.Element {
  const { t } = useTranslation()
  const language = useSettings((s) => s.language)
  const palette = useSettings((s) => s.palette)
  const setLanguage = useSettings((s) => s.setLanguage)
  const setPalette = useSettings((s) => s.setPalette)

  return (
    <div className="panes">
      <section className="pane">
        <h2 className="section__title">{t('settings.title')}</h2>

        <div className="field">
          <span className="field__label" id="label-language">
            {t('settings.language')}
          </span>
          <select
            className="control"
            aria-labelledby="label-language"
            data-testid="language-select"
            value={language}
            onChange={(event) => {
              if (isLanguage(event.target.value)) setLanguage(event.target.value)
            }}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </div>

      </section>

      <section className="pane">
        <h2 className="section__title">{t('settings.palette')}</h2>

        <div className="field">
          <span className="field__label" id="label-palette">
            {t('settings.palette')}
          </span>
          <select
            className="control"
            aria-labelledby="label-palette"
            data-testid="palette-select"
            value={palette}
            onChange={(event) => {
              if (isPalette(event.target.value)) setPalette(event.target.value)
            }}
          >
            {PALETTES.map((id) => (
              <option key={id} value={id}>
                {t(`palettes.${id}`)}
              </option>
            ))}
          </select>
        </div>

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
              aria-pressed={id === palette}
              aria-label={t(`palettes.${id}`)}
              onClick={() => setPalette(id)}
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
