// Every ratio tests/unit/palettes.test.ts asserts is computed here, not
// eyeballed. The eleven palettes derive their surfaces and borders in OKLCH
// (F4b D5), but nothing forces the shipped stylesheet to keep that notation —
// a token may just as easily end up written as plain hex once it is baked
// down to a fixed value. So every colour is read down to one shared
// representation, gamma-encoded sRGB, and every computation carries on from
// there: relative luminance and contrast ratio exactly as WCAG 2.x defines
// them, and a trip through OKLab for the chroma check, using the published
// conversion matrices — the same numbers CSS Color 4 itself specifies, not
// an approximation of them.

export interface Rgb {
  r: number
  g: number
  b: number
  a: number
}

export interface Oklch {
  l: number
  c: number
  h: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

// The sRGB transfer function (IEC 61966-2-1) and its inverse. Every
// luminance, contrast and chroma figure below starts by undoing this curve —
// none of those quantities mean anything computed on gamma-encoded numbers.
export function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

export function linearToSrgb(channel: number): number {
  const value = clamp01(channel)
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
}

// WCAG 2.x's own definition, verbatim: 0.2126R + 0.7152G + 0.0722B on the
// linear-light channels.
export function relativeLuminance(rgb: Rgb): number {
  const r = srgbToLinear(rgb.r / 255)
  const g = srgbToLinear(rgb.g / 255)
  const b = srgbToLinear(rgb.b / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// (lighter + 0.05) / (darker + 0.05). Taking the max and min rather than a
// fixed foreground/background order is what makes this symmetric in its two
// arguments — the helper's own tests check that identity directly rather
// than assuming it.
export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

/*
 * CIE L*, from the same relative luminance the contrast ratio is built on.
 *
 * This is the right instrument for asking how far apart two surfaces look.
 * A contrast ratio cannot answer that question at the dark end: its (L + 0.05)
 * flare term swamps small luminances, so two visibly different near-black
 * grounds and two nearly identical near-white ones can score the same. L* is
 * perceptually uniform across the whole range, which is why the surface-step
 * rule is written in it.
 */
export function lightness(rgb: Rgb): number {
  const y = relativeLuminance(rgb)
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y
}

export function sameColor(a: Rgb, b: Rgb): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b
}

export function isPureBlack(rgb: Rgb): boolean {
  return rgb.r === 0 && rgb.g === 0 && rgb.b === 0
}

export function isPureWhite(rgb: Rgb): boolean {
  return rgb.r === 255 && rgb.g === 255 && rgb.b === 255
}

// --- OKLab / OKLCH -----------------------------------------------------
//
// Björn Ottosson's published matrices for OKLab, reproduced exactly — this
// is the definition of the space, the same numbers CSS Color 4 itself cites
// for the oklch() function, not a library standing in for the maths.
// linearRgbToOklab and oklabToLinearRgb are exact inverses of one another;
// the helper's own tests round-trip real colours through both to prove that
// rather than assert it.

interface Lab {
  L: number
  a: number
  b: number
}

function linearRgbToOklab(r: number, g: number, b: number): Lab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  }
}

function oklabToLinearRgb(lab: Lab): { r: number; g: number; b: number } {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  }
}

// The border-achromaticity check (D6 — "accent is a signal, never
// structure") reads chroma off this, regardless of how the token was
// written: a border authored as a hex literal is converted forward into
// OKLCH exactly the same as one authored as oklch() to begin with.
export function toOklch(rgb: Rgb): Oklch {
  const linear = {
    r: srgbToLinear(rgb.r / 255),
    g: srgbToLinear(rgb.g / 255),
    b: srgbToLinear(rgb.b / 255)
  }
  const lab = linearRgbToOklab(linear.r, linear.g, linear.b)
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: lab.L, c, h }
}

function oklchToRgb(oklch: Oklch, alpha: number): Rgb {
  const hueRadians = (oklch.h * Math.PI) / 180
  const lab: Lab = {
    L: oklch.l,
    a: oklch.c * Math.cos(hueRadians),
    b: oklch.c * Math.sin(hueRadians)
  }
  const linear = oklabToLinearRgb(lab)
  return {
    r: Math.round(linearToSrgb(linear.r) * 255),
    g: Math.round(linearToSrgb(linear.g) * 255),
    b: Math.round(linearToSrgb(linear.b) * 255),
    a: alpha
  }
}

// --- Parsing -------------------------------------------------------------
//
// The only two forms a palette token can take (see the test file for why):
// a hex literal, in the three widths CSS allows, or an oklch() function. A
// var() reference, color-mix() or a relative-colour expression all fall
// through to the thrown error below by design — a test that hits one is
// telling the truth about a token this reader genuinely cannot resolve.

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const HEX8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const OKLCH =
  /^oklch\(\s*([\d.]+%?|none)\s+([\d.]+%?|none)\s+([\d.]+(?:deg)?|none)(?:\s*\/\s*([\d.]+%?|none))?\s*\)$/i

// L and alpha read a 0-1 scale at 100%; chroma's percentage reference range
// is 0.4, per the CSS Color 4 definition of oklch() — a plain number in any
// of the three skips this and is taken as already being in the right units.
function component(token: string, scaleForPercent: number): number {
  if (token === 'none') return 0
  if (token.endsWith('%')) return (parseFloat(token) / 100) * scaleForPercent
  return parseFloat(token)
}

export function parseColor(raw: string): Rgb {
  const value = raw.trim()

  const hex8 = HEX8.exec(value)
  if (hex8) {
    const r = hex8[1] as string
    const g = hex8[2] as string
    const b = hex8[3] as string
    const a = hex8[4] as string
    return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16), a: parseInt(a, 16) / 255 }
  }

  const hex6 = HEX6.exec(value)
  if (hex6) {
    const r = hex6[1] as string
    const g = hex6[2] as string
    const b = hex6[3] as string
    return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16), a: 1 }
  }

  const hex3 = HEX3.exec(value)
  if (hex3) {
    const r = hex3[1] as string
    const g = hex3[2] as string
    const b = hex3[3] as string
    return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16), a: 1 }
  }

  const oklch = OKLCH.exec(value)
  if (oklch) {
    const lRaw = oklch[1] as string
    const cRaw = oklch[2] as string
    const hRaw = oklch[3] as string
    const aRaw = oklch[4]
    return oklchToRgb(
      { l: component(lRaw, 1), c: component(cRaw, 0.4), h: hRaw === 'none' ? 0 : parseFloat(hRaw) },
      aRaw === undefined ? 1 : component(aRaw, 1)
    )
  }

  throw new Error(`colour.ts cannot parse "${raw}" as a colour literal`)
}
