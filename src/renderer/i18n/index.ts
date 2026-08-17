// i18next, wired with no detector of any kind.
// XTRITIUM §3.6 — English on first launch, Turkish by manual switch, nothing
// read from the OS. audit-locale fails the build if a detector ever appears.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
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

export default i18n
