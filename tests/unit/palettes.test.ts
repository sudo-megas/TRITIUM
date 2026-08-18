// F4b rewrites palettes.css from garish placeholders to eleven real palettes
// (build/docs/F4b.md §4): seventeen tokens each, plus an eight-entry chart
// series, and a contract that is arithmetic rather than taste — WCAG
// contrast floors, an achromatic-border rule, and the binding constraint
// that --accent clears 3:1 against both surface tokens (D6). None of that is
// visible by reading the file, so this test parses it and runs the same
// maths a browser's own contrast checker runs, reproduced here rather than
// borrowed from one, so a failure means the palette is actually wrong and
// not that two tools disagree with each other.
//
// The test proves itself before it judges anyone else. tests/fixtures/
// palettes/clean.css is a hand-verified palette, computed against these same
// formulas before it was written, that must clear every rule below.
// tests/fixtures/palettes/offender.css breaks one rule per token, on
// purpose, so "the fixture palette built to fail" can show each check
// catching the specific thing it claims to catch.
//
// palettes.css itself is being rewritten elsewhere in this milestone, at the
// same time this file is being written. Today it still carries the old
// ten-token names (--bg, --fg, --line, ...) and ten placeholder palettes
// named p01…p10. That means every assertion in "the real file" below is
// expected to fail, loudly and specifically, until the rewrite lands — that
// failure is this test doing its job, not a bug in it.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  isPureBlack,
  isPureWhite,
  lightness,
  parseColor,
  relativeLuminance,
  sameColor,
  toOklch
} from './lib/colour.js'
import type { Rgb } from './lib/colour.js'

// --- The token contract (F4b §2.1 D2, D3, D5) -----------------------------

const PALETTE_SLUGS = [
  'default-light',
  'default-dark',
  'noctalia',
  'catppuccin-latte',
  'catppuccin-frappe',
  'catppuccin-macchiato',
  'catppuccin-mocha',
  'rose-pine-dawn',
  'nord',
  'kanagawa-lotus',
  'aubergine'
] as const

const SCALAR_TOKENS = [
  '--surface',
  '--surface-raised',
  '--surface-sunken',
  '--border',
  '--border-strong',
  '--text',
  '--text-muted',
  '--text-subtle',
  '--text-on-accent',
  '--accent',
  '--accent-hover',
  '--danger',
  '--warning',
  '--success',
  '--info',
  '--focus-ring',
  '--selection'
] as const

const SEQUENCE_TOKENS = Array.from({ length: 8 }, (_, index) => `--accent-seq-${index + 1}`)

const ALL_EXPECTED_TOKENS = new Set<string>([...SCALAR_TOKENS, ...SEQUENCE_TOKENS])

// JADEITE's surfaceOverlay — "menus and dialogs floating above everything" —
// is the one token D1 refuses to port. Its absence is load-bearing, not
// incidental, so it gets checked by name rather than folded into "unexpected
// token" (which would also catch it, but with a message that undersells why).
const FORBIDDEN_TOKEN = '--surface-overlay'

// --- Reading a stylesheet --------------------------------------------------
//
// Not a CSS parser — palettes.css has no @media, no nesting and no at-rules,
// so "strip comments, then read flat selector{body} pairs" is a complete and
// safe description of its grammar. A rule's selector list may pair :root
// with one or more `[data-palette='slug']` attributes (the file's own
// default block does exactly this); every slug named in that list gets the
// same declarations.

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function readDeclarations(body: string): Array<[string, string]> {
  return [...body.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+);?/g)].map((match) => [
    match[1] as string,
    (match[2] as string).trim()
  ])
}

function parseStylesheet(css: string): Map<string, Map<string, string>> {
  const clean = stripComments(css)
  const palettes = new Map<string, Map<string, string>>()

  for (const rule of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1] as string
    const body = rule[2] as string

    const slugs = [...selector.matchAll(/data-palette\s*=\s*(['"])([\w-]+)\1/g)].map(
      (match) => match[2] as string
    )
    if (slugs.length === 0) continue

    const declarations = readDeclarations(body)
    for (const slug of slugs) {
      const tokens = palettes.get(slug) ?? new Map<string, string>()
      for (const [name, value] of declarations) tokens.set(name, value)
      palettes.set(slug, tokens)
    }
  }

  return palettes
}

// --- The token contract, checked -------------------------------------------
//
// One function, shared by the fixtures and the real file, so that "a good
// palette passes" and "the real file currently fails" are provably the same
// check rather than two implementations that could quietly drift apart. It
// never throws: a missing or unparsable token is itself reported and every
// check that depends on it is skipped, so one bad token produces one clear
// line instead of an exception that hides every other finding in the file.
function checkPalette(slug: string, tokens: Map<string, string> | undefined): string[] {
  const problems: string[] = []
  const note = (message: string): void => {
    problems.push(`${slug}: ${message}`)
  }

  if (tokens === undefined) {
    note("no [data-palette='...'] block for this slug exists in the stylesheet")
    return problems
  }

  for (const name of SCALAR_TOKENS) {
    if (!tokens.has(name)) note(`missing token ${name}`)
  }
  for (const name of SEQUENCE_TOKENS) {
    if (!tokens.has(name)) note(`missing token ${name}`)
  }
  for (const name of tokens.keys()) {
    if (!ALL_EXPECTED_TOKENS.has(name))
      note(`unexpected token ${name} (typo, or a stray left behind)`)
  }
  if (tokens.has(FORBIDDEN_TOKEN)) {
    note(
      `forbidden token ${FORBIDDEN_TOKEN} is present — D1 abolishes the concept, not just the name`
    )
  }

  const resolve = (name: string): Rgb | undefined => {
    const raw = tokens.get(name)
    if (raw === undefined) return undefined
    try {
      return parseColor(raw)
    } catch {
      note(`token ${name} does not parse as a colour: "${raw}"`)
      return undefined
    }
  }

  const contrast = (
    fgName: string,
    fg: Rgb | undefined,
    bgName: string,
    bg: Rgb | undefined,
    minRatio: number
  ): void => {
    if (fg === undefined || bg === undefined) return
    const ratio = contrastRatio(fg, bg)
    if (ratio < minRatio) {
      note(`${fgName} on ${bgName} is ${ratio.toFixed(2)}:1, needs >= ${minRatio}:1`)
    }
  }

  const surface = resolve('--surface')
  const surfaceRaised = resolve('--surface-raised')
  const surfaceSunken = resolve('--surface-sunken')
  const border = resolve('--border')
  const borderStrong = resolve('--border-strong')
  const text = resolve('--text')
  const textMuted = resolve('--text-muted')
  const textSubtle = resolve('--text-subtle')
  const textOnAccent = resolve('--text-on-accent')
  const accent = resolve('--accent')
  const accentHover = resolve('--accent-hover')
  const danger = resolve('--danger')
  const warning = resolve('--warning')
  const success = resolve('--success')
  const info = resolve('--info')
  const focusRing = resolve('--focus-ring')
  resolve('--selection') // must parse; the token carries no contrast requirement of its own

  const sequence = SEQUENCE_TOKENS.map((name) => ({ name, rgb: resolve(name) }))

  // Text on every surface it appears on.
  contrast('--text', text, '--surface', surface, 4.5)
  contrast('--text', text, '--surface-raised', surfaceRaised, 4.5)
  contrast('--text', text, '--surface-sunken', surfaceSunken, 4.5)
  contrast('--text-muted', textMuted, '--surface', surface, 4.5)
  contrast('--text-muted', textMuted, '--surface-raised', surfaceRaised, 4.5)
  contrast('--text-subtle', textSubtle, '--surface', surface, 3)
  contrast('--text-on-accent', textOnAccent, '--accent', accent, 4.5)

  // The binding constraint (D6): accent against both surface tokens.
  contrast('--accent', accent, '--surface', surface, 3)
  contrast('--accent', accent, '--surface-raised', surfaceRaised, 3)

  // Structure: borders and the focus indicator.
  contrast('--border-strong', borderStrong, '--surface', surface, 3)
  if (border !== undefined && surface !== undefined) {
    const ratio = contrastRatio(border, surface)
    if (ratio < 1.5) note(`--border on --surface is ${ratio.toFixed(2)}:1, needs >= 1.5:1`)
    if (ratio > 2.6) note(`--border on --surface is ${ratio.toFixed(2)}:1, needs <= 2.6:1`)
  }
  contrast('--focus-ring', focusRing, '--surface', surface, 3)
  contrast('--focus-ring', focusRing, '--surface-raised', surfaceRaised, 3)

  // The four status colours.
  contrast('--danger', danger, '--surface', surface, 4.5)
  contrast('--warning', warning, '--surface', surface, 4.5)
  contrast('--success', success, '--surface', surface, 4.5)
  contrast('--info', info, '--surface', surface, 4.5)

  // The chart series.
  for (const { name, rgb } of sequence) {
    contrast(name, rgb, '--surface', surface, 3)
  }

  /*
   * Surface separation, measured in CIE L* rather than in a contrast ratio.
   *
   * The ratio is the wrong instrument here and using it produced a false
   * result: its formula carries a +0.05 flare term that dominates whenever
   * both colours are dark, so two plainly different near-black grounds score
   * about 1.03 while two near-white ones scoring the same are genuinely much
   * closer together. Judged that way, seven of the eleven palettes looked
   * broken and none of them was. L* is perceptual and has no such floor.
   *
   * The two steps are held to different bars because they do different work.
   * `--surface-raised` is what makes the tab bar, the controls and the cards
   * read as their own surfaces, sometimes with nothing but fill to say so, and
   * it is held to 2 L*. `--surface-sunken` is never seen against `--surface`
   * without a border between them anywhere in this interface — the licence
   * block, the buttons and the scrollbar track all carry one — so for it the
   * bar is the one the palettes must genuinely meet: it may not be the same
   * colour, and it may not be indistinguishable from it.
   *
   * This matters because the surfaces are the most identity-bearing values a
   * palette has. Catppuccin's base/mantle/crust and Rosé Pine's base/surface
   * ARE those palettes; forcing them apart to satisfy a number would ship
   * something wearing their names that they never chose.
   */
  const RAISED_STEP = 2
  const SUNKEN_STEP = 1

  const surfacePairs: Array<[string, Rgb | undefined, string, Rgb | undefined, number]> = [
    ['--surface', surface, '--surface-raised', surfaceRaised, RAISED_STEP],
    ['--surface', surface, '--surface-sunken', surfaceSunken, SUNKEN_STEP]
  ]
  for (const [aName, a, bName, b, floor] of surfacePairs) {
    if (a === undefined || b === undefined) continue
    if (sameColor(a, b)) note(`${aName} and ${bName} must not be the same colour`)
    const step = Math.abs(lightness(a) - lightness(b))
    if (step < floor) {
      note(`${aName} vs ${bName} is only ${step.toFixed(1)} L* apart, needs >= ${floor}`)
    }
  }

  // No extremes: no surface is pure black, no text is pure white.
  const surfaceTokens: Array<[string, Rgb | undefined]> = [
    ['--surface', surface],
    ['--surface-raised', surfaceRaised],
    ['--surface-sunken', surfaceSunken]
  ]
  for (const [name, rgb] of surfaceTokens) {
    if (rgb !== undefined && isPureBlack(rgb))
      note(`${name} is pure black — no surface may be #000000`)
  }
  const textTokens: Array<[string, Rgb | undefined]> = [
    ['--text', text],
    ['--text-muted', textMuted],
    ['--text-subtle', textSubtle],
    ['--text-on-accent', textOnAccent]
  ]
  for (const [name, rgb] of textTokens) {
    if (rgb !== undefined && isPureWhite(rgb))
      note(`${name} is pure white — no text may be #ffffff`)
  }

  // Focus distinguishable (SC 2.4.13): the >=3:1 half of this is already the
  // --focus-ring contrast checks above; this is the other half — focus and
  // hover must not resolve to the same pixels.
  if (focusRing !== undefined && accentHover !== undefined && sameColor(focusRing, accentHover)) {
    note(
      '--focus-ring must not equal --accent-hover — the focused and unfocused states would be the same pixels'
    )
  }

  // Achromatic borders (D6): colour is a signal, never structure.
  if (border !== undefined) {
    const chroma = toOklch(border).c
    if (chroma > 0.04) note(`--border has OKLCH chroma ${chroma.toFixed(4)}, needs <= 0.04`)
  }
  if (borderStrong !== undefined) {
    const chroma = toOklch(borderStrong).c
    if (chroma > 0.04) note(`--border-strong has OKLCH chroma ${chroma.toFixed(4)}, needs <= 0.04`)
  }

  // Series distinguishability: all eight entries pairwise distinct.
  for (let i = 0; i < sequence.length; i += 1) {
    for (let j = i + 1; j < sequence.length; j += 1) {
      const a = sequence[i]
      const b = sequence[j]
      if (a?.rgb !== undefined && b?.rgb !== undefined && sameColor(a.rgb, b.rgb)) {
        note(`${a.name} and ${b.name} are the same colour — all eight must be distinct`)
      }
    }
  }

  return problems
}

function loadFixture(name: string): string {
  const path = fileURLToPath(new URL(`../fixtures/palettes/${name}`, import.meta.url))
  return readFileSync(path, 'utf8')
}

// --- The colour helper itself ----------------------------------------------

describe('the colour helper', () => {
  it('rates black against white at the textbook extreme, and white against itself at the other', () => {
    // (1 + 0.05) / (0 + 0.05) = 21, and (1 + 0.05) / (1 + 0.05) = 1 — both
    // exact identities of the WCAG formula, not approximations of it.
    expect(relativeLuminance(parseColor('#000000'))).toBe(0)
    expect(relativeLuminance(parseColor('#ffffff'))).toBe(1)
    expect(contrastRatio(parseColor('#000000'), parseColor('#ffffff'))).toBe(21)
    expect(contrastRatio(parseColor('#ffffff'), parseColor('#ffffff'))).toBe(1)
    expect(contrastRatio(parseColor('#000000'), parseColor('#000000'))).toBe(1)
  })

  it('does not care which colour is passed first', () => {
    const a = parseColor('#1256d6')
    const b = parseColor('#f1f1f5')
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a))
  })

  it('matches the independently documented WCAG reference greys', () => {
    // #767676 is the grey WebAIM's own contrast checker cites as the
    // darkest one that still just clears 4.5:1 on white; #949494 is the one
    // it cites for the 3:1 non-text floor — verified here against the
    // formula itself rather than trusted from that citation.
    expect(contrastRatio(parseColor('#767676'), parseColor('#ffffff'))).toBeCloseTo(4.5, 1)
    expect(contrastRatio(parseColor('#949494'), parseColor('#ffffff'))).toBeCloseTo(3, 1)

    // The same #949494 against black — not white — is nowhere near 3:1. The
    // background it is paired with is not a detail: get it wrong and a
    // grey that is a documented "just passes" example on one background
    // becomes a "comfortably clears everything" example on the other.
    expect(contrastRatio(parseColor('#949494'), parseColor('#000000'))).toBeCloseTo(6.92, 1)

    // A second, independent 3:1 anchor, this time light-on-dark.
    expect(contrastRatio(parseColor('#595959'), parseColor('#000000'))).toBeCloseTo(3, 1)
  })

  it('parses the three hex widths a palette token may use', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#1256d6')).toEqual({ r: 18, g: 86, b: 214, a: 1 })

    const withAlpha = parseColor('#1256d633')
    expect(withAlpha.r).toBe(18)
    expect(withAlpha.g).toBe(86)
    expect(withAlpha.b).toBe(214)
    expect(withAlpha.a).toBeCloseTo(0.2, 5)
  })

  it('parses oklch() to the same rgb as the equivalent hex literal', () => {
    expect(parseColor('oklch(0 0 0)')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseColor('oklch(1 0 0)')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('oklch(0.5139 0.1091 161.63)')).toEqual({ r: 15, g: 122, b: 83, a: 1 })
  })

  it('accepts an optional deg suffix on the hue and an optional alpha', () => {
    const bare = parseColor('oklch(0.4991 0.2071 261.77)')
    const withDeg = parseColor('oklch(0.4991 0.2071 261.77deg)')
    expect(withDeg).toEqual(bare)

    const withAlpha = parseColor('oklch(0.4991 0.2071 261.77 / 50%)')
    expect(withAlpha.r).toBe(bare.r)
    expect(withAlpha.a).toBeCloseTo(0.5, 5)
  })

  it('treats "none" as zero in any oklch() component', () => {
    const grey = parseColor('oklch(50% none 0)')
    expect(grey.r).toBe(grey.g)
    expect(grey.g).toBe(grey.b)
  })

  it('refuses anything that is not a literal colour — no var(), no color-mix()', () => {
    // A derived value is exactly what this reader cannot and should not
    // guess at; palettes.css must ship literals for the tokens this test
    // checks, and a thrown error here is that requirement working.
    expect(() => parseColor('var(--surface)')).toThrow()
    expect(() => parseColor('color-mix(in oklch, red, blue)')).toThrow()
  })

  it('reads zero chroma for a grey and real chroma for a saturated colour', () => {
    expect(toOklch(parseColor('#808080')).c).toBeLessThan(0.0001)
    expect(toOklch(parseColor('#ffffff')).c).toBeLessThan(0.0001)
    expect(toOklch(parseColor('#ff0000')).c).toBeGreaterThan(0.2)
    expect(toOklch(parseColor('#0000ff')).c).toBeGreaterThan(0.2)
  })

  it('round-trips a colour through OKLCH and back to the same sRGB bytes', () => {
    // linearRgbToOklab and oklabToLinearRgb are meant to be exact inverses;
    // this is that claim, checked, rather than assumed from the algebra.
    for (const hex of ['#767676', '#0f7a53', '#c6c6cf', '#1256d6', '#ffffff', '#000000']) {
      const original = parseColor(hex)
      const { l, c, h } = toOklch(original)
      // toFixed rather than raw interpolation: a near-zero chroma prints in
      // exponential notation (2.1e-8) by default, which oklch() cannot read.
      const back = parseColor(`oklch(${l.toFixed(6)} ${c.toFixed(6)} ${h.toFixed(6)})`)
      expect([back.r, back.g, back.b]).toEqual([original.r, original.g, original.b])
    }
  })
})

// --- Reading a palette stylesheet ------------------------------------------

describe('reading a palette stylesheet', () => {
  it('pairs :root with whichever slug shares its selector list', () => {
    const css = `
      :root,
      [data-palette='default-light'] {
        --surface: #ffffff;
      }
    `
    const parsed = parseStylesheet(css)
    expect(parsed.get('default-light')?.get('--surface')).toBe('#ffffff')
  })

  it('keeps two different palette blocks apart, single or double quoted', () => {
    const css = `
      [data-palette='a'] { --surface: #111111; }
      [data-palette="b"] { --surface: #222222; }
    `
    const parsed = parseStylesheet(css)
    expect(parsed.get('a')?.get('--surface')).toBe('#111111')
    expect(parsed.get('b')?.get('--surface')).toBe('#222222')
  })

  it('never reads a token mentioned only inside a single-line comment', () => {
    const css = `
      [data-palette='a'] {
        /* --surface-overlay: #ff00ff; -- do not add this back */
        --surface: #ffffff;
      }
    `
    const parsed = parseStylesheet(css)
    expect(parsed.get('a')?.has('--surface-overlay')).toBe(false)
    expect(parsed.get('a')?.get('--surface')).toBe('#ffffff')
  })

  it('is not confused by a block comment spanning several lines with its own punctuation', () => {
    const css = `
      [data-palette='a'] {
        /*
         * a block comment with its own colons and semicolons, including a
         * fake declaration --danger: #ff0000; right here
         */
        --surface: #ffffff;
      }
    `
    const parsed = parseStylesheet(css)
    expect(parsed.get('a')?.size).toBe(1)
    expect(parsed.get('a')?.has('--danger')).toBe(false)
  })
})

// --- The fixture proof of work ----------------------------------------------

describe('the fixture palette built to pass', () => {
  const parsed = parseStylesheet(loadFixture('clean.css'))
  const tokens = parsed.get('fixture-clean')

  it('is present in the fixture stylesheet at all', () => {
    expect(tokens).toBeDefined()
  })

  it('has zero violations against the full token contract', () => {
    const violations = checkPalette('fixture-clean', tokens)
    expect(violations, violations.join('\n')).toEqual([])
  })
})

describe('the fixture palette built to fail', () => {
  const parsed = parseStylesheet(loadFixture('offender.css'))
  const tokens = parsed.get('fixture-broken')
  const violations = checkPalette('fixture-broken', tokens)
  const report = violations.join('\n')

  it('is not silently accepted', () => {
    expect(violations.length).toBeGreaterThan(0)
  })

  it('catches --surface and --surface-raised being identical, both ways the rule states it', () => {
    expect(report).toContain('--surface and --surface-raised must not be the same colour')
    expect(report).toContain('--surface vs --surface-raised is only 0.0 L* apart')
  })

  it('catches the pure black --surface-sunken', () => {
    expect(report).toContain('--surface-sunken is pure black')
  })

  it('catches the chromatic --border', () => {
    expect(report).toContain('--border has OKLCH chroma')
  })

  it('catches --border-strong sitting too close to --surface', () => {
    expect(report).toMatch(/--border-strong on --surface is 1\.\d\d:1, needs >= 3:1/)
  })

  it('catches --text, --text-muted and --text-subtle all failing their floors', () => {
    expect(report).toContain('--text on --surface is')
    expect(report).toContain('--text-muted on --surface is')
    expect(report).toContain('--text-subtle on --surface is')
  })

  it('catches --text-on-accent as both a pure-white extreme and a low-contrast pairing', () => {
    expect(report).toContain('--text-on-accent is pure white')
    expect(report).toContain('--text-on-accent on --accent is')
  })

  it('catches --accent failing the binding 3:1 constraint on both surfaces', () => {
    expect(report).toContain('--accent on --surface is')
    expect(report).toContain('--accent on --surface-raised is')
  })

  it('catches --danger, --success and --info all failing their 4.5:1 floor', () => {
    expect(report).toContain('--danger on --surface is')
    expect(report).toContain('--success on --surface is')
    expect(report).toContain('--info on --surface is')
  })

  it('catches the missing --warning token', () => {
    expect(report).toContain('missing token --warning')
  })

  it('catches --focus-ring equalling --accent-hover', () => {
    expect(report).toContain('--focus-ring must not equal --accent-hover')
  })

  it('catches the stray --acent typo', () => {
    expect(report).toContain('unexpected token --acent')
  })

  it('catches the forbidden --surface-overlay', () => {
    expect(report).toContain('forbidden token --surface-overlay is present')
  })

  it('catches the duplicated sequence colour', () => {
    expect(report).toContain('--accent-seq-1 and --accent-seq-2 are the same colour')
  })

  it('catches the low-contrast sequence colour', () => {
    expect(report).toContain('--accent-seq-8 on --surface is')
  })
})

// --- src/renderer/styles/palettes.css — the real file -----------------------

describe('src/renderer/styles/palettes.css — the real file', () => {
  const realCss = readFileSync(
    fileURLToPath(new URL('../../src/renderer/styles/palettes.css', import.meta.url)),
    'utf8'
  )
  const parsed = parseStylesheet(realCss)

  it('never mentions --surface-overlay anywhere, not just inside a well-formed block', () => {
    // Checked directly against the whole stripped file rather than through
    // checkPalette, which only looks inside the eleven named blocks below —
    // §4 item 5 retires the concept outright, wherever it might appear.
    expect(stripComments(realCss)).not.toContain(FORBIDDEN_TOKEN)
  })

  it('defines a block for all eleven canonical palettes', () => {
    const missing = PALETTE_SLUGS.filter((slug) => !parsed.has(slug))
    expect(missing, `missing palette blocks: ${missing.join(', ') || 'none'}`).toEqual([])
  })

  for (const slug of PALETTE_SLUGS) {
    it(`${slug} satisfies the full token contract — completeness, contrast and geometry`, () => {
      const violations = checkPalette(slug, parsed.get(slug))
      expect(violations, violations.join('\n')).toEqual([])
    })
  }
})
