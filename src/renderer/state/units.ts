// How a figure is shown, and what a typed figure means (F11).
//
// One hook, asked by every pane and every form, so that "what unit is this in"
// is answered in one place. The conversions themselves live in shared/units.ts
// and are tested there; this is the layer that pairs them with the maker's
// settings and with the family's number formatting.
//
// THE FILE STAYS METRIC (F11.md decision 1). Everything here converts on the way
// to the screen or on the way in from a form, and nothing here is stored.

import { consumptionAt } from '../../shared/consumption.js'
import { formatFigure, parseInput } from '../../shared/format.js'
import { MONEY_DECIMALS, PUMP_DECIMALS, TANK_DECIMALS } from '../../shared/scaled.js'
import {
  CONSUMPTION_SYMBOL,
  DISTANCE_DECIMALS,
  DISTANCE_SYMBOL,
  VOLUME_SYMBOL,
  readDistance,
  readPricePerVolume,
  readVolume,
  showConsumption,
  showCostPerDistance,
  showDistance,
  showPricePerVolume,
  showVolume
} from '../../shared/units.js'
import { useSettings } from './settings.js'

export interface Units {
  distanceSymbol: string
  volumeSymbol: string
  consumptionSymbol: string

  /** The maker's precision, for a caller formatting an already-converted value. */
  consumptionDecimals: number
  costDecimals: number
  /** Miles carry one decimal so the round trip is exact — see units.ts. */
  distanceDecimals: number

  /** `19.764` — the figure alone, for a cell that has its unit in the header. */
  distance: (km: number) => string
  /** `19.764 km` — the figure with its symbol, for a card or a hint. */
  distanceWith: (km: number) => string
  /** The figure as a number, for a chart axis. */
  distanceValue: (km: number) => number

  volume: (scaled: number) => string
  volumeWith: (scaled: number) => string
  volumeValue: (scaled: number) => number

  tank: (scaled: number) => string

  pricePerVolume: (perLitre: number) => string
  pricePerVolumeValue: (perLitre: number) => number

  /** Null when the figure has no image in the chosen unit — see showConsumption. */
  consumption: (l100km: number) => string | null
  consumptionValue: (l100km: number) => number | null

  costPerDistance: (perKm: number) => string
  costPerDistanceValue: (perKm: number) => number

  /** A form's figure back into what the file holds. */
  parseDistance: (text: string) => number | null
  parseVolume: (text: string) => number | null
  parseTank: (text: string) => number | null
  parsePricePerVolume: (text: string) => number | null
}

/** A ×1000 figure re-scaled to the decimals the maker asked to see. */
function shiftTo(scaled: number, decimals: number): number {
  const shift = 3 - decimals
  return shift <= 0 ? scaled : Math.round(scaled / 10 ** shift)
}

export function useUnits(): Units {
  const distanceUnit = useSettings((s) => s.distance)
  const volumeUnit = useSettings((s) => s.volume)
  const consumptionUnit = useSettings((s) => s.consumption)
  const consumptionDecimals = useSettings((s) => s.decimals_consumption)
  const costDecimals = useSettings((s) => s.decimals_cost_per_km)

  const distanceValue = (km: number): number => showDistance(km, distanceUnit)
  const volumeValue = (scaled: number): number => showVolume(scaled, volumeUnit)
  const pricePerVolumeValue = (perLitre: number): number => showPricePerVolume(perLitre, volumeUnit)

  const consumptionValue = (l100km: number): number | null => {
    const converted = showConsumption(l100km, consumptionUnit)
    return converted === null ? null : consumptionAt(converted, consumptionDecimals)
  }

  const costPerDistanceValue = (perKm: number): number =>
    shiftTo(showCostPerDistance(perKm, distanceUnit), costDecimals)

  const distance = (km: number): string =>
    formatFigure(distanceValue(km), DISTANCE_DECIMALS[distanceUnit])
  const volume = (scaled: number): string => formatFigure(volumeValue(scaled), PUMP_DECIMALS)

  return {
    distanceSymbol: DISTANCE_SYMBOL[distanceUnit],
    volumeSymbol: VOLUME_SYMBOL[volumeUnit],
    consumptionSymbol: CONSUMPTION_SYMBOL[consumptionUnit],

    consumptionDecimals,
    costDecimals,
    distanceDecimals: DISTANCE_DECIMALS[distanceUnit],

    distance,
    distanceWith: (km) => `${distance(km)} ${DISTANCE_SYMBOL[distanceUnit]}`,
    distanceValue,

    volume,
    volumeWith: (scaled) => `${volume(scaled)} ${VOLUME_SYMBOL[volumeUnit]}`,
    volumeValue,

    tank: (scaled) => formatFigure(showVolume(scaled, volumeUnit), TANK_DECIMALS),

    pricePerVolume: (perLitre) => formatFigure(pricePerVolumeValue(perLitre), PUMP_DECIMALS),
    pricePerVolumeValue,

    consumption: (l100km) => {
      const value = consumptionValue(l100km)
      return value === null ? null : formatFigure(value, consumptionDecimals)
    },
    consumptionValue,

    costPerDistance: (perKm) => formatFigure(costPerDistanceValue(perKm), costDecimals),
    costPerDistanceValue,

    parseDistance: (text) => {
      const typed = parseInput(text, DISTANCE_DECIMALS[distanceUnit])
      return typed === null ? null : readDistance(typed, distanceUnit)
    },
    parseVolume: (text) => {
      const typed = parseInput(text, PUMP_DECIMALS)
      return typed === null ? null : readVolume(typed, volumeUnit)
    },
    parseTank: (text) => {
      const typed = parseInput(text, TANK_DECIMALS)
      return typed === null ? null : readVolume(typed, volumeUnit)
    },
    parsePricePerVolume: (text) => {
      const typed = parseInput(text, PUMP_DECIMALS)
      return typed === null ? null : readPricePerVolume(typed, volumeUnit)
    }
  }
}

/** Money at the family's two decimals, for callers that already have a symbol. */
export const MONEY = MONEY_DECIMALS
