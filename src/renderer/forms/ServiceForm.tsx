// The service form (XTRITIUM §6.2 — Periyodik Bakım's shape), in a window of
// its own (§5.1: movable, non-anchored).
//
// Five fields, which is §4.4's service.toml entire. Nothing here computes
// anything and nothing here watches anything: §3.3 forbids intervals, due dates
// and reminders, and this is the form most tempted by all three.
//
// It is also the edit path (§3.8), as the fuel and cost forms are.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { highestOdometer } from '../../shared/entries.js'
import { parseDate, parseInput } from '../../shared/format.js'
import type { VehicleBundle } from '../../shared/records.js'
import { MONEY_DECIMALS } from '../../shared/scaled.js'
import { useSettings } from '../state/settings.js'
import { useUnits } from '../state/units.js'
import {
  emptyServiceDraft,
  serviceDraftOf,
  serviceEntryOf,
  serviceGoesBackwards,
  type ServiceDraft
} from '../../shared/service-draft.js'

export function ServiceForm({ slug, entry }: { slug: string; entry?: string }): JSX.Element {
  const { t } = useTranslation()
  const units = useUnits()
  const prefs = { distance: useSettings((s) => s.distance), volume: useSettings((s) => s.volume) }
  const [draft, setDraft] = useState<ServiceDraft>(() => emptyServiceDraft())
  const [previous, setPrevious] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (slug.length === 0) return

    void (async () => {
      try {
        const bundle = (await window.tritium.loadVehicle(slug)) as VehicleBundle

        // The hint reads BOTH files that carry an odometer. Fuel alone would
        // report 19.764 km when the last service said 15.100 — from the wrong
        // file, and confidently.
        setPrevious(highestOdometer([...bundle.fuel.entries, ...bundle.service.entries], entry))

        const existing =
          entry === undefined
            ? undefined
            : bundle.service.entries.find((candidate) => candidate.id === entry)

        if (existing !== undefined) setDraft(serviceDraftOf(existing, prefs))
      } catch (cause) {
        setFailure(String(cause))
      }
    })()
  }, [slug, entry])

  const set = <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const amount = parseInput(draft.amount, MONEY_DECIMALS)

  // The one figure without which the row records nothing. `part` is NOT
  // required: the maker's own fourth row is "SERVİS" — labour, no component —
  // and a form that demanded a part would have refused it.
  const ready = slug.length > 0 && amount !== null && amount > 0 && !saving

  // Both sides in the same units: the field holds what was typed and
  // `highestOdometer` returns kilometres.
  const backwards = serviceGoesBackwards(
    draft,
    previous === null ? null : units.distanceValue(previous),
    prefs
  )
  const badDate = draft.date.trim().length > 0 && parseDate(draft.date) === null

  async function save(): Promise<void> {
    if (!ready) return
    setSaving(true)

    try {
      const record = serviceEntryOf(draft, prefs)
      if (entry === undefined) await window.tritium.addService(slug, record)
      else await window.tritium.updateService(slug, { ...record, id: entry })
      await window.tritium.closeForm()
    } catch (cause) {
      setFailure(String(cause))
      setSaving(false)
    }
  }

  return (
    <div className="form">
      <h1 className="form__title">
        {entry === undefined ? t('service.addTitle') : t('service.editTitle')}
      </h1>

      {failure !== null && (
        <p className="form__error" data-testid="service-form-error">
          {t('service.saveFailed')}
        </p>
      )}

      <div className="form__grid">
        <label className="field">
          <span className="field__label">{t('service.fields.date')}</span>
          <input
            className="control"
            type="text"
            placeholder={t('vehicles.datePattern')}
            data-testid="service-date"
            value={draft.date}
            onChange={(event) => set('date', event.target.value)}
          />
        </label>

        {/* What was done or bought, in the maker's words. */}
        <label className="field">
          <span className="field__label">{t('service.fields.part')}</span>
          <input
            className="control"
            type="text"
            data-testid="service-part"
            value={draft.part}
            onChange={(event) => set('part', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">
            {`${t('service.fields.odometer_km')} (${units.distanceSymbol})`}
          </span>
          <input
            className="control"
            type="text"
            inputMode="numeric"
            data-testid="service-odometer_km"
            value={draft.odometer_km}
            onChange={(event) => set('odometer_km', event.target.value)}
          />
          <span className="field__hint" data-testid="service-odometer-hint">
            {previous === null
              ? ''
              : t('fuel.previousOdometer', {
                  value: units.distance(previous),
                  unit: units.distanceSymbol
                })}
          </span>
        </label>

        <label className="field">
          <span className="field__label">{t('service.fields.amount')}</span>
          <input
            className="control"
            type="text"
            inputMode="decimal"
            data-testid="service-amount"
            value={draft.amount}
            onChange={(event) => set('amount', event.target.value)}
          />
        </label>

        {/*
         * ALINDIĞI LİNK / YER — the sheet's own heading, and it means what it
         * says: an address, a bare domain, a shop's name, or nothing. Stored as
         * typed, shown as text, opened never (§3.5, §4.4).
         */}
        <label className="field">
          <span className="field__label">{t('service.fields.vendor')}</span>
          <input
            className="control"
            type="text"
            data-testid="service-vendor"
            value={draft.vendor}
            onChange={(event) => set('vendor', event.target.value)}
          />
          <span className="field__hint">{t('service.vendorHint')}</span>
        </label>
      </div>

      {badDate && (
        <p className="form__warning" data-testid="service-date-warning">
          {t('vehicles.dateWarning')}
        </p>
      )}

      {backwards && (
        <p className="form__warning" data-testid="service-odometer-warning">
          {t('fuel.backwards', {
            value: units.distance(previous ?? 0),
            unit: units.distanceSymbol
          })}
        </p>
      )}

      <div className="form__actions">
        <button
          type="button"
          className="button"
          data-testid="service-cancel"
          onClick={() => void window.tritium.closeForm()}
        >
          {t('service.cancel')}
        </button>

        <button
          type="button"
          className="button button--primary"
          data-testid="service-save"
          disabled={!ready}
          onClick={() => void save()}
        >
          {t('service.save')}
        </button>
      </div>
    </div>
  )
}
