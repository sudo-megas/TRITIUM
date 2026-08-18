# Tritium glow — accent proposal for Default Light and Default Dark

Replaces the inherited jade accent (dark `#4a9d8e` / light `#2f7d6f`, OKLCH hue ≈180°,
straight cyan-teal) with a hue shifted 15° toward green, landing at **H=165°** — closer to
green than to cyan, matching the brief's "green, slightly cyan-shifted," and far enough from
jade's own hue that it reads as a new identity, not a renamed teal.

## Why H=165°

Gaseous tritium light sources (GTLS — the vials used in watch dials and gun sights) are
documented (Wikipedia, "Gaseous tritium light source") as using a ZnS phosphor that is
manufactured in several colours, of which **green is standard and the brightest** ("green
usually appears as the brightest colour, with a brightness as high as 2 cd/m²"). No primary
source gives a hex or wavelength for that green, so the hue below is my own calibration, not
a verified value.

Real sRGB approximations of that phosphor class (spring green, medium spring green, the classic
glow-stick green) cluster at OKLCH hue **141–157°**. Pure cyan sits at **194.8°**. Two other
effects push the *perceived* colour further toward cyan than the phosphor's own emission: dim
glowing objects are seen mostly with rod cells (scotopic vision), whose sensitivity peaks
around 507 nm — squarely in the cyan-green band — which is why tritium and glow-in-the-dark
objects read cooler in near-darkness than their phosphor's nominal colour (the Purkinje shift).

H=165° sits 20° above the phosphor-green reference band and 30° below true cyan: green-led,
cyan-shifted, not a 50/50 teal. It is 15° removed from the outgoing jade accent's H≈180°, so
the two are clearly different colours, not a relabelling.

## The four values

| Token | Hex | OKLCH | Lab L* |
|---|---|---|---|
| Default Dark `--accent` | `#67CFA5` | `oklch(0.7806 0.1156 164.92)` | 76.2 |
| Default Dark `--accent-hover` | `#63E3B1` | `oklch(0.8303 0.1353 164.75)` | 82.3 |
| Default Light `--accent` | `#067F5C` | `oklch(0.5293 0.1093 165.38)` | 47.0 |
| Default Light `--accent-hover` | `#00694A` | `oklch(0.4613 0.0976 164.54)` | 38.9 |

Rounded design formulas (what to re-derive from): **H = 165° throughout.**
- Dark accent: `oklch(0.78 0.115 165)`
- Dark accent-hover: `oklch(0.83 0.135 165)`
- Light accent: `oklch(0.53 0.109 165)`
- Light accent-hover: `oklch(0.46 0.098 165)`

Hover direction follows the palette's own dark/light convention (also used in Aubergine):
dark-theme hover brightens (+0.05 L, +0.02 C), light-theme hover deepens (-0.07 L).

## Contrast, computed against the surfaces given in the brief

WCAG 2.x relative-luminance contrast, both directions checked.

**Default Dark** — assumed `--surface #16161a`, `--surface-raised #1d1d22`:

| Pair | Ratio | vs 4.5:1 |
|---|---|---|
| accent vs surface | 9.49 | PASS |
| accent vs surface-raised | 8.83 | PASS |
| accent-hover vs surface | 11.30 | PASS |
| accent-hover vs surface-raised | 10.51 | PASS |

**Default Light** — assumed `--surface #fbfbfd`; exact `--surface-raised` wasn't given ("white-
adjacent-but-not-pure-white"), so I bounded it: checked against `#fbfbfd` itself as the lower
bound and pure `#ffffff` as the upper bound. Whatever final value that token settles on will
sit between these two numbers.

| Pair | Ratio | vs 4.5:1 |
|---|---|---|
| accent vs surface `#fbfbfd` | 4.84 | PASS |
| accent vs white `#ffffff` (upper bound) | 5.00 | PASS |
| accent-hover vs surface `#fbfbfd` | 6.51 | PASS |
| accent-hover vs white `#ffffff` (upper bound) | 6.73 | PASS |

Margins: dark theme clears 4.5:1 by roughly 2×; light theme clears it by ~1.08–1.11×. The dark
pair is robust to a fair amount of surface drift; the light pair is the one to re-check if the
Default Light surfaces move materially (see re-derivation below).

## Chroma discipline — why this isn't neon

The brief is explicit that this must glow, not shout. At H=165°, the sRGB chroma ceiling rises
with lightness (0.1157 at L=0.55, up to 0.1634 at L=0.78, 0.1851 at L=0.88). The dark-theme
accent uses C=0.1156 at L=0.78 — about 71% of the available ceiling there — deliberately held
back from the edge of the gamut so it reads as luminous rather than saturated (a glow-stick
green such as `#39FF14` sits at C=0.286, more than double). The dark hover state (C=0.135 at
L=0.83) is ~77% of its local ceiling — slightly more energised on interaction, still short of
neon.

The light-theme accent is a different story: at L=0.53 the gamut ceiling itself is only
C≈0.11, so C=0.1093 is essentially *at* the ceiling — this is what "raise chroma" means once
lightness has to drop for contrast: there is no more vividness available at that lightness in
sRGB, so using nearly all of it is what keeps the colour reading as a rich, deliberate green
rather than a washed-out sage. The absolute chroma is still moderate (0.11, not 0.25+), so it
doesn't read as neon despite sitting at its local ceiling.

## Text-pairing note (not asked for, but worth flagging before this ships as a button colour)

The two accents invert which text colour works on them:

- **Dark accent** (`#67CFA5`, light and bright): white text fails badly (1.90:1); near-black
  text passes easily (11.05:1). Needs dark text if used as a filled surface.
- **Light accent** (`#067F5C`, deep and saturated): white text passes (5.00:1); black text
  fails (4.20:1). Needs light text if used as a filled surface.

This is the opposite pairing from Aubergine's orange accent (which also wants dark text) —
worth keeping in mind if a shared "on-accent" text token is ever reused across palettes; it
isn't safe to reuse blindly.

## Re-deriving if the Default surfaces move

Hold **H=165° fixed** in both themes — that's the identity. Then:

- **Dark theme**: if `--surface` gets darker, the existing L=0.78/0.83 pair still clears 4.5:1
  with room to spare — no change needed unless the surface gets *much* lighter (approaching
  L*≈20+/`#2c2c33`-ish), in which case step accent L up by 0.01–0.02 and re-clamp C to the
  local gamut ceiling (ceiling table above).
- **Light theme**: this pair has the thinner margin. If `--surface` or `--surface-raised`
  lands lighter than `#fbfbfd` (unlikely, it's already near-white) the numbers only improve. If
  either lands *darker* than assumed, or if `--surface-raised` turns out to be meaningfully
  off-white (not just "adjacent to white"), recompute contrast first; if either pair drops
  under 4.5:1, step accent/accent-hover L down by 0.01–0.02 and re-clamp C to the local
  ceiling (≈0.106 at L=0.50, ≈0.11 at L=0.53) — don't change H.
