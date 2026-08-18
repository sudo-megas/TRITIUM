// i18next, wired with no detector of any kind.
// XTRITIUM §3.6 — English on first launch, Turkish by manual switch, nothing
// read from the OS. audit-locale fails the build if a detector ever appears.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { APP_NAME } from '../../shared/app-meta.js'
import { DEFAULT_SETTINGS, isLanguage, type Language } from '../../shared/settings.js'
import en from './en.json'
import tr from './tr.json'

// The stored language, handed over by the preload, is in place before the first
// render — the shell never shows English on its way to Turkish.
const stored = window.tritium?.initialSettings?.language
const startLanguage: Language = isLanguage(stored) ? stored : DEFAULT_SETTINGS.language

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr }
  },
  lng: startLanguage,
  fallbackLng: DEFAULT_SETTINGS.language,
  interpolation: { escapeValue: false },
  returnNull: false
})

export function applyLanguage(language: Language): void {
  void i18n.changeLanguage(language)
}

/** The heading each form window already shows, reused as the window's name. */
const WINDOW_TITLES: Record<string, string> = {
  vehicle: 'vehicles.addTitle',
  currency: 'currency.title',
  'fuel-quick': 'fuel.quickTitle',
  fuel: 'fuel.addTitle',
  cost: 'costs.addTitle'
}

/**
 * Name the window after what it is.
 *
 * Every window used to be called TRITIUM and nothing else — the shell and all
 * four kinds of form. That is not merely untidy on the maker's desktop: a
 * tiling compositor can only match a window rule on the application id and the
 * title, so a rule written for the shell silently caught every form window too,
 * and the window switcher offered five identical entries.
 *
 * The prefix stays fixed so a rule can match it; what follows names the form and
 * follows the language, like everything else the maker reads. Called from
 * applyToDocument, so it is right on the first frame and right again after a
 * language switch.
 */
export function applyWindowTitle(): void {
  const kind = window.tritium?.formRequest?.kind
  const key = kind === undefined ? undefined : WINDOW_TITLES[kind]
  document.title = key === undefined ? APP_NAME : `${APP_NAME} — ${i18n.t(key)}`
}

export default i18n
