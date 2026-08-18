// XTRITIUM §4.3 — Money and measures.
//
// TOML stores the human-readable figures exactly as entered (73.38, 36.789).
// Internally every arithmetic runs on scaled integers, converted once at load:
// money ×100, litres and prices ×1000. Sums are exact — a hundred fill-ups add
// up to the cent — and the files on disk stay readable.
//
// Decimals are a property of the FIELD, not of the file: money at 2, pump
// figures at 3, tank capacity at 1 (XTRITIUM §4.4 samples it as 54.0).

/** Money — purchase_price, amount. */
export const MONEY_DECIMALS = 2
/** Pump figures — litres, price_per_litre. */
export const PUMP_DECIMALS = 3
/** Tank capacity — tank_capacity_l. */
export const TANK_DECIMALS = 1

export function scaleOf(decimals: number): number {
  return 10 ** decimals
}

/**
 * Convert a figure read from TOML into its scaled integer.
 *
 * Rounding is not optional: smol-toml hands back IEEE doubles, and scaling one
 * lands just under the integer often enough to matter — 19.99 × 100 is
 * 1998.9999999999998, 4.35 × 100 is 434.99999999999994, 8.165 × 1000 is
 * 8164.999999999999. Truncating any of those loses a cent or a millilitre, and
 * a cent an entry compounds. The rounding is applied to the magnitude so
 * negatives behave symmetrically.
 */
export function toScaled(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const sign = value < 0 ? -1 : 1
  return sign * Math.round(Math.abs(value) * scaleOf(decimals))
}

/** Convert a scaled integer back to its human figure. Lossy by design — display only. */
export function fromScaled(scaled: number, decimals: number): number {
  return scaled / scaleOf(decimals)
}

/**
 * Render a scaled integer as the fixed-decimal figure that belongs in the file.
 *
 * This is what keeps `amount = 11746.00` from degrading to `11746` on a round
 * trip: the text is built from the integer, never from a float's toString, so
 * the XTRITIUM §4.4 samples are reproduced exactly.
 */
export function formatScaled(scaled: number, decimals: number): string {
  const rounded = Math.round(scaled)
  const sign = rounded < 0 ? '-' : ''
  const digits = Math.abs(rounded).toString().padStart(decimals + 1, '0')
  if (decimals === 0) return `${sign}${digits}`
  const whole = digits.slice(0, digits.length - decimals)
  const fraction = digits.slice(digits.length - decimals)
  return `${sign}${whole}.${fraction}`
}

/** Sum scaled integers. Exact, because integers are exact. */
export function sumScaled(values: readonly number[]): number {
  let total = 0
  for (const value of values) total += value
  return total
}

/** Named helpers, so call sites read as prose rather than as arithmetic. */
export function toMoney(value: number): number {
  return toScaled(value, MONEY_DECIMALS)
}

export function formatMoney(scaled: number): string {
  return formatScaled(scaled, MONEY_DECIMALS)
}

export function toPump(value: number): number {
  return toScaled(value, PUMP_DECIMALS)
}

export function formatPump(scaled: number): string {
  return formatScaled(scaled, PUMP_DECIMALS)
}

export function toTank(value: number): number {
  return toScaled(value, TANK_DECIMALS)
}

export function formatTank(scaled: number): string {
  return formatScaled(scaled, TANK_DECIMALS)
}
