// The vehicle record, in its own window (XTRITIUM §5.1).
//
// Every field of §4.4's vehicle.toml and NO photo field — vehicles have no
// photos anywhere in TRITIUM.
//
// XTRITIUM §3.8 — all entries are editable at any time; the form may warn about
// a suspicious figure and then accepts the maker's word. The only refusal here
// is an empty name, because the name is what the directory is called.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import {
  EMPTY_VEHICLE,
  FUEL_TYPES,
  RECORD_SCHEMA_VERSION,
  type Vehicle,
  type VehicleBundle,
  type VehicleDocument
} from '../../shared/records.js'
import { MONEY_DECIMALS, TANK_DECIMALS } from '../../shared/scaled.js'
import { formatDate, formatMoneyText, parseDate, parseInput, toInput } from '../../shared/format.js'
import { useSettings } from '../state/settings.js'
import { useUnits } from '../state/units.js'
import { METRIC, VOLUME_DECIMALS, readVolume, showVolume, type UnitPrefs } from '../../shared/units.js'

/** TANK_DECIMALS plus VOLUME_DECIMALS — gal needs one more to round-trip (useUnits's own tankDecimals). */
function tankDecimalsOf(units: UnitPrefs): number {
  return TANK_DECIMALS + VOLUME_DECIMALS[units.volume]
}

/** The form's own state: every field as the text the maker sees. */
interface Draft {
  name: string
  make: string
  model: string
  year: string
  engine: string
  fuel_spec: string
  plate: string
  vin: string
  tank_capacity_l: string
  purchase_date: string
  purchase_price: string
  registration_date: string
  inspection_due: string
}

function draftOf(vehicle: Vehicle, units: UnitPrefs = METRIC): Draft {
  return {
    name: vehicle.name,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year > 0 ? String(vehicle.year) : '',
    engine: vehicle.engine,
    fuel_spec: vehicle.fuel_spec,
    plate: vehicle.plate,
    vin: vehicle.vin,
    // The file holds litres (§4.4's own key name); the field shows whatever
    // the maker asked for (F11.md decision 1).
    tank_capacity_l:
      vehicle.tank_capacity_l > 0
        ? toInput(showVolume(vehicle.tank_capacity_l, units.volume), tankDecimalsOf(units))
        : '',
    purchase_date: formatDate(vehicle.purchase_date),
    purchase_price:
      vehicle.purchase_price > 0 ? toInput(vehicle.purchase_price, MONEY_DECIMALS) : '',
    registration_date: formatDate(vehicle.registration_date),
    inspection_due: formatDate(vehicle.inspection_due)
  }
}

/**
 * A draft back into the record. Anything unreadable becomes the empty value the
 * record already uses for "not entered" — never a guess, and never a refusal
 * that would lose the rest of what was typed.
 */
function vehicleOf(draft: Draft, units: UnitPrefs = METRIC): Vehicle {
  return {
    name: draft.name.trim(),
    make: draft.make.trim(),
    model: draft.model.trim(),
    year: parseInput(draft.year, 0) ?? 0,
    engine: draft.engine.trim(),
    fuel_spec: draft.fuel_spec,
    plate: draft.plate.trim(),
    vin: draft.vin.trim(),
    tank_capacity_l: readVolume(
      parseInput(draft.tank_capacity_l, tankDecimalsOf(units)) ?? 0,
      units.volume
    ),
    purchase_date: parseDate(draft.purchase_date) ?? '',
    purchase_price: parseInput(draft.purchase_price, MONEY_DECIMALS) ?? 0,
    registration_date: parseDate(draft.registration_date) ?? '',
    inspection_due: parseDate(draft.inspection_due) ?? ''
  }
}

const TEXT_FIELDS = ['name', 'make', 'model', 'engine', 'plate', 'vin'] as const
const DATE_FIELDS = ['purchase_date', 'registration_date', 'inspection_due'] as const

export function VehicleForm({ slug }: { slug?: string }): JSX.Element {
  const { t } = useTranslation()
  const currency = useSettings((s) => s.currency)
  const units = useUnits()
  const prefs = { distance: useSettings((s) => s.distance), volume: useSettings((s) => s.volume) }
  const [draft, setDraft] = useState<Draft>(() => draftOf(EMPTY_VEHICLE))
  const [carried, setCarried] = useState<VehicleDocument['rest']>({})
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Editing: the record on disk fills the form. Adding: it stays empty.
  useEffect(() => {
    if (slug === undefined) return

    void (async () => {
      try {
        const bundle = (await window.tritium.loadVehicle(slug)) as VehicleBundle
        if (bundle.vehicle !== null) {
          setDraft(draftOf(bundle.vehicle.vehicle, prefs))
          // Keys this milestone does not know travel back out untouched.
          setCarried(bundle.vehicle.rest)
        }
      } catch (cause) {
        setFailure(String(cause))
      }
    })()
  }, [slug])

  const set = (key: keyof Draft, value: string): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const price = parseInput(draft.purchase_price, MONEY_DECIMALS)
  const nameGiven = draft.name.trim().length > 0

  // A warning, not a refusal (§3.8). The maker's word is final.
  const dateWarnings = DATE_FIELDS.filter(
    (key) => draft[key].trim().length > 0 && parseDate(draft[key]) === null
  )

  async function save(): Promise<void> {
    if (!nameGiven || saving) return
    setSaving(true)

    const document: VehicleDocument = {
      schemaVersion: RECORD_SCHEMA_VERSION,
      vehicle: vehicleOf(draft, prefs),
      rest: carried
    }

    try {
      if (slug === undefined) await window.tritium.createVehicle(document)
      else await window.tritium.saveVehicle(slug, document)
      await window.tritium.closeForm()
    } catch (cause) {
      setFailure(String(cause))
      setSaving(false)
    }
  }

  return (
    <div className="form">
      <h1 className="form__title">
        {slug === undefined ? t('vehicles.addTitle') : t('vehicles.editTitle')}
      </h1>

      {failure !== null && (
        <p className="form__error" data-testid="vehicle-form-error">
          {t('vehicles.saveFailed')}
        </p>
      )}

      <div className="form__grid">
        {TEXT_FIELDS.map((key) => (
          <label className="field" key={key}>
            <span className="field__label">{t(`vehicles.fields.${key}`)}</span>
            <input
              className="control"
              type="text"
              data-testid={`vehicle-${key}`}
              value={draft[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          </label>
        ))}

        <label className="field">
          <span className="field__label">{t('vehicles.fields.year')}</span>
          <input
            className="control"
            type="text"
            inputMode="numeric"
            data-testid="vehicle-year"
            value={draft.year}
            onChange={(event) => set('year', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('vehicles.fields.fuel_spec')}</span>
          <select
            className="control"
            data-testid="vehicle-fuel_spec"
            value={draft.fuel_spec}
            onChange={(event) => set('fuel_spec', event.target.value)}
          >
            <option value="">{t('vehicles.unset')}</option>
            {FUEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">
            {`${t('vehicles.fields.tank_capacity_l')} (${units.volumeSymbol})`}
          </span>
          <input
            className="control"
            type="text"
            inputMode="decimal"
            data-testid="vehicle-tank_capacity_l"
            value={draft.tank_capacity_l}
            onChange={(event) => set('tank_capacity_l', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('vehicles.fields.purchase_price')}</span>
          <input
            className="control"
            type="text"
            inputMode="decimal"
            data-testid="vehicle-purchase_price"
            value={draft.purchase_price}
            onChange={(event) => set('purchase_price', event.target.value)}
          />
          {/* Read back in the family convention, so a misread separator is
              visible while it can still be corrected (§5.1's live total, in
              the one place F3 has a figure worth showing). */}
          <span className="field__hint" data-testid="vehicle-price-preview">
            {price === null ? '' : formatMoneyText(price, currency ?? '')}
          </span>
        </label>

        {DATE_FIELDS.map((key) => (
          <label className="field" key={key}>
            <span className="field__label">{t(`vehicles.fields.${key}`)}</span>
            <input
              className="control"
              type="text"
              placeholder={t('vehicles.datePattern')}
              data-testid={`vehicle-${key}`}
              value={draft[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          </label>
        ))}
      </div>

      {dateWarnings.length > 0 && (
        <p className="form__warning" data-testid="vehicle-date-warning">
          {t('vehicles.dateWarning')}
        </p>
      )}

      <div className="form__actions">
        <button
          type="button"
          className="button"
          data-testid="vehicle-cancel"
          onClick={() => void window.tritium.closeForm()}
        >
          {t('vehicles.cancel')}
        </button>

        <button
          type="button"
          className="button button--primary"
          data-testid="vehicle-save"
          disabled={!nameGiven || saving}
          onClick={() => void save()}
        >
          {t('vehicles.save')}
        </button>
      </div>
    </div>
  )
}
