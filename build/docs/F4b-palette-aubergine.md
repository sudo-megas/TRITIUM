# Ubuntu Aubergine — sourcing and contrast report

## 1. Sourcing

### Verified — primary source, byte-exact

Fetched directly (`curl --compressed`, raw HTML, hex codes and labels extracted by pattern
match, not summarized by an intermediate model) from **https://design.ubuntu.com/brand/colour-palette**
— Canonical's own brand documentation site, page-stamped "© 2023 Canonical Ltd." and reached
via a working link from `design.ubuntu.com/brand`. Confirmed values, with the exact label text
adjacent to each swatch and the Pantone/CMYK print spec given on the page:

| Name (as labelled) | Hex | Print |
|---|---|---|
| Ubuntu orange | `#E95420` | Pantone 1665, C0 M79 Y100 K0 |
| White | `#FFFFFF` | — |
| Black | `#000000` | — |
| Light aubergine | `#77216F` | Pantone 512 |
| Mid aubergine | `#5E2750` | Pantone 511 |
| Dark aubergine | `#2C001E` | Pantone 7449 |
| Canonical aubergine | `#772953` | Pantone 683, C26 M99 Y12 K52 |
| Warm grey | `#AEA79F` | Pantone Warm Grey 5 |
| Cool grey | `#333333` | Pantone Cool Grey 11 |
| Text grey | `#111111` | Pantone Black 2 2X |

The page also gives full 10%–100% tint ramps for Ubuntu Orange, Canonical Aubergine, Light/Mid/
Dark Aubergine, and Warm Grey. These were used only as calibration/derivation input (see §3),
not shipped verbatim, except where noted below.

The page's own framing matches this task directly: it describes a "Canonical-focused" mode
where "aubergine is the core colour... orange is only used as a highlight" — i.e. exactly the
aubergine-grounded, orange-accented structure requested.

### Corroborating — primary source, Canonical's own GitHub

`vanillaframework.io/docs/settings/colours`, `vanillaframework.io/docs/colours`, and
`canonical.com/brand` / `canonical.com/brand/colours` all returned HTTP 404 (site reorganised
since those paths were last valid). I went to the source instead: **github.com/canonical/vanilla-framework**
(Canonical's own maintained design-system repo), read via `gh api` / raw file fetch, main
branch:

- `scss/_settings_colors.scss` — confirms `$color-ubuntu: #e95420` with the comment "Ubuntu
  orange, should not be overridden." Also carries Vanilla's own semantic palette, used only as
  *hue-family* anchors for danger/warning/success/info/focus below, not shipped verbatim:
  `$color-negative: #c7162b` / `#a11223` (dark), `$color-caution: #cc7900`, `$color-positive:
  #0e8420` / `#008013` (dark), `$color-information: #24598f`, `$color-focus: #2e96ff` / `#9cf`
  (dark).
- `tokens/color/{dark,light}/brand.json` — confirms `brand.ubuntu = #e95420` in both themes.
  It also shows Vanilla's *current interactive* accent is **teal** (`#0f95a1` light / `#70bbc2`
  dark), not orange or aubergine. That is a live, primary-sourced data point that Canonical's
  own design system avoids using orange as an interactive accent — direct corroboration that
  the orange-on-dark contrast problem this task calls out is real and already known to
  Canonical, not a problem I invented to justify extra work. TRITIUM uses orange anyway per
  the brief, solved honestly below rather than sidestepped.

### Not found / not verifiable

No Canonical source I could reach publishes an official dark-mode UI surface palette, or an
"aubergine ground + orange accent" accessibility pairing — the entire 17-token structure below
(surfaces, borders, text tokens, focus/selection, the four semantic colours, the eight-colour
chart series) is **my derivation**, anchored to the verified hues above but not itself
Canonical-sourced. Only two shipped tokens are verbatim brand hex:

- `--accent` = `#E95420` (verified Ubuntu Orange, unmodified)
- `--text-on-accent` = `#2C001E` (verified Dark Aubergine, reused as-is because it happens to
  clear the contrast bar against orange — see §2.4)

Everything else — including "aubergine hue ≈345°" as a surface/border anchor — is a derived
choice informed by the verified hue family, not a verified value itself. Chart-series and
semantic colours (`--danger`, `--warning`, `--success`, `--info`) also take hue-family
*direction* from Vanilla's semantic palette above but were independently re-built in OKLCH for
TRITIUM's much darker surfaces and stricter contrast floor.

## 2. Contrast table

All ratios computed with the standard WCAG 2.x relative-luminance formula
(`L = 0.2126R + 0.7152G + 0.0722B` on linearised sRGB, `(L1+0.05)/(L2+0.05)`), implemented and
self-tested against known references (black/white = 21.00 exactly; sRGB primaries' OKLCH
values matched published constants) before use.

Token values used below: `--surface #22111A` · `--surface-raised #2E2028` ·
`--surface-sunken #16030E` · `--text #F4EEF1` · `--text-muted #B6A6AE` ·
`--text-subtle #87747E` · `--text-on-accent #2C001E` · `--accent #E95420` ·
`--accent-hover #FD6A3B` · `--border #58454F` · `--border-strong #806875` ·
`--danger #E24E96` · `--warning #CF8700` · `--success #409D48` · `--info #009FD6` ·
`--focus-ring #61BEE6` · `--selection #5D2748`.

### Requirement 1 — text on all three surfaces ≥ 4.5:1

| Pair | Ratio | Result |
|---|---|---|
| text vs surface | 15.77 | PASS |
| text vs surface-raised | 13.56 | PASS |
| text vs surface-sunken | 17.42 | PASS |

### Requirement 2 — text-muted on surface / surface-raised ≥ 4.5:1

| Pair | Ratio | Result |
|---|---|---|
| text-muted vs surface | 7.78 | PASS |
| text-muted vs surface-raised | 6.69 | PASS |
| text-muted vs surface-sunken (bonus, not required) | 8.60 | PASS |

### Requirement 3 — text-subtle on surface ≥ 3:1

| Pair | Ratio | Result |
|---|---|---|
| text-subtle vs surface | 4.15 | PASS |
| text-subtle vs surface-raised (bonus) | 3.57 | PASS |
| text-subtle vs surface-sunken (bonus) | 4.58 | PASS |

### Requirement 4 — text-on-accent on accent ≥ 4.5:1 (both directions checked)

| Pair | Ratio | Result |
|---|---|---|
| **white** on accent | 3.65 | **FAIL** |
| **Dark Aubergine `#2C001E`** on accent | 5.11 | **PASS** |

Confirms the brief's own hint: white text on Ubuntu Orange fails outright; dark text is
required. `--text-on-accent` ships as the verified Dark Aubergine value — it independently
clears the bar, so no invented near-black was needed. It also holds against `--accent-hover`
(6.49:1), so it stays correct if reused on the hover state.

### Requirement 5 — accent on surface AND surface-raised ≥ 3:1 (binding)

| Pair | Ratio | Result |
|---|---|---|
| accent vs surface | 4.95 | PASS |
| accent vs surface-raised | 4.25 | PASS |

### Requirement 6 — border contrast bands

| Pair | Ratio | Target | Result |
|---|---|---|---|
| border vs surface | 2.05 | 1.5–2.3:1 | PASS |
| border-strong vs surface | 3.57 | ≥3:1 | PASS |

### Requirement 7 — focus-ring ≥ 3:1 vs both surfaces, distinct from accent-hover

| Pair | Ratio | Result |
|---|---|---|
| focus-ring vs surface | 8.61 | PASS |
| focus-ring vs surface-raised | 7.40 | PASS |

focus-ring (`#61BEE6`, cool blue, H≈228.6°) vs accent-hover (`#FD6A3B`, warm orange, H≈37.8°):
hue delta 169.2° — effectively opposite sides of the wheel. Chosen deliberately, following the
same precedent as Vanilla Framework's own focus colour (`#2e96ff`/`#9cf`), which is blue even
though Vanilla's brand accent is orange/teal — a blue focus ring reads as "focused," full stop,
regardless of the brand accent hue.

### Requirement 8 — semantic colours ≥ 4.5:1 vs surface; danger vs accent by hue

| Pair | Ratio | Result |
|---|---|---|
| danger vs surface | 4.96 | PASS |
| warning vs surface | 6.12 | PASS |
| success vs surface | 5.27 | PASS |
| info vs surface | 5.96 | PASS |

**Danger-vs-accent hue collision, solved:** Ubuntu Orange sits at OKLCH H=37.76°. Reference
"danger reds" from real design systems — pure `#FF0000` (H=29.2°), Material red-500 (28.8°),
Tailwind red-600 (27.3°), Bootstrap danger (21.2°), GitHub danger (24.5°), even the web colour
Crimson (20.1°) and Vanilla's own `$color-negative` (23.6°) — all cluster at H=20–29°, only
9–18° from the orange accent. That's the collision the brief warns about, and it isn't
TRITIUM-specific: it shows up across the industry because "true red" (the hue where a colour's
green and blue channels are balanced, i.e. neither pink- nor orange-leaning, at usable
lightness) sits right around H≈25–26° in sRGB/OKLCH — verified by scanning G-vs-B channel
balance at C=0.20 across hues 0–38° at five lightness levels; the crossover consistently landed
at H≈24–26° regardless of L.

There's no hue in that hard-red zone that gets meaningfully further from orange, so `--danger`
was deliberately rotated to **H=354°** (`#E24E96`) — a crimson, not a fire-engine red. That
gives 43.8° of hue separation from the accent (more than double any industry pairing checked
above) while staying less "pink" than Crimson itself by the numbers: `--danger`'s blue/green
channel ratio is 2.03, Crimson's is 3.00. It also sits close to the aubergine ground's own hue
(~345°), so it reads as "the brand hue turned urgent" rather than an unrelated colour dropped
in. Danger vs warning (H=71.9°) is 78° apart; danger vs every other semantic/accent hue is
≥34° apart — no pairwise collision anywhere in the set.

### Requirement 9 — adjacent surface steps 1.1–1.5:1 (~4–11 L\*)

| Pair | Ratio | ΔL\* | Result |
|---|---|---|---|
| surface-sunken → surface | 1.10 | 4.95 | PASS |
| surface → surface-raised | 1.16 | 6.85 | PASS |

Note: `--surface-sunken` (`#16030E`, L\*=2.42) is darker than Dark Aubergine itself (L\*=5.68).
That's intentional, not an error — sunken is the recessed-well treatment (search inputs, code
blocks), meant to read as the deepest surface in the stack, and it still passes "no pure black"
(non-zero hue and lightness, not `#000000`) and the adjacency-ratio floor with the step above
it. Flagging it explicitly since it's the one surface value pushed past a verified brand anchor
rather than sitting close to one.

### Requirement 10 — no pure black surface, no pure white text

| Check | Value | Result |
|---|---|---|
| surface ≠ #000000 | #22111A | PASS |
| surface-sunken ≠ #000000 | #16030E | PASS |
| text ≠ #FFFFFF | #F4EEF1 | PASS |

### Requirement 11 — border chroma

Both border tokens use the **aubergine-ground hue-inheritance allowance** (chroma ≤0.04
instead of the fully-achromatic ≤0.02 floor), stated here explicitly as the rule requires:

| Token | Chroma | Hue | Limit | Result |
|---|---|---|---|---|
| border | 0.0302 | 345.6° | ≤0.04 | PASS |
| border-strong | 0.0359 | 344.6° | ≤0.04 | PASS |

Both inherit the surface hue (~345°) rather than going neutral grey — on this strongly
chromatic ground it reads more integrated than a flat grey border would.

### Requirement 12 — eight-colour chart series

| Token | Hex | vs surface | Result |
|---|---|---|---|
| accent-seq-1 | #E26943 | 5.45 | PASS |
| accent-seq-2 | #CF9B20 | 7.19 | PASS |
| accent-seq-3 | #6B961E | 5.16 | PASS |
| accent-seq-4 | #2BB091 | 6.64 | PASS |
| accent-seq-5 | #00A3C2 | 6.03 | PASS |
| accent-seq-6 | #6790E2 | 5.73 | PASS |
| accent-seq-7 | #A584DC | 5.96 | PASS |
| accent-seq-8 | #C361A5 | 4.79 | PASS |

Hues run 38°/83°/128°/173°/218°/263°/300°/340° — minimum pairwise gap 37° (between seq-6 and
seq-7), every other gap 40–45°. Series 1 deliberately echoes the accent's own hue family (a
common convention: category 1 = brand colour); series 8 was pulled in from an initial 353°
(nearly identical to `--danger`'s 354°) to 340° specifically to avoid a chart colour reading as
"the danger colour" out of context.

## 3. Summary

All 12 numbered requirements PASS, with comfortable margins everywhere except border-strong
(3.57 against a 3.0 floor, ~19% margin) and text-subtle (4.15 against a 3.0 floor, ~38%
margin) — neither is razor-thin. Two tokens are verbatim verified Canonical brand hex
(`--accent`, `--text-on-accent`); everything else is a from-scratch OKLCH derivation anchored
to the verified aubergine (~332–350° hue family) and Ubuntu Orange (37.76°) hues, built and
checked against the WCAG formula rather than eyeballed.
