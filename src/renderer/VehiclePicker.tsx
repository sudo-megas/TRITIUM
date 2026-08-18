// The vehicle picker (XTRITIUM §7 — "Multiple, with a picker").
//
// It lives in the tab bar rather than behind a tab of its own: §7 asks for a
// picker, and the final tab list is still design-phase work (§11). It is
// present with no vehicles too, empty beside its Add button — §7 forbids "get
// started" screens, so an empty app is the same layout holding nothing.

import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { useVehicles } from './state/vehicles.js'

export function VehiclePicker(): JSX.Element {
  const { t } = useTranslation()
  const slugs = useVehicles((s) => s.slugs)
  const names = useVehicles((s) => s.names)
  const active = useVehicles((s) => s.active)
  const error = useVehicles((s) => s.error)
  const select = useVehicles((s) => s.select)

  return (
    <div className="picker">
      {error !== null && (
        <span className="picker__error" data-testid="vehicle-error">
          {t('vehicles.unreadable')}
        </span>
      )}

      <select
        className="control picker__select"
        aria-label={t('vehicles.picker')}
        data-testid="vehicle-picker"
        value={active ?? ''}
        disabled={slugs.length === 0}
        onChange={(event) => void select(event.target.value)}
      >
        {slugs.length === 0 ? (
          <option value="">{t('vehicles.none')}</option>
        ) : (
          slugs.map((slug) => (
            <option key={slug} value={slug}>
              {names[slug] ?? slug}
            </option>
          ))
        )}
      </select>

      <button
        type="button"
        className="button"
        data-testid="vehicle-add"
        onClick={() => void window.tritium.openForm('vehicle')}
      >
        {t('vehicles.add')}
      </button>

      <button
        type="button"
        className="button"
        data-testid="vehicle-edit"
        disabled={active === null}
        onClick={() => {
          if (active !== null) void window.tritium.openForm('vehicle', active)
        }}
      >
        {t('vehicles.edit')}
      </button>
    </div>
  )
}
