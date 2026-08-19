// The unit boundary (XTRITIUM §4.4 [units], §8, F11).
//
// THE FILE STAYS METRIC, WHATEVER THE SETTINGS SAY.
//
// `fuel.toml` holds `odometer_km` and `litres`; `vehicle.toml` holds
// `tank_capacity_l`. Those key names are §4.4's and they are not decoration — a
// file whose meaning depended on a setting in ANOTHER file would stop being the
// plaintext, hand-editable record §3.4 promises. Open one in Neovim and 19764
// is kilometres, always.
//
// So a unit is a boundary: converted on the way to the screen and on the way in
// from a form, and never in between. Switching to miles and back leaves every
// file byte-identical, and a test asserts exactly that.
//
// Everything here is scaled integers in and scaled integers out (§4.3).

import type { ConsumptionUnit, DistanceUnit, VolumeUnit } from './settings.js'

/**
 * The two units a form needs to know about, passed to the draft modules so the
 * conversion stays in shared code where it is tested — rather than in a
 * component, where it would be tested through a window.
 */
export interface UnitPrefs {
  distance: DistanceUnit
  volume: VolumeUnit
}

/** What the file holds, for a caller that has no settings to hand. */
export const METRIC: UnitPrefs = { distance: 'km', volume: 'l' }

/** 1 mile, in kilometres. Exact by international agreement since 1959. */
export const KM_PER_MILE = 1.609344

/**
 * 1 US gallon, in litres. Exact.
 *
 * §4.4 offers `gal` and `mpg` without saying which gallon, and there are two:
 * the US gallon at 3,785411784 l and the imperial at 4,54609 l. They differ by
 * twenty per cent, which is not a rounding difference — it is the difference
 * between a good tank and a bad one.
 *
 * TRITIUM uses the US gallon and the settings page prints this figure beside
 * the option, rather than leaving the maker to discover it from a number that
 * looks wrong. A second setting for the imperial gallon is not added: §4.4
 * offers one `gal`, and inventing a second would answer a question the
 * constitution did not ask.
 */
export const LITRES_PER_US_GALLON = 3.785411784

/**
 * The mpg constant, which follows from the other two rather than being a third:
 * 100 km ÷ 1,609344 = 62,1371 miles, and 1 l = 0,264172 US gal, so
 * mpg = 62,1371 ÷ (litres ÷ 0,264172… ) — which reduces to 235,214583 ÷ l/100km.
 */
export const MPG_CONSTANT = (100 / KM_PER_MILE) * LITRES_PER_US_GALLON

// ---------------------------------------------------------------------------
// Distance — stored as whole kilometres
// ---------------------------------------------------------------------------

/**
 * How many decimals a distance is SHOWN with, per unit.
 *
 * Kilometres get none: the file stores whole kilometres and showing a decimal
 * would invent precision that is not there.
 *
 * Miles get one, and this is not cosmetic. A mile is 1,609 km, so a WHOLE mile
 * is coarser than the whole kilometre underneath it: two different readings
 * land on the same mile, and converting back cannot know which. Measured over
 * 0–300.000 km, whole miles fail to round-trip for **37,9% of values** — so a
 * maker working in miles who opened a fill-up and saved it untouched would have
 * had better than one chance in three of moving his own odometer by a kilometre.
 *
 * One decimal makes the display FINER than the storage — 0,1 mi is 0,16 km — and
 * the round trip becomes exact for every value in that range. It is also what a
 * real odometer shows.
 */
export const DISTANCE_DECIMALS: Record<DistanceUnit, number> = { km: 0, mi: 1 }

/** Kilometres into what the screen shows, scaled by `DISTANCE_DECIMALS`. */
export function showDistance(km: number, unit: DistanceUnit): number {
  return unit === 'km' ? km : Math.round((km * 10) / KM_PER_MILE)
}

/** What the screen shows, back into the whole kilometres the file holds. */
export function readDistance(value: number, unit: DistanceUnit): number {
  return unit === 'km' ? value : Math.round((value * KM_PER_MILE) / 10)
}

// ---------------------------------------------------------------------------
// Volume — stored ×1000 (litres) or ×10 (tank capacity)
// ---------------------------------------------------------------------------

export function showVolume(scaled: number, unit: VolumeUnit): number {
  return unit === 'l' ? scaled : Math.round(scaled / LITRES_PER_US_GALLON)
}

export function readVolume(value: number, unit: VolumeUnit): number {
  return unit === 'l' ? value : Math.round(value * LITRES_PER_US_GALLON)
}

// ---------------------------------------------------------------------------
// Price per volume — stored per litre, ×1000
// ---------------------------------------------------------------------------

/**
 * A price per litre becomes a price per gallon by MULTIPLYING: a gallon is more
 * litres, so it costs more. The inverse of the volume conversion, and the one
 * place it is easy to divide by mistake.
 */
export function showPricePerVolume(perLitre: number, unit: VolumeUnit): number {
  return unit === 'l' ? perLitre : Math.round(perLitre * LITRES_PER_US_GALLON)
}

export function readPricePerVolume(value: number, unit: VolumeUnit): number {
  return unit === 'l' ? value : Math.round(value / LITRES_PER_US_GALLON)
}

// ---------------------------------------------------------------------------
// Consumption — CONVERTED from the §5.2 figure, never recomputed
// ---------------------------------------------------------------------------

/**
 * l/100km ×1000 into the chosen unit, still ×1000.
 *
 * The §5.2 engine keeps producing l/100km and this converts its one figure.
 * Recomputing km/l from litres and distance would give a second arithmetic path
 * to the number F4 built a whole milestone around, and the two would drift at
 * the last decimal.
 *
 * Both alternatives are INVERSE measures — more litres per hundred kilometres is
 * worse, more kilometres per litre is better — so zero has no image and returns
 * null rather than infinity.
 */
export function showConsumption(l100km: number, unit: ConsumptionUnit): number | null {
  if (unit === 'l100km') return l100km
  if (l100km <= 0) return null

  // kml = 100 ÷ l100km. At ×1000 on both sides: 100 × 1000 × 1000 ÷ scaled.
  if (unit === 'kml') return Math.round(100_000_000 / l100km)

  // mpg = 235,214583 ÷ l100km, at ×1000 on both sides.
  return Math.round((MPG_CONSTANT * 1_000_000) / l100km)
}

// ---------------------------------------------------------------------------
// Cost per distance — stored per kilometre, ×1000
// ---------------------------------------------------------------------------

/**
 * Per kilometre into per mile: a mile is further, so it costs more.
 *
 * Unlike the odometer this is not re-read from the screen — nothing enters a
 * cost per distance — so it needs no extra decimal to survive a round trip.
 */
export function showCostPerDistance(perKm: number, unit: DistanceUnit): number {
  return unit === 'km' ? perKm : Math.round(perKm * KM_PER_MILE)
}

// ---------------------------------------------------------------------------
// What each unit is called, where it is not a translated word
// ---------------------------------------------------------------------------

/**
 * Unit symbols are NOT in the i18n catalogue.
 *
 * `km`, `mi`, `l`, `gal`, `l/100km`, `km/l` and `mpg` are the same characters in
 * both languages — they are notation, like `₺` and like the digits themselves.
 * Putting them in the catalogue would invite a translation that should not
 * exist and would make `audit-strings` police something that is not prose.
 */
export const DISTANCE_SYMBOL: Record<DistanceUnit, string> = { km: 'km', mi: 'mi' }
export const VOLUME_SYMBOL: Record<VolumeUnit, string> = { l: 'l', gal: 'gal' }
export const CONSUMPTION_SYMBOL: Record<ConsumptionUnit, string> = {
  l100km: 'l/100km',
  kml: 'km/l',
  mpg: 'mpg'
}
