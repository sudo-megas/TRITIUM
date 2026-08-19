// Quick-add (XTRITIUM §5.1): "odometer, litres, price/litre — done. Everything
// else editable later."
//
// So this window has three inputs. The date is today, the fuel type is the
// vehicle's own, and the tank is recorded as filled — all three said out loud
// on the form, because a default nobody can see is how a consumption figure
// goes quietly wrong (§5.2). None of them is asked, and all three are editable
// afterwards in the full form.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoneyText, parseInput } from '../../shared/format.js'
import type { VehicleBundle } from '../../shared/records.js'
import { PUMP_DECIMALS } from '../../shared/scaled.js'
import { useSettings } from '../state/settings.js'
import { useUnits } from '../state/units.js'
import {
  draftTotal,
  emptyDraft,
  entryOf,
  goesBackwards,
  lastOdometer,
  type FuelDraft
} from '../../shared/fuel-draft.js'

export function FuelQuickAdd({ slug }: { slug: string }): JSX.Element {
  const { t } = useTranslation()
  const currency = useSettings((s) => s.currency)
  const units = useUnits()
  // Read once and handed to the boundary, exactly as the full form does.
  const distanceUnit = useSettings((s) => s.distance)
  const volumeUnit = useSettings((s) => s.volume)
  const prefs = { distance: distanceUnit, volume: volumeUnit }
  const [draft, setDraft] = useState<FuelDraft>(() => emptyDraft(''))
  const [previous, setPrevious] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The vehicle is read for two things only: the fuel it takes, and the
  // odometer it was last seen at (§5.1's hint).
  useEffect(() => {
    if (slug.length === 0) return

    void (async () => {
      try {
        const bundle = (await window.tritium.loadVehicle(slug)) as VehicleBundle
        setPrevious(lastOdometer(bundle.fuel.entries))

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
  }, [slug])

  const set = (key: 'odometer_km' | 'litres' | 'price_per_litre', value: string): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const total = draftTotal(draft)
  const odometer = parseInput(draft.odometer_km, 0)
  const litres = parseInput(draft.litres, PUMP_DECIMALS)
  const ready =
    slug.length > 0 && odometer !== null && odometer > 0 && litres !== null && litres > 0

  // A warning, not a refusal (§5.1, §3.8) — typos in old entries must be fixable.
  const backwards = goesBackwards(
    draft,
    previous === null ? null : units.distanceValue(previous),
    prefs
  )

  async function save(): Promise<void> {
    if (!ready || saving) return
    setSaving(true)

    try {
      await window.tritium.addFuel(slug, entryOf(draft, prefs))
      await window.tritium.closeForm()
    } catch (cause) {
      setFailure(String(cause))
      setSaving(false)
    }
  }

  return (
    <div className="form">
      <h1 className="form__title">{t('fuel.quickTitle')}</h1>

      {failure !== null && (
        <p className="form__error" data-testid="fuel-form-error">
          {t('fuel.saveFailed')}
        </p>
      )}

      <div className="form__grid">
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
        </label>
      </div>

      {/* Derived, shown live, never stored (§5.1, §4.4). */}
      <p className="form__note">
        {t('fuel.total')}{' '}
        <span data-testid="fuel-total-preview">
          {total === null ? '' : formatMoneyText(total, currency ?? '')}
        </span>
      </p>

      <p className="form__note" data-testid="fuel-defaults-note">
        {t('fuel.quickDefaults', {
          date: draft.date,
          fuel: draft.fuel_type.length > 0 ? draft.fuel_type : t('fuel.anyFuel')
        })}
      </p>

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
