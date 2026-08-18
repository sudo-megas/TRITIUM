# TRITIUM — F4b · v0.1.4 · «Design»

The milestone where the app stops looking like a test fixture.

F1 through F4 built a frame and filled it with working parts wearing colour
chosen to be *wrong*. `palettes.css` says so out loud: "deliberately garish so
that nobody mistakes it for the design phase's output." That placeholder has now
outlived its purpose. F4 computes a real figure — litres per hundred kilometres
between full tanks — and shows it in magenta on near-black, in a table with no
rhythm.

The maker's ruling opening this milestone: **the app must be gloriously good
looking, and that is the reason Electron was chosen in the first place.** A
renderer with the whole of CSS available is a strange thing to pick if the result
looks like a form from 2006. F4b is where that choice is cashed in.

**F4b is a regular milestone and takes the next version bump: v0.1.4.**
Consequence, recorded rather than left to be discovered: XTRITIUM §9.1's printed
table maps F5 → v0.1.4, so from F5 onward every entry now reads one off. The map
is `F(n) → v0.1.(n−1)` up to F4 and `F(n) → v0.1.(n)` from F5. §11.5 already
reserves the full F-map as open, so this resolves something open rather than
contradicting something settled — but §9.1's table is now stale and wants the
maker's pen.

The outside evidence for this document is `build/docs/F4b-draft.md`: six
researchers, every claim marked fetched, search-only or unverified. Where F4b
departs from a source it does so knowingly.

---

## 1. WHERE F4b SITS

XTRITIUM §11 reserved five things for "the design phase". F4b closes the first
three:

1. Final tab list and what lives in each pane of the two-pane layout.
2. Visual design of forms, tables, cards; spacing and density.
3. The eleven palettes' exact values.

§11.4 (subtitle wording, README banner, icon artwork) and §11.5 (the F-map) stay
open — neither is visual-design work and the artwork is the maker's to supply.

### 1.1 What the constitution already fixed, and F4b may not move

| Fixed by | What |
|---|---|
| §7 | Top tab bar above two big panes. Deliberately not a sidebar |
| §7 | **The compositor draws the decorations.** Minimum 1280 × 720 |
| §7 | Dense tables (TanStack), with the charts' time-range chips |
| §7 | No search. No keyboard shortcuts. No tray, no autostart |
| §7 | Empty cells in the same layout as a filled app |
| §8 | **CaskaydiaCove Nerd Font Mono for the whole UI.** Icons are the Font Awesome glyphs patched into it |
| §8 | Eleven palettes as CSS custom properties, switched instantly |
| §8 | `1.234,56 ₺` and `GG/AA/YYYY`, in both languages |

Two of these cost F4b a great deal of otherwise-standard advice:

- **The compositor draws the decorations**, so every technique built on a
  frameless window is unavailable: custom title bars, `titleBarOverlay`,
  traffic-light insets, drag regions. One caveat found in research and recorded
  here: on GNOME/Wayland this is not literally true — Electron ships
  `ClientFrameViewLinux`, which paints a GTK-styled frame itself, while KDE's
  kwin is more likely to give genuine server-side decoration. The two major Linux
  desktops do not necessarily frame TRITIUM by the same mechanism.
- **No shortcuts and no search** removes the command palette — the single
  most-cited "modern power-user" pattern of the period, and an overlay in every
  documented implementation. It was already out on §7's authority before the
  no-overlap rule reached it.

### 1.2 The standing aesthetic law

Written once already, for JADEITE, and inherited here without re-argument:

- **"This is not a kid's-play app — colours must never be chaotic; clarity must
  be high."** (XJADEITE §12.3)
- **"Palette-consistent, never carnival."** (XJADEITE §7.2)
- **"The app must never animate itself into looking busy. Transitions are
  opt-in, never global."** (JADEITE `tokens.css`)
- **Accents are muted toward the palette's own surface tones** before they ever
  reach a pixel. (XJADEITE §12.3)

### 1.3 What "gloriously good looking" therefore means

There is an apparent tension between "eye-candy" and "never carnival". It
resolves cleanly, and the resolution is this milestone's thesis:

**The glory comes from craft, not decoration.** TRITIUM is mostly columns of
numbers. Nothing added on top of a number column improves it — gradients, glows,
translucency and animated flourishes all subtract from the one thing the screen
is for. What makes a dense tool beautiful is the hard part: exact alignment, a
spacing rhythm that never breaks, a type scale with real intervals, colour only
where it carries meaning, and edges that are deliberate at every boundary.

This is not a compromise invented to obey the constraints — it is what the
best-sourced research says. Linear's own account of its redesign describes
"preserving that rich density of information without letting the interface feel
overwhelming", achieved by meticulously aligning "labels, icons, and buttons,
both vertically and horizontally" rather than by adding emptiness.

And the counter-example arrived on schedule. Apple shipped Liquid Glass in 2025
as a layer that "floats above the content layer", creating "hierarchy through
depth" — the most heavily marketed visual idea of the period. Within a year Apple
had added a "Tinted" control to suppress it and announced it was "updating the
foundations of how Liquid Glass is built to ensure exceptional readability", after
lock-screen text blended into the wallpaper behind it. **The decade's flagship
overlay material was walked back for precisely the failure the maker's no-overlap
rule forbids by construction.**

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**D1 — Nothing overlaps, and it is enforced mechanically.**
No floating panels, no popovers or tooltips over data, no modal-over-content, no
negative margins, no sticky headers scrolling rows underneath themselves, and no
shadow that implies one surface floating above another. A new audit,
`scripts/audit-overlap.mjs`, joins the four that already run before every build
and test, so the rule cannot rot.

Consequences designed for rather than discovered:

| Conventionally an overlay | TRITIUM's answer |
|---|---|
| Sort menu on a column | Sort state in the header cell itself; clicking cycles it |
| Tooltip or hover preview | A detail region owning its own row of the layout — JetBrains' promotable-popup pattern, minus the popup |
| Toast / snackbar | Inline notification in flow. Carbon's own rule: "do not cover other content with inline notifications" |
| Modal confirmation | A real second window, which §5.1 already established for forms |
| Sticky table header | A fixed header region in normal flow beside a separately scrolling body, column widths synchronised |
| Date-range picker (§7.2) | In-pane, in flow, never a popup calendar |

**D2 — The token contract becomes JADEITE's vocabulary, seventeen tokens.**
*(the maker's ruling)*

```
surface · surfaceRaised · surfaceSunken
border · borderStrong
text · textMuted · textSubtle · textOnAccent
accent · accentHover
danger · warning · success · info
focusRing · selection
```

plus `accentSequence`, an ordered run of eight (D5). This renames TRITIUM's
`--bg`/`--fg`/`--line` family, so the two apps in the family speak one language.
The rename is mechanical and safe: `audit-colours` already guarantees no file
outside `palettes.css` names a colour, so every reference is a variable and the
compiler plus the audit catch anything missed.

**`surfaceOverlay` is deliberately not ported.** JADEITE documents it as "menus
and dialogs floating above everything" — the thing D1 abolishes. The token and
the concept are both absent.

**D3 — The eleven palettes take their canonical published values.**
Ten from JADEITE — Default Light, Default Dark, Noctalia, Catppuccin Latte,
Catppuccin Frappé, Catppuccin Macchiato, Catppuccin Mocha, Rosé Pine Dawn, Nord,
Kanagawa Lotus. Six dark, four light. The eleventh is **Ubuntu Aubergine**, from
Canonical's published brand palette, which still needs reading.

**Default Light and Default Dark take a tritium glow accent** *(the maker's
ruling)* — a luminous green-cyan. They are the only two of the ten that are not
published canon; they are JADEITE's house neutrals, and their accent is jade
because that is JADEITE's identity. Tritium is what makes self-luminous vials and
exit signs glow, so the app's name becomes its colour.

**No pure black as a surface and no pure white as text, in any of the eleven.**

**D4 — Depth comes from fill steps and borders. Outer shadow is forbidden; inset
and bevel are not.**
An outer `box-shadow` paints *outside* the border box and is the forbidden
"floating above" signal. An `inset` shadow paints strictly inside it and cannot
cross into a neighbour — Shopify Polaris splits its own tokens exactly there:
Elevation, Inset, Bevel.

Real numbers, computed from IBM Carbon's shipped token files rather than its
documentation: **a fill step alone reads as a distinct surface at roughly
1.1–1.5 : 1** (about 4–11 L\* points) — far below any text threshold, because it
only has to be perceptible as a plane change. **Borders do the assertive work:
1.5–2.3 : 1 for subtle, 3.0–3.3 : 1 for strong** — the latter being exactly the
WCAG 1.4.11 non-text floor, and reserved for boundaries that are the *sole*
indicator of something.

**Fill separation and border separation are two different jobs at two different
magnitudes.** Light palettes may need to *alternate* rather than step: the real
requirement is not a monotonic ramp but that no two adjacent, simultaneously
visible surfaces resolve to the same value. One implied light source governs
every carved edge on screen.

Material's own dark-theme guidance agrees on the mechanism: dark surfaces are
"dark grey instead of black", "shadows are less effective in an app using a dark
theme", and the replacement is that "surfaces become lighter and more colorful at
higher elevations" — a fill change, not a shadow.

**D5 — Derive the palettes; do not hand-tune eleven of them.**
Chromium 150 is confirmed in this build, against feature gates of 111, 119 and
123, so `color-mix()`, relative colour syntax and `light-dark()` are all
available. Surfaces and borders are derived as formulas against each palette's
source colours, in **OKLCH** — MDN explicitly discourages `srgb` for mixing.

The reason is not elegance but correctness: *"adding 10% lightness will have
different results for blue and purple colors."* Fixing lightness and varying only
hue is what guarantees the same contrast outcome across eleven palettes. Linear
moved its whole theme generation to LCH for this exact reason, and JADEITE
already derives a wash/tint/line/mark ladder at 12% / 24% / 45% / 88% toward the
surface. Each palette is structured as a graded scale with a fixed role per step
— Radix's model — not a flat bag of names.

**`accentSequence` is part of the palette, and settling it here is urgent.** §7.2
specifies seven charts. Without a palette-aware series run, F8 has no way to
colour a series except by hard-coding — which `audit-colours` will reject, at
which point the audit gets weakened to let the build through. Eight entries
covers seven charts with one spare.

**D6 — Accent is a signal, never structure.**
Every border token stays achromatic; only interactive borders take accent. Carbon
does exactly this — every `border.*` token resolves to a neutral grey except
`border.interactive` — and GOV.UK is blunter still about its own accent: "only
use this colour to indicate which element is focused on."

The binding constraint, which is arithmetic rather than taste: **`accent` must
clear 3:1 against both `surface` and `surfaceRaised`, in all eleven palettes,
light and dark.** That is what limits how dark or saturated any accent may be.

**D7 — No context menus.** *(delegated to me by the maker, and open to veto)*
A native OS menu still covers what is under it, even though it does not
participate in the app's own stacking. But the genuine need is clipboard access,
not a menu, and select-plus-`Ctrl+C` serves it without covering anything. **F4b
must verify that clipboard keyboard commands work in text fields and in §3.5's
selectable address with no application menu present, and wire them as
accelerators if they do not.** This keeps the rule absolute with no carve-out to
defend later.

**D8 — Letter-spacing is governed by a rule, not a blanket.**
The standard advice is 5–12% tracking on uppercase labels. In a monospace face
that destroys the fixed advance width which is the point of the typeface, and
labels stop aligning with the columns beneath them. So: **tracking is permitted
only where no column aligns beneath the label** — the tab bar, section labels —
and **forbidden wherever a table sits below.** Testable, rather than a matter of
taste.

**D9 — Two weights, and hierarchy built without weight.**
The vendored font is four faces: regular, italic, bold, bold-italic. There is no
medium and no semibold, and a fifth face costs about 2.8 MB of TTF that F4b does
not buy. Hierarchy is therefore built from size, the `text → textMuted →
textSubtle` ladder, spacing and position, with **bold reserved for one job rather
than sprayed**. Build it so it survives in greyscale first, then let the palettes
be a skin over it — which is also what makes eleven of them viable.

Note the constraint this closes off: Material's header treatment is *smaller and
softer* than its body text, compensating with a medium weight. With two weights
that route is shut; the background-step route is the one open to us.

**D10 — The type scale is derived, not invented.**
Fluent 2 publishes a full ramp whose own numbers give a ratio that tightens as
size grows: 14/20 = 1.43, 24/32 = 1.33, 32/40 = 1.25. Butterick independently
gives 120–145% line spacing and 45–90 characters per line. TRITIUM currently runs
a flat 14px / 1.5 everywhere, which is one size pretending to be a system.

**The monospace adjustment has no precedent to copy** (D14), so the scale is set
empirically against real number columns at the minimum 1280 × 720 and written
down as tokens.

**D11 — Geometry: an 8px ladder and a small radius set.**
Spacing follows 0 · 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 with
Atlassian's bands — 0–8px inside components, 12–24px between them, 32px and up
between regions. Atlassian's negative-space tokens, which exist explicitly "for
overlapping elements", are the one part of that system TRITIUM does not adopt.

**No negative margins anywhere**, which rules out both mainstream techniques for
optically centring text and icons in controls (the "Basekick" method and negative
`margin-block`). The compliant replacement is `inline-flex` with `align-items:
center`, letting padding define the box, and `padding-block` in preference to
`min-height` so wrapped text still breathes.

Radius: 4px default, 2px small, 8px large, and **0 on the tab bar** — Fluent
specifies exactly that for nav and tab bars, plus a rule that corners are not
rounded where two elements abut or meet a screen edge. Nested radius is
`inner = outer − padding`; a child whose padding exceeds the parent radius is
simply square.

**D12 — The table is the app, and it is dense.**
**Row height 32–36px** — the financial-tools band, against Material's 56px
consumer default. Everything verifiable in the research clusters in 24–48px for
"dense", and 48 is the ceiling before a table stops reading as dense.

**A single light bottom rule per row; no zebra.** Two independent practitioner
sources warn that zebra combined with hover, selected and disabled produces "five
semantic levels" of grey and breaks continuity, and that grid lines plus zebra
together make horizontal scanning *harder*. With every state forced into the
row's own box by D1, zebra spends a background level we cannot spare.

- **Numbers right, text left, and dates and identifiers left** despite being
  digits — they are not compared by magnitude. Centre alignment is an
  anti-pattern by name.
- **Three discrete state tokens, including a distinct hover-and-selected value**,
  so two translucent layers never stack ambiguously — Carbon's approach, where
  state values are simply further rungs of the same ramp used for structural
  nesting.
- **Focus must match or exceed hover** — focus is never the lesser affordance.
  Text clears 4.5:1 on both normal and highlighted rows; the highlight clears 3:1
  against the default row.
- **Never change size or weight on a state change** — it reflows the layout.
- Sort state: a chevron for sortable, a filled triangle for the active direction
  — a shape change, not merely a colour change, laid out with CSS Grid inside the
  header cell. `aria-sort` is set only on the sorted column and moved, never
  duplicated.
- Units in the column header once, not per cell. Cap default visible columns at
  6–8.

**`tabular-nums` is a no-op here**, confirmed three ways — the property exists to
give a *proportional* font fixed-width digits. The consequence is a gift:
`text-align: right` on a monospace cell with a fixed decimal count produces
**exact decimal alignment for free**, including for `2.200,67 ₺`, because the dot
and the comma are fixed-width glyphs like any digit. The entire decimal-alignment
workaround literature is moot for this app.

**D13 — Electron and Linux hygiene.** Each of these is a real defect if missed:

- **`font-variant-ligatures: none`, globally.** CaskaydiaCove is a coding font;
  left alone it silently re-glyphs `!=`, `->` and `=>` — including inside
  user-typed notes and part numbers. This is a data-display bug, not a nicety.
- **No `-webkit-font-smoothing`.** It is macOS-only and a no-op on Linux and
  Windows; copying it from JADEITE would be cargo cult. There is no CSS lever for
  font smoothing on Linux at all.
- **Scrollbars through the `::-webkit-scrollbar-*` family only** — the standard
  `scrollbar-width`/`scrollbar-color` properties override it when set to anything
  but `auto`, and only the webkit family exposes hover states and thumb radius.
  Thumb and track clear 3:1 per palette. `scrollbar-gutter: stable` stops columns
  jumping when a scrollbar appears. **Not thin** — Electron gives the user no
  override, so whatever we choose is final for everyone.
- **`cursor: default` on every control.** The hand cursor appears nowhere in the
  app, because §3.5 means there are no links at all.
- **`user-select: none` broadly, carved out for inputs *and* §3.5's selectable
  source address** — and without stripping the focus outline as a side effect.
  Suppress `-webkit-user-drag` on images.
- **Broadcast palette and language to every window.** Each `BrowserWindow` is
  isolated; today only `vehicles:changed` is broadcast, so a form opened before a
  palette switch keeps the old palette. Eleven palettes make that visible
  immediately. Wire per-window `focus`/`blur` so the active window reads as
  active.
- **`transform` and `opacity` only** for anything that moves; everything else
  forces layout or paint. **No `backdrop-filter`** — unavailable on Linux, and
  the one concretely measured performance killer in the research: a full-screen
  blur took a Zettlr preferences dialog to two frames per second.
- **Wayland will not let the app place its own windows.** `setPosition`, `center`
  and `setSize` are inert and `getPosition` returns `[0, 0]`, by protocol.
  Forms cannot be centred on the parent, and on Linux a child window does not
  follow its parent when dragged. F4b must not design anything that depends on
  window placement.

**D14 — The monospace-everywhere decision is unprecedented, and kept knowingly.**
The research found no shipped GUI application that runs a monospace face through
its full chrome. VS Code uses the platform UI font for its workbench and the code
font only in the editor; Ghostty builds genuinely native chrome per platform;
even iA Writer — the most rigorously argued monospace-forward app — applies it
only to writing content, never its own toolbars. iA documents the failure mode
too: forcing every glyph into one box "creates visual awkwardness for wider
characters like M, W, m, and w", which their duospace design fixes by giving
those four 50% extra width.

Butterick is blunter: *"for standard body text, there are no good reasons to use
monospaced fonts. So don't."* His stated exceptions are code and **tabular
numerals** — and a fuel log is columns of numbers, which is his exception rather
than his rule.

§8 settles the decision and F4b does not reopen it. What F4b owes it is
compensation: careful size steps so small text does not crowd, restraint about
prose in the chrome, and prose kept inside Butterick's 45–90 character line.

**D15 — Empty states keep their structure.** §7 already requires empty cells in
the same layout as a filled app. The mainstream "replace the table, hide the
headers" model is rejected outright; NN/g's model is adopted — state it in place
with a plain sentence, leaving the table standing.

**D16 — Motion stays opt-in.** Palette switching is instant; transitions are
declared per element where they earn their place, never globally.
`prefers-reduced-motion` is honoured.

### 2.2 The tab list and pane contents (§11.1)

**The list is settled as it stands, unchanged: eight tabs.**

`summary · fuel · costs · service · charts · statistics · settings · about`

Checked against the constitution rather than against taste, it already covers
§7 exactly and has nothing spare: `summary` is §7.1, `charts` is §7.2's seven,
`statistics` is §7.3's dedicated section, `fuel`/`costs`/`service` are the three
kinds of record the app keeps, and `settings`/`about` are the two the app keeps
about itself. Nothing in §7 is homeless and no tab is inventing work. The four
tabs that render empty cells today are waiting on F5–F8, not on a decision.

**Both panes' halves, settled:**

| Tab | Left pane | Right pane |
|---|---|---|
| Summary | Vehicle header · Gas card · Costs card · Lifetime totals | Trend cards, static grid, all visible at once · Last entries |
| Fuel | The fill-up table, with the range chips above it | The selected fill-up in full, and the figures derived from it |
| Costs | The cost table, with the range chips above it | The selected record in full · breakdown by category |
| Service | The service table, with the range chips above it | The selected record in full · what falls due next |
| Charts | The seven charts as a list, the range chips, and the custom date range | The chosen chart, its readout, and — for the bar charts — the data table §7.2 requires beneath it |
| Statistics | Best and worst tank · km per day | Projected annual cost · true cost per km including purchase price |
| Settings | Language · units · format · currency | The eleven palettes, and a specimen showing the one in force |
| About | The mark, the rows, the addresses | The licence |

Two consequences worth stating plainly, because both are places where §7 and the
standing aesthetic law disagree and somebody later would otherwise have to guess.

**§7.2 settles a tooltip on every chart. Tooltips overlay.** The law is newer
than §7 and governs, so the tooltip becomes a **readout region beneath the
chart, in flow, owning its own space** — the crosshair moves, the readout
changes, nothing is covered. This is better here regardless of the law: the
figure stays legible while the pointer moves, it can be read without hovering,
and it does not vanish the instant the mouse leaves the plot.

**§7.2 settles a per-chart fullscreen button. A layer over the app overlays.**
The button stays; what it opens is a **real second window**, which is already
this application's answer for anything that wants the whole screen (§5.1). The
alternative — the chart expanding to fill both panes, still in flow — is
acceptable if the window proves awkward on the target desktop, and F8 may choose
between them. What it may not do is float the chart above the shell.

Both are F8's to build. F4b's job is that F8 arrives with the answer already
made, rather than discovering the conflict and hard-coding its way out.

### 2.3 What is written

| Path | Change |
|---|---|
| `src/renderer/styles/palettes.css` | Rewritten: eleven real palettes, seventeen tokens each, plus the eight-entry accent sequence |
| `src/renderer/styles/tokens.css` | **New.** Spacing ladder, type scale, radii — everything not palette-dependent |
| `src/renderer/styles/base.css` | Rewritten against the tokens; no bare values left |
| `src/renderer/App.tsx` | The tab list and the shell chrome |
| `src/renderer/panes/*.tsx` | `AboutPane`, `SettingsPane`, `FuelPane`, `EmptyPanes` |
| `src/renderer/forms/*.tsx` | `VehicleForm`, `FuelForm`, `FuelQuickAdd`, `CurrencyAsk` given a real form layout |
| `src/renderer/VehiclePicker.tsx` | Restyled |
| `src/main/index.ts`, `src/preload/index.ts` | Palette and language broadcast to every window (D13) |
| `scripts/audit-overlap.mjs` | **New**, wired into `npm run audit` |
| `tests/unit/palettes.test.ts` | **New.** Token completeness and computed contrast |

Reused unchanged: `src/shared/consumption.ts`, `src/shared/format.ts`,
`src/main/storage/*`. **F4b changes how the app looks, not what it does.**

### 2.4 Tests that must exist

- Every palette defines every token — no palette silently inherits a fallback.
- **Contrast is computed, not eyeballed**, per palette: 4.5:1 for text, 3:1 for
  non-text and meaningful borders, and **SC 2.4.13** — note the number, which was
  2.4.11 in draft and renumbered before WCAG 2.2 was final — requiring an
  indicator at least as large as a 2px perimeter and **≥3:1 between the focused
  and unfocused states of the same pixels**.
- `accent` clears 3:1 against both `surface` and `surfaceRaised`, everywhere.
- No palette uses pure black as a surface or pure white as text.
- `audit-colours` still passes: not one colour literal outside `palettes.css`.
- `audit-overlap` passes, and fails loudly on a seeded violation.
- An e2e test switches through all eleven palettes and asserts the computed
  custom properties actually change.
- **The existing 116 unit and 29 e2e tests pass unchanged.**

---

## 3. SCOPE — OUT

- **No behaviour changes.** Not one figure, file format or IPC channel moves.
- **The dense TanStack table is F7's.** F4b sets the visual specification it must
  meet and restyles the provisional list; it does not build the real one and does
  not add the range chips. F4b must not design anything that forbids virtualising
  rows — Hyper, the one genuinely Electron terminal, fell to roughly one frame
  per second painting a long list directly into the DOM.
- **The charts are F8's.** F4b defines the series colours they will use.
- **§11.4 stays open** — subtitle wording, README banner, icon artwork.
- **No new font weights**, no second typeface, no animation library, no icon
  library, no CSS framework. The stack does not move for a coat of paint.

---

## 4. ACCEPTANCE CRITERIA

1. Eleven palettes exist with real, canonical values; none is a placeholder, and
   the file no longer describes itself as garish.
2. Every palette defines all seventeen tokens plus its eight-entry accent
   sequence, proven by test.
3. Contrast is proven by computation, per palette, for text, non-text and the
   focus indicator; `accent` clears 3:1 against both surface tokens.
4. No palette uses pure black as a surface or pure white as text.
5. `surfaceOverlay` appears nowhere — the token and the concept are both absent.
6. `audit-overlap.mjs` exists, runs before every build and test, and fails on a
   deliberately seeded violation.
7. Not one colour literal outside `palettes.css`; `audit-colours` still green.
8. Geometry, spacing and type are tokens; no bare pixel value remains in a
   component stylesheet.
9. Hierarchy is legible with two font weights only; no third weight is bundled.
10. Ligatures are disabled globally, and no `-webkit-font-smoothing` is present.
11. Table rows are 32–36px with a single bottom rule and no zebra; numbers right,
    dates and identifiers left.
12. Palette and language changes reach every open window, including forms opened
    beforehand.
13. Empty panes keep the filled layout and state their emptiness in a sentence.
14. Palette switching is instant, and no global transition exists.
15. The tab list and both panes' contents are settled and documented here.
16. All existing tests pass unchanged; the five audits, both tsconfigs, the unit
    suite, the build and the e2e suite are green.
17. **The app is run and looked at**, seeded, in at least one dark and one light
    palette — including the checks §4.1 names.

### 4.1 Checks that cannot be automated

- **Icons, glyph by glyph, at real UI size.** Nerd Fonts ships three width builds
  because monospace and legible icons genuinely conflict; we vendor Mono, which
  has live upstream bugs for oversized glyphs, and our build carries only FA 4.7
  and FA 6.5.1.
- **The font on Arch + GNOME + Wayland**, which has an open, unresolved Electron
  rendering regression (#47502) — the maker's exact platform.
- **The window at narrow and tall aspect ratios.** Fixed two-pane apps on Linux
  are a named, repeated failure in tiling window managers — TRITIUM's exact
  shape and primary platform.
- **Clipboard with no application menu present** (D7).

---

## 5. EXIT

Report the acceptance criteria against this document, then stop.

On the maker's **`PUTAG`**: commit, roll to **0.1.4** in `package.json`,
`package-lock.json` (lines 3 and 9) and `src/shared/app-meta.ts`, stamp
`RELEASE_DATE` with the day the signal actually arrives, tag
`v0.1.4 · F4b · Design`, build locally. **No push.**

The version roll is a commit of its own rather than an amendment, as v0.1.3's
was, because `main` now tracks this branch closely.
