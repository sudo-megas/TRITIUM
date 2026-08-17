// About — finished in F1; only the version number changes afterwards.
// XTRITIUM §10: the mark, the maker, version, release date, source address and
// the full licence text.
// XTRITIUM §3.5: every address is selectable text. There is no <a> here, and
// nothing in this file can open a browser.

import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import licenceText from '../../../LICENSE?raw'
import {
  APP_NAME,
  APP_VERSION,
  LICENCE_ID,
  MAKER,
  RELEASE_DATE,
  SOURCE_ADDRESS
} from '../../shared/app-meta.js'

export function AboutPane(): JSX.Element {
  const { t } = useTranslation()

  const rows: Array<[string, string]> = [
    [t('about.maker'), MAKER],
    [t('about.version'), `v${APP_VERSION}`],
    [t('about.released'), RELEASE_DATE],
    [t('about.source'), SOURCE_ADDRESS],
    [t('about.licence'), LICENCE_ID]
  ]

  return (
    <div className="panes">
      <section className="pane">
        <p className="about__mark">{APP_NAME}</p>
        <p className="about__sub">{t('app.subtitle')}</p>

        <div className="about__rows">
          {rows.map(([key, value]) => (
            <div className="about__row" key={key} style={{ display: 'contents' }}>
              <span className="about__key">{key}</span>
              <span className="about__value" data-testid={`about-${key}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="pane">
        <h2 className="section__title">{t('about.licenceTitle')}</h2>
        <pre className="licence" data-testid="licence-text">
          {licenceText}
        </pre>
      </section>
    </div>
  )
}
