# TRITIUM — F4b · v0.1.4 · «Design»

The milestone where the app stops looking like a test fixture.

F1 through F4 built a frame and filled it with working parts wearing colour that
was chosen to be *wrong*. `palettes.css` says so out loud: "deliberately garish
so that nobody mistakes it for the design phase's output." That placeholder has
now outlived its purpose. F4 computes a real figure — litres per hundred
kilometres between full tanks — and it is displayed in magenta on near-black in
a table with no rhythm to it.

The maker's ruling opening this milestone: **the app must be gloriously good
looking, and that is the reason Electron was chosen in the first place.** A
renderer with the whole of CSS available is a strange thing to pick if the
result is going to look like a form from 2006. F4b is where that choice is
cashed in.

**F4b is a regular milestone and takes the next version bump: v0.1.4.**
Consequence, recorded here rather than silently: XTRITIUM §9.1's printed table
maps F5 → v0.1.4, and from F5 onward every entry now reads one off. The map is
still `F(n) → v0.1.(n-1)` up to F4, and `F(n) → v0.1.(n)` from F5. §11.5 already
reserves the full F-map as open, so this is a resolution of something open
rather than a contradiction — but §9.1's table is now stale and wants the
maker's pen.

---

## 1. WHERE F4b SITS

XTRITIUM §11 reserved five things for "the design phase". F4b closes the first
three of them:

1. Final tab list and what lives in each pane of the two-pane layout.
2. Visual design of forms, tables, cards; spacing and density.
3. The eleven palettes' exact values.

§11.4 (subtitle wording, README banner, icon artwork) and §11.5 (the F-map) stay
open — they are not visual-design work and the artwork is the maker's to supply.

### 1.1 What the constitution already fixed, and F4b may not move

This milestone is the furniture. The frame was settled long ago and F4b inherits
it whole:

| Fixed by | What |
|---|---|
| §7 | Top tab bar above two big panes. Deliberately not a sidebar |
| §7 | **The compositor draws the decorations.** Minimum 1280 × 720 |
| §7 | Dense tables (TanStack), with the charts' time-range chips |
| §7 | No search. No keyboard shortcuts. No tray, no autostart |
| §7 | Empty cells in the same layout as a filled app — no "get started" screens |
| §8 | **CaskaydiaCove Nerd Font Mono for the whole UI.** Icons are the Font Awesome glyphs already patched into it |
| §8 | Eleven palettes as CSS custom properties, switched instantly, stored in `settings.toml` |
| §8 | `1.234,56 ₺` and `GG/AA/YYYY`, in both languages |

Two of these cost F4b a great deal of otherwise-standard advice, and the cost is
worth naming rather than discovering later:

- **The compositor draws the decorations.** Every modern-Electron technique built
  on a frameless window is unavailable: custom title bars, `titleBarOverlay`,
  macOS traffic-light insets, drag regions, in-window window controls. TRITIUM
  wears the desktop's own frame. This is not a limitation to work around; it is
  the reason the app will look at home on the maker's desktop and not like a
  browser tab pretending otherwise.
- **No shortcuts and no search** removes the command palette, which is the single
  most-cited "modern power-user" pattern of the period — and which is, in every
  documented implementation, a portal-rendered overlay. It was already out on
  §7's authority before the no-overlap rule reached it.

### 1.2 The standing aesthetic law

The maker has written this law once already, for JADEITE, and it governs here
without needing to be re-argued:

- **"This is not a kid's-play app — colours must never be chaotic; clarity must
  be high."** (XJADEITE §12.3)
- **"Palette-consistent, never carnival."** (XJADEITE §7.2, on magnitude bars and
  state cues — "honoured in spirit, executed elegantly".)
- **"The app must never animate itself into looking busy. Transitions are
  opt-in, never global."** (JADEITE `tokens.css`)
- **Accents are muted toward the palette's own surface tones before they ever
  reach a pixel.** (XJADEITE §12.3)

### 1.3 What "gloriously good looking" therefore means

There is an apparent tension between "eye-candy" and "never carnival". It
resolves cleanly, and the resolution is the thesis of this milestone:

**The glory comes from craft, not from decoration.** TRITIUM is mostly columns of
numbers. Nothing that can be added on top of a number column improves it —
gradients, glows, animated flourishes and translucency all subtract from the one
thing the screen is for. What makes a dense tool beautiful is the part that is
hard: exact alignment, a spacing rhythm that never breaks, a type scale with real
intervals, colour used only where it carries meaning, and edges that are
deliberate at every boundary.

This is not a compromise reading invented to obey the constraints. It is what the
best-sourced research says outright. Linear's own account of its redesign
describes the goal as "preserving that rich density of information without
letting the interface feel overwhelming", achieved by meticulously aligning
"labels, icons, and buttons, both vertically and horizontally" — refining spacing
rather than adding emptiness — with the result meant to be "felt after a few
minutes of using the app" rather than announced.

And the counter-example arrived on schedule. Apple shipped Liquid Glass across
all its platforms in 2025 as a layer that "floats above the content layer",
creating "hierarchy through depth" — the most heavily marketed visual idea of the
period. Within a year Apple had added a "Tinted" control to suppress it after
backlash, and announced it was "updating the foundations of how Liquid Glass is
built to ensure exceptional readability". The reported failure was lock-screen
notification text blending into the wallpaper behind it. **The decade's flagship
overlay material was walked back for precisely the failure the maker's
no-overlap rule forbids by construction.**

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**D1 — Nothing overlaps. This is a hard rule and it is enforced mechanically.**
No floating panels, no popovers or tooltips over data, no modal-over-content, no
negative margins, no sticky headers that scroll rows underneath themselves, no
shadow that implies one surface floating above another. Every element owns its
own rectangle. A new audit script, `scripts/audit-overlap.mjs`, joins the four
that already run before every build and test, so the rule cannot rot.

Consequences that must be designed *for*, not discovered:

| Pattern conventionally solved by an overlay | TRITIUM's answer |
|---|---|
| Sort menu on a column | Sort state shown in the header cell itself; cycling by click |
| Tooltip on hover | A persistent detail line that occupies its own row of the layout |
| Toast / snackbar | Inline notification in flow. Carbon's own rule: "do not cover other content with inline notifications" |
| Modal confirmation | A real second window, which §5.1 already established for forms |
| Sticky table header | A genuinely fixed header region in its own layout row, with the body scrolling separately beside it — same orientation benefit, no overlap |
| Date-range picker (§7.2) | In-pane, in flow, not a popup calendar |

**D2 — The token contract grows from ten to seventeen, plus a chart sequence.**
TRITIUM currently defines ten custom properties. JADEITE proved eighteen across
ten palettes. F4b ports that contract, with one deliberate omission:
`surfaceOverlay` — documented in JADEITE as "menus and dialogs floating above
everything" — is **not** ported, because D1 abolishes the thing it names.

The ported set, in JADEITE's own vocabulary, which F4b adopts wholesale so the
two apps in the family speak one language:

```
surface · surfaceRaised · surfaceSunken
border · borderStrong
text · textMuted · textSubtle · textOnAccent
accent · accentHover
danger · warning · success · info
focusRing · selection
```

Plus `accentSequence`, an ordered run of eight (see D4).

This renames TRITIUM's existing `--bg`/`--fg`/`--line` family. The rename is
mechanical and safe: `audit-colours` already guarantees no file outside
`palettes.css` names a colour, so every reference is a variable and the compiler
plus the audit catch anything missed.

**D3 — The eleven palettes take their canonical published values.**
Ten come from JADEITE — Default Light, Default Dark, Noctalia, Catppuccin Latte,
Catppuccin Frappé, Catppuccin Macchiato, Catppuccin Mocha, Rosé Pine Dawn, Nord,
Kanagawa Lotus. Six dark, four light. Nord's file is sourced from
`nordtheme/nord` and carries the Polar Night / Snow Storm / Frost / Aurora
structure intact; the others are equally canonical.

The eleventh is **Ubuntu Aubergine**, from Canonical's published brand palette.

**Default Light and Default Dark need TRITIUM's own accent.** They are the only
two of the ten that are not published canon — they are JADEITE's house neutrals,
and their accent is jade because that is JADEITE's identity. Porting jade into
TRITIUM would be wearing another app's badge. The proposal, for the maker's
ruling: TRITIUM is what makes self-luminous vials and exit signs glow, so the
house accent is that luminous green-cyan. The name is already a colour.

**D4 — Chart series colours are part of the palette, and this is urgent.**
Every JADEITE palette carries `accentSequence`, eight colours "chosen to stay
distinguishable at a glance while remaining inside the palette's own character",
muted toward the surface. §7.2 specifies seven charts. Without this, F8 has no
palette-aware way to colour a series and will be forced to hard-code — which
`audit-colours` will reject, at which point the audit gets weakened to let the
build through. **Settling it here is what prevents that.** Eight entries covers
seven charts with one spare.

**D5 — Two font weights, and hierarchy built without weight.**
The vendored font is four faces: regular, italic, bold, bold-italic. There is no
medium, no semibold. A fifth face costs about 2.8 MB of TTF, and F4b does not buy
one. Hierarchy is therefore built from size, colour (`text` → `textMuted` →
`textSubtle`), spacing, letter-spacing on uppercase labels, and case — with bold
reserved rather than sprayed. This is a real constraint and it is a good one: it
forces the levers that work better anyway.

**D6 — The type scale is derived, not invented.**
Fluent 2 publishes a full ramp with line heights, and its own numbers give a
consistent ratio that tightens as size grows: 14/20 = 1.43, 24/32 = 1.33,
32/40 = 1.25, 68/92 = 1.35. Refactoring UI's rule that no two steps sit closer
than about 25% apart, and that line-height and font size move inversely, agrees
with it. TRITIUM currently runs a flat 14px / 1.5 everywhere, which is one size
pretending to be a system.

**The monospace adjustment is F4b's own problem and has no precedent to copy**
(see D11). A monospace face at a given pixel size occupies more horizontal room
per character than a proportional one, so the ramp cannot be lifted unchanged.
The scale is to be set empirically against real number columns, at the app's
minimum 1280 × 720, and written down as tokens.

**D7 — Geometry: a small radius set and an 8px spacing ladder.**
Fluent 2 specifies 4px as the default radius, 2px for small elements, 8px for
large ones, and — directly relevant — **0px for nav bars and tab bars**, plus a
rule that corners are not rounded where two elements in a container abut or where
an element meets a screen edge. JADEITE shipped `--radius: 6px` / `--radius-sm:
4px` and liked it. The nested-radius rule is `inner = outer − padding`, and a
child whose padding exceeds the parent radius is simply square.

Spacing follows Atlassian's 8px base and ladder — 0 · 2 · 4 · 6 · 8 · 12 · 16 ·
20 · 24 · 32 · 40 · 48 — with its usage bands: 0–8px inside components, 12–24px
between components, 32px and up between regions. Atlassian's negative-space
tokens, which exist explicitly "for overlapping elements", are the one part of
that system TRITIUM does not adopt.

**D8 — Depth comes from luminance steps and borders, never from cast shadow.**
This is where the constraint and current taste happen to agree. The mainstream
dark-UI technique for expressing a raised surface is already a lighter fill or a
border rather than a shadow — around L 10% for the base, L 14–16% for the first
step, L 18–20% for the second, roughly three to four lightness points per step —
and Material's own dark-theme documentation states plainly that dark surfaces are
"dark grey instead of black, which increases visibility for shadows and also
reduces eye strain for light text". **No pure black background, no pure white
text, in any of the eleven.**

The derivation should be programmatic rather than hand-tuned per palette. JADEITE
already does this with `color-mix(in oklch, …)`, deriving a wash/tint/line/mark
ladder from one accent at 12% / 24% / 45% / 88% toward the surface. Linear moved
its whole theme generation to LCH for exactly this reason — so that lightness and
contrast relationships stay "perpetually uniform" across many different hues,
which is the precise problem eleven palettes present.

Radix Colors' twelve-step semantic scale is the reference architecture worth
studying while doing it: steps 1–2 app background, 3–5 component background in
normal/hover/pressed, 6–8 borders and separators, 9–10 solid fills, 11–12 text.
TRITIUM will not use Radix's values, but structuring each palette as a graded
scale rather than a flat bag of names is what makes eleven of them consistent.

**D9 — Contrast is a build gate, not an aspiration.**
WCAG 2.2: 4.5:1 for normal text, 3:1 for large text and for non-text UI
components, and — new in 2.2, SC 2.4.11 — 3:1 for focus indicators against
adjacent colours. With eleven palettes hand-checking is not credible, so this is
**computed in a unit test** over every palette × every foreground/background pair
the design actually uses. A palette that fails does not ship.

**D10 — Motion stays opt-in.** JADEITE's rule is inherited verbatim: palette
switching is instant, and transitions are declared per-element where they earn
their place, never globally. `prefers-reduced-motion` is honoured.

**D11 — The monospace-everywhere decision is unprecedented, and is kept
knowingly.** The research found no shipped GUI application that runs a monospace
face through its full chrome. The universal pattern is a split: VS Code uses the
platform UI font for its workbench and the code font only in the editor and
terminal; Ghostty builds genuinely native chrome per platform "so the app will
look, feel, and behave like you expect an application to behave in your desktop
environment"; even iA Writer, the most rigorously argued monospace-forward app,
applies it only to writing content and never to its own toolbars.

iA is worth reading closely because it documents the actual failure mode: forcing
every glyph into an identical box "creates visual awkwardness for wider
characters like M, W, m, and w", which their duospace design fixes by giving
those four 50% extra width. TRITIUM uses a true monospace and will meet that
awkwardness at label sizes.

§8 settles the decision and F4b does not reopen it — CaskaydiaCove is a modern,
well-hinted coding face, not a typewriter, and the app is mostly number columns
where fixed advance is exactly right. What F4b owes it is compensation: careful
letter-spacing on uppercase labels, generous size steps so small text does not
crowd, and restraint about long prose in the chrome. One free consequence worth
recording: **`font-variant-numeric: tabular-nums` is moot here** — the whole
reason it exists is to buy in a proportional font what this font gives by
default.

**D12 — Icon glyphs carry accessible names.** Nerd Font icons are Private Use
Area code points; a screen reader meets one and announces nothing, or "unknown
character", or reads the CSS `content` value aloud. Every glyph used as an icon
gets an accessible label. The other two standard objections to icon fonts —
flash of unstyled content while a webfont loads, and downloading glyphs you never
use — are both inapplicable to an app that bundles its font and never touches a
network.

**D13 — Empty states keep their structure.** §7's rule already says empty cells
in the same layout as a filled app, and this is the one place where mainstream
guidance splits. The "replace the table, hide the headers" model is rejected
outright. NN/g's model is adopted instead: state system status in place, with a
plain sentence of the form "There are no records to display for the selected date
range", leaving the table's structure standing.

### 2.2 The tab list and pane contents (§11.1)

Currently eight tabs: `summary · fuel · costs · service · charts · statistics ·
settings · about`, of which four render real panes and four render empty cells.
F4b settles the final list and what occupies each pane's left and right halves,
against §7.1's settled Summary blocks, §7.2's seven charts and §7.3's Statistics
section. Fluent's rule that tab bars take a 0px radius applies to the top bar.

### 2.3 What is written

| Path | Change |
|---|---|
| `src/renderer/styles/palettes.css` | Rewritten: eleven real palettes, seventeen tokens each, plus the eight-entry accent sequence |
| `src/renderer/styles/tokens.css` | **New.** Geometry, spacing ladder, type scale, radii — everything that is not palette-dependent |
| `src/renderer/styles/base.css` | Rewritten against the tokens; no bare values left |
| `src/renderer/panes/*` | Restyled; the tab list settled |
| `src/renderer/forms/*` | Restyled; the second-window forms given a real form layout |
| `scripts/audit-overlap.mjs` | **New**, and wired into `npm run audit` |
| `tests/unit/palettes.test.ts` | **New.** Every palette defines every token; every pairing meets its contrast floor |

### 2.4 Tests that must exist

- Every one of the eleven palettes defines every token in the contract — no
  palette silently inherits a fallback.
- Every foreground/background pair the design uses clears WCAG 2.2: 4.5:1 text,
  3:1 non-text and focus ring. Computed, per palette, in a unit test.
- No palette uses pure black as a surface or pure white as text.
- `audit-colours` still passes: not one colour literal outside `palettes.css`.
- `audit-overlap` passes, and fails loudly on a seeded violation.
- An e2e test switches through all eleven palettes and asserts the computed
  custom properties actually change — extending F1's existing single-palette test.
- The existing 116 unit and 29 e2e tests continue to pass unchanged. **F4b
  changes how the app looks and must not change what it does.**

---

## 3. SCOPE — OUT

- **No behaviour changes.** Not one figure, file format, or IPC channel moves.
- **The dense TanStack table itself is F7's.** F4b sets the visual specification
  that table must meet and restyles the provisional list; it does not build the
  real one, and does not add the range chips.
- **The charts are F8's.** F4b defines the series colours they will use.
- **§11.4 stays open** — subtitle wording, README banner, icon artwork.
- **No new font weights**, and no second typeface.
- **No animation library**, no icon library, no CSS framework. The stack does not
  move for a coat of paint.

---

## 4. ACCEPTANCE CRITERIA

1. Eleven palettes exist with real, canonical values; none is a placeholder, and
   the file no longer describes itself as garish.
2. Every palette defines all seventeen tokens plus its eight-entry accent
   sequence, proven by test.
3. Every palette clears WCAG 2.2 contrast for text, non-text and focus ring,
   proven by computation rather than by eye.
4. No palette uses pure black as a surface or pure white as text.
5. `surfaceOverlay` appears nowhere: the token, and the concept, are absent.
6. `audit-overlap.mjs` exists, runs before every build and test, and fails on a
   deliberately seeded violation.
7. Not one colour literal outside `palettes.css`; `audit-colours` still green.
8. Geometry, spacing and type are tokens in `tokens.css`; no bare pixel value
   remains in a component stylesheet.
9. Hierarchy is legible with two font weights only — no third weight is bundled.
10. Every icon glyph has an accessible name.
11. Empty panes keep the filled layout and state their emptiness in a sentence.
12. Palette switching is instant, and no global transition exists.
13. The tab list and both panes' contents are settled and documented here.
14. All existing tests pass unchanged; the four audits, both tsconfigs, the unit
    suite, the build and the e2e suite are green.
15. The app is run and looked at, in at least one dark and one light palette,
    against real seeded data — not merely tested.

---

## 5. EXIT

Report the acceptance criteria against this document, then stop.

On the maker's **`PUTAG`**: commit, roll to **0.1.4** in `package.json`,
`package-lock.json` (lines 3 and 9) and `src/shared/app-meta.ts`, stamp
`RELEASE_DATE` with the day the signal actually arrives, tag `v0.1.4 · F4b ·
Design`, build locally. **No push.**

Because `main` now tracks this branch closely, the version roll is a commit of
its own rather than an amendment, as v0.1.3's was.

---

## 6. WHERE THE OUTSIDE EVIDENCE CAME FROM

Six researchers were sent out for this milestone. The findings above draw on
primary sources — Fluent 2's published shape and typography ramps, Atlassian's
spacing tokens, Linear's own redesign account, NN/g on flat design and on empty
states, Material's dark-theme documentation, iA on monospace typography,
Ghostty's platform-native argument, Carbon on inline notifications, and WCAG 2.2
itself. Where a figure could not be traced to a primary source it is marked as
such in the research notes rather than promoted to a decision here, and
listicle-grade material was discarded rather than cited.

The session's web-search budget was exhausted partway through, and two
researchers were interrupted by API errors and resumed. Sections of this document
that name exact numbers are the ones that survived that; anything thinner is
marked as a decision still to be set empirically rather than dressed up.
