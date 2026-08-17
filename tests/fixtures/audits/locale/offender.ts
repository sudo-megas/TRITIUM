// Fixture: audit-locale must reject this file. Never imported by the app.
export function guessLanguage(): string {
  return navigator.language
}

export function formatToday(date: Date): string {
  return new Intl.DateTimeFormat().format(date)
}
