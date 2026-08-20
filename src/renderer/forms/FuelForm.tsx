// The full form (XTRITIUM §5.1): every field of §4.4's fuel.toml, in a window
// of its own.
//
// It is also the edit path. §3.8 — all entries are editable at any time — and
// quick-add's own promise that everything it did not ask is "editable later".
// An edit replaces one entry by id in the main process; the rest of the file is
// not rewritten from anything this window is holding.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoneyText, parseDate, parseInput } from '../../shared/format.js'
import { FUEL_TYPES, type VehicleBundle } from '../../shared/records.js'
import { PUMP_DECIMALS } from '../../shared/scaled.js'
import { useSettings } from '../state/settings.js'
import { useUnits } from '../state/units.js'
import {
  draftOf,
  draftTotal,
  emptyDraft,
  entryOf,
  goesBackwards,
  lastOdometer,
  type FuelDraft
} from '../../shared/fuel-draft.js'

export function FuelForm({ slug, entry }: { slug: string; entry?: string }): JSX.Element {
  const { t } = useTranslation()
  const currency = useSettings((s) => s.currency)
  const units = useUnits()
  // The two units the boundary needs, read once and handed to BOTH halves of
  // it — a form that showed gallons and saved them as litres would be the one
  // way F11 could corrupt a file (F11.md decision 1).
  const distanceUnit = useSettings((s) => s.distance)
  const volumeUnit = useSettings((s) => s.volume)
  const prefs = { distance: distanceUnit, volume: volumeUnit }
  const [draft, setDraft] = useState<FuelDraft>(() => emptyDraft(''))
  const [previous, setPrevious] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Editing: the entry on disk fills the form. Adding: today, the vehicle's own
  // fuel, and an empty odometer.
  useEffect(() => {
    if (slug.length === 0) return

    void (async () => {
      try {
        const bundle = (await window.tritium.loadVehicle(slug)) as VehicleBundle
        setPrevious(lastOdometer(bundle.fuel.entries, entry))

        const existing =
          entry === undefined
            ? undefined
            : bundle.fuel.entries.find((candidate) => candidate.id === entry)

        if (existing !== undefined) {
          setDraft(draftOf(existing, prefs))
          return
        }

        const spec = bundle.vehicle?.vehicle.fuel_spec ?? ''
        if (spec.length > 0) {
          setDraft((current) =>
            current.fuel_type.length === 0 ? { ...current, fuel_type: spec } : current
          )
        }
      } catch (cause) {
        setFailure(String(cause))
      }
    })()
  }, [slug, entry])

  const set = <K extends keyof FuelDraft>(key: K, value: FuelDraft[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const total = draftTotal(draft, prefs)
  const odometer = parseInput(draft.odometer_km, 0)
  const litres = parseInput(draft.litres, PUMP_DECIMALS)
  const ready =
    slug.length > 0 && odometer !== null && odometer > 0 && litres !== null && litres > 0

  // Both sides of the comparison in the SAME units: the field holds what the
  // maker typed and `lastOdometer` returns kilometres, so the reading is
  // converted before they are compared.
  const backwards = goesBackwards(
    draft,
    previous === null ? null : units.distanceValue(previous),
    prefs
  )
  const badDate = draft.date.trim().length > 0 && parseDate(draft.date) === null

  async function save(): Promise<void> {
    if (!ready || saving) return
    setSaving(true)

    try {
      const record = entryOf(draft, prefs)
      if (entry === undefined) await window.tritium.addFuel(slug, record)
      else await window.tritium.updateFuel(slug, { ...record, id: entry })
      await window.tritium.closeForm()
    } catch (cause) {
      setFailure(String(cause))
      setSaving(false)
    }
  }

  return (
    <div className="form">
      <h1 className="form__title">
        {entry === undefined ? t('fuel.addTitle') : t('fuel.editTitle')}
      </h1>

      {failure !== null && (
        <p className="form__error" data-testid="fuel-form-error">
          {t('fuel.saveFailed')}
        </p>
      )}

      <div className="form__grid">
        <label className="field">
          <span className="field__label">{t('fuel.fields.date')}</span>
          <input
            className="control"
            type="text"
            placeholder={t('vehicles.datePattern')}
            data-testid="fuel-date"
            value={draft.date}
            onChange={(event) => set('date', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">
            {`${t('fuel.fields.odometer_km')} (${units.distanceSymbol})`}
          </span>
          <input
            className="control"
            type="text"
            inputMode="numeric"
            data-testid="fuel-odometer_km"
            value={draft.odometer_km}
            onChange={(event) => set('odometer_km', event.target.value)}
          />
          <span className="field__hint" data-testid="fuel-odometer-hint">
            {previous === null
              ? ''
              : t('fuel.previousOdometer', {
                  value: units.distance(previous),
                  unit: units.distanceSymbol
                })}
          </span>
        </label>

        <label className="field">
          <span className="field__label">
            {`${t('fuel.fields.litres')} (${units.volumeSymbol})`}
          </span>
          <input
            className="control"
            type="text"
            inputMode="decimal"
            data-testid="fuel-litres"
            value={draft.litres}
            onChange={(event) => set('litres', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">
            {`${t('fuel.fields.price_per_litre')} ${units.volumeSymbol}`}
          </span>
          <input
            className="control"
            type="text"
            inputMode="decimal"
            data-testid="fuel-price_per_litre"
            value={draft.price_per_litre}
            onChange={(event) => set('price_per_litre', event.target.value)}
          />
          <span className="field__hint" data-testid="fuel-total-preview">
            {total === null ? '' : formatMoneyText(total, currency ?? '')}
          </span>
        </label>

        <label className="field">
          <span className="field__label">{t('fuel.fields.fuel_type')}</span>
          <select
            className="control"
            data-testid="fuel-fuel_type"
            value={draft.fuel_type}
            onChange={(event) => set('fuel_type', event.target.value)}
          >
            <option value="">{t('vehicles.unset')}</option>
            {FUEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        {/* §5.2 — the flag is a real field, not decoration: mis-flagging shifts
            the figures on both sides of it. So it is asked, not inferred. */}
        <label className="field field--check">
          <span className="field__label">{t('fuel.fields.full_tank')}</span>
          <input
            type="checkbox"
            data-testid="fuel-full_tank"
            checked={draft.full_tank}
            onChange={(event) => set('full_tank', event.target.checked)}
          />
          <span className="field__hint">{t('fuel.fullTankHint')}</span>
        </label>
      </div>

      {badDate && (
        <p className="form__warning" data-testid="fuel-date-warning">
          {t('vehicles.dateWarning')}
        </p>
      )}

      {backwards && (
        <p className="form__warning" data-testid="fuel-odometer-warning">
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
          data-testid="fuel-cancel"
          onClick={() => void window.tritium.closeForm()}
        >
          {t('fuel.cancel')}
        </button>

        <button
          type="button"
          className="button button--primary"
          data-testid="fuel-save"
          disabled={!ready || saving}
          onClick={() => void save()}
        >
          {t('fuel.save')}
        </button>
      </div>
    </div>
  )
}
