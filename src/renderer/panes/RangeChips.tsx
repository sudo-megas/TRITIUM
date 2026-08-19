// The time-range chips of XTRITIUM §7.2, and the custom range beside them.
//
// §7 — "Search: None. Filtering is the range chips." These five and the custom
// pair are the whole of what filters a list in TRITIUM.
//
// The custom range is two text fields in the flow, in the family's own date
// format. There is no popup calendar: `audit-overlap` fails the build on the
// entire family of constructs one is built from, and two fields that read
// GG/AA/YYYY are not worse than a widget that has to explain itself.

import { useMemo, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { parseDate, todayIso } from '../../shared/format.js'
import { RANGE_KEYS, boundsFor, type DateBounds, type RangeKey } from '../../shared/range.js'

export interface CustomText {
  from: string
  to: string
}

export interface RangeFilter {
  range: RangeKey
  setRange: (key: RangeKey) => void
  custom: CustomText
  setCustom: (custom: CustomText) => void
  bounds: DateBounds
}

/**
 * The chip state and the window it means.
 *
 * All three lists ask the same question, so they ask it the same way. Today is
 * read once per render from the LOCAL calendar (§3.6, and F4's UTC+3 trap) —
 * never from `toISOString`, and never from a locale.
 */
export function useRangeFilter(): RangeFilter {
  const [range, setRange] = useState<RangeKey>('all')
  const [custom, setCustom] = useState<CustomText>({ from: '', to: '' })

  const bounds = useMemo(
    () =>
      boundsFor(range, todayIso(), {
        from: parseDate(custom.from),
        to: parseDate(custom.to)
      }),
    [range, custom]
  )

  return { range, setRange, custom, setCustom, bounds }
}

export function RangeChips({ filter }: { filter: RangeFilter }): JSX.Element {
  const { t } = useTranslation()
  const { range, setRange, custom, setCustom } = filter

  return (
    <div className="chips" data-testid="range-chips">
      {RANGE_KEYS.map((key) => (
        <button
          type="button"
          key={key}
          className="chip"
          data-testid={`range-${key}`}
          aria-pressed={key === range}
          onClick={() => setRange(key)}
        >
          {t(`range.${key}`)}
        </button>
      ))}

      {/* Present only when it is the chosen range: a pair of fields that filter
          nothing would be furniture asking to be misread. */}
      {range === 'custom' && (
        <span className="chips__custom">
          <input
            className="control control--date"
            type="text"
            placeholder={t('vehicles.datePattern')}
            aria-label={t('range.from')}
            data-testid="range-from"
            value={custom.from}
            onChange={(event) => setCustom({ ...custom, from: event.target.value })}
          />
          <input
            className="control control--date"
            type="text"
            placeholder={t('vehicles.datePattern')}
            aria-label={t('range.to')}
            data-testid="range-to"
            value={custom.to}
            onChange={(event) => setCustom({ ...custom, to: event.target.value })}
          />
        </span>
      )}
    </div>
  )
}
