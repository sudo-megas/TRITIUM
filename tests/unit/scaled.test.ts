// XTRITIUM §4.3 — the arithmetic runs on integers so the totals are exact.
//
// The values below are not decoration. Scaling a decimal by 100 or 1000 lands
// just under the integer often enough to matter: 19.99 × 100 is
// 1998.9999999999998 and 8.165 × 1000 is 8164.999999999999. A truncating
// conversion loses a cent on the first and a millilitre on the second, every
// time, for as long as the file exists.

import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatPump,
  formatScaled,
  formatTank,
  fromScaled,
  sumScaled,
  toMoney,
  toPump,
  toTank
} from '../../src/shared/scaled.js'

describe('scaled integers', () => {
  it('rounds the figures that float multiplication gets wrong', () => {
    expect(19.99 * 100).not.toBe(1999)
    expect(Math.trunc(19.99 * 100)).toBe(1998)
    expect(8.165 * 1000).not.toBe(8165)
    expect(Math.trunc(8.165 * 1000)).toBe(8164)

    expect(toMoney(19.99)).toBe(1999)
    expect(toMoney(4.35)).toBe(435)
    expect(toMoney(70.07)).toBe(7007)
    expect(toPump(8.165)).toBe(8165)
  })

  it('round-trips a figure through the scale unchanged', () => {
    expect(formatMoney(toMoney(11746))).toBe('11746.00')
    expect(formatPump(toPump(29.99))).toBe('29.990')
    expect(formatTank(toTank(54))).toBe('54.0')
    expect(fromScaled(toMoney(2160000), 2)).toBe(2160000)
  })

  it('keeps the trailing zeros that make a money column readable', () => {
    // The whole reason the record files emit their own text: a float's
    // toString would render this as 11746 and 8664.
    expect(formatMoney(1174600)).toBe('11746.00')
    expect(formatMoney(866400)).toBe('8664.00')
    expect(formatScaled(5, 2)).toBe('0.05')
    expect(formatScaled(0, 3)).toBe('0.000')
  })

  it('sums a hundred entries to the cent', () => {
    const scaled = Array.from({ length: 100 }, () => toMoney(0.07))
    expect(sumScaled(scaled)).toBe(700)
    expect(formatMoney(sumScaled(scaled))).toBe('7.00')

    // The same sum in floating point does not land on 7.
    const floats = Array.from({ length: 100 }, () => 0.07).reduce((a, b) => a + b, 0)
    expect(floats).not.toBe(7)
  })

  it('handles negatives symmetrically, for the refunds that are income', () => {
    expect(toMoney(-11.12)).toBe(-1112)
    expect(formatMoney(-1112)).toBe('-11.12')
    expect(toMoney(-73.38)).toBe(-toMoney(73.38))
  })
})
