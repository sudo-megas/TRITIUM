# F4b — RESEARCH DRAFT

Working notes for the design milestone. **This is not the plan.** It is the
evidence the plan gets written from, kept because a number without its source is
worth nothing six months from now.

Six researchers were sent out on 18/08/2026. Five returned; the sixth (real
Electron applications, named examples) was still out when the session's budget
ran down. The web-search budget was exhausted partway through, and two
researchers were killed mid-report by an API incident and resumed. What follows
is what survived, with its sourcing honestly marked — **fetched** means the page
was read; **search** means only a search summary surfaced it; **unverified**
means it conflicts with another source or rests on one weak one.

---

## 0. THE FINDINGS THAT CHANGE DECISIONS

Ranked by how much they alter what we would otherwise have built.

1. **`font-variant-ligatures: none` is mandatory, globally.** CaskaydiaCove is a
   coding font. Left alone it silently re-glyphs `!=`, `->`, `=>` into single
   ligature glyphs — including inside user-typed notes and part numbers. This is
   a live data-display bug, not a nicety.
2. **On Wayland the app cannot place its own windows.** `setPosition`, `center`,
   `setSize` are non-functional and `getPosition` returns `[0, 0]` — by protocol,
   not by bug. "The compositor — not the app developer — decides where it goes."
   Forms cannot be centred on the parent, and **on Linux a child window does not
   follow its parent when the parent is dragged** (macOS does). TRITIUM opens
   forms as real windows, so this is squarely ours.
3. **Electron has an open, unresolved font-rendering regression on Arch + GNOME
   + Wayland** — issue #47502, filed 18/06/2025, no maintainer response. That is
   the maker's exact platform. The font must be looked at, not assumed.
4. **`tabular-nums` is a no-op here**, confirmed three ways. The property exists
   to give a *proportional* font fixed-width digits. And the consequence is a
   gift: `text-align: right` on a monospace cell with a fixed decimal count
   produces **exact decimal alignment for free**, including for `2.200,67 ₺`,
   because the dot and comma are fixed-width glyphs like any digit. The entire
   decimal-alignment workaround literature dissolves for this app.
5. **Inset shadows and bevels do not violate the no-overlap rule.** An outer
   `box-shadow` paints *outside* the border box and is the forbidden "floating
   above" signal. An `inset` shadow paints strictly *inside* it and cannot cross
   into a neighbour. Shopify Polaris splits its own tokens exactly this way:
   Elevation (forbidden here) · Inset (fine) · Bevel (fine).
6. **Letter-spacing breaks the monospace grid.** The standard advice to track
   uppercase labels (Butterick: 5–12%) destroys the fixed advance width that is
   the whole point of the typeface — labels stop aligning with the columns
   beneath them. Either accept local misalignment or signal labels another way.
   This one needs the maker's ruling.
7. **Sticky table headers are overlap**, confirmed from three directions, and the
   non-overlapping substitute is real: two sibling regions — a header in normal
   flow, a separately scrolling body — with column widths synchronised.

---

## 1. TABLES — the centre of the app

### 1.1 Row height

| System | Values | Source |
|---|---|---|
| IBM Carbon v10 | Compact **24** · Short **32** · Default **48** · Tall **64** | fetched, v10.carbondesignsystem.com/components/data-table/style/ |
| Ant Design | padding-driven: Large 16px vert · Middle 12 · Small 8; 14px font throughout | fetched, ant.design/components/table |
| Material (m1) | header **64dp**, row **48dp**, last row 56dp | fetched, m1.material.io/components/data-tables.html |
| Pencil & Paper | Condensed **40** · Regular **48** · Relaxed **56** | fetched, pencilandpaper.io |
| artofstyleframe | Compact **28–32** ("below 28px you start losing usable click targets") · Standard 36–40 · Comfortable 48–52 | fetched |
| Dee Kargaev (financial) | **"Material recommends 56px rows; financial users needed 32–36px"** | fetched, blog.deeflect.com |

**Everything verifiable clusters in 24–48px for "dense", and 48 is the ceiling
before a table stops reading as dense.** Kargaev's 32–36 is the closest reference
class to a fuel log: fixed-decimal numeric columns, expert user, scanned often.

### 1.2 Zebra vs rules vs neither — a real disagreement

- **Pencil & Paper: avoid zebra.** Combined with hover, selected and disabled it
  produces "five semantic levels" of grey and breaks visual continuity. Prefers
  horizontal rules that "melt into the background". *(fetched)*
- **Kargaev agrees and goes further:** "removed most borders, kept only a light
  bottom border on each row", because heavy grid lines and zebra together
  "actually makes it harder to scan horizontally than a cleaner table with just a
  light separator between rows". *(fetched)*
- **Denovers: use zebra**, for clarity. *(fetched — direct contradiction, reported
  rather than resolved)*
- **NN/g:** borders, zebra and hover highlighting "can all help"; no measurements.
- Column separators, where used: **1px maximum, light grey**, converged.

**Reading:** with a no-overlap rule that forces every state (hover, selected,
focus) to be expressed as a background or border change in the row's own box,
zebra spends a scarce resource — it consumes one of the few background levels
available before states become ambiguous. A single light bottom rule per row is
the better trade here.

### 1.3 Alignment

- Numbers **right**, text **left**, header aligned to its column's type.
  Converged: GOV.UK (`govuk-table__cell--numeric`), Pencil & Paper, Denovers,
  Material.
- **Exception, named explicitly by two sources:** dates and identifier-like
  digits (plate numbers, VINs) stay **left**-aligned — they are not compared by
  magnitude. "Right-aligning a date column looks odd."
- **Centre alignment is an anti-pattern by name** — causes "visual jumping".

### 1.4 Header row

| System | Treatment |
|---|---|
| Carbon v10 | 14px, semibold 600 |
| Ant Design | weight 600, background `#fafafa`, border `#f0f0f0` |
| Material (m1) | 12sp Medium at **54%** opacity — against body's 13sp Regular at **87%** |

Material's header is **smaller and softer than its body text**, compensating with
weight alone. Carbon and Ant instead push weight plus a background step. With
only two weights available, TRITIUM cannot use Material's approach — the
background-step route is the one open to us.

### 1.5 Sort state without an overlay

- **Adrian Roselli** *(fetched)* — unsorted sortable columns get a **chevron**
  (stroke); the active column swaps to a **filled triangle** in the sort
  direction. Shape changes, not just colour, which satisfies WCAG 1.4.1. Laid out
  with CSS Grid *inside* the header cell:
  `grid-template-columns: minmax(2em, max-content) .65em auto`, icon
  `align-self: center`, `max-width: .65em`. Nothing paints outside the cell.
- **W3C WAI-ARIA APG** *(fetched)* — the label is wrapped in a `<button>` filling
  the whole header cell; `aria-sort` is set **only** on the sorted `<th>` and is
  moved, never duplicated; an unsorted-but-sortable column shows a **diamond
  (♢)** — deliberately a different shape, so nobody reads it as a direction.
- Ant's sort hover is a **same-space background swap** — compliant.
- **Ant's `showSorterTooltip` is a literal overlay** — drop that one feature,
  keep the rest of the mechanism.

### 1.6 Hover, selected, focus

- **Carbon uses discrete background tokens, not layered effects**: `$hover-ui`,
  `$selected-ui`, and — the detail worth stealing — a **third token
  `$hover-selected-ui`** for the combination, so two translucent layers never
  stack ambiguously. Focus is a **border** (`$focus`), not a background.
- Carbon's state values are simply **further points on the same grey ramp** used
  for structural nesting: `layer.selected.01` resolves to `gray.80`, which is the
  same value as `layer.02`. State borrows the next rung of the ladder already
  built.
- Bootstrap's row tint uses `box-shadow: inset 0 0 0 9999px <colour>` — huge
  spread, zero blur, so it reads as a flat fill. **Safe by construction.**
- **wallyax** *(fetched)* — a highlighted row wants **two simultaneous cues**;
  text must clear **4.5:1 on both normal and highlighted** backgrounds; the
  highlight itself must clear **3:1 against the default row**; and **focus must
  match or exceed hover** — focus is never the lesser affordance.
- **Erik Kennedy:** never change size or weight on hover or selection — it
  reflows the layout. Colour and background only.

### 1.7 Column budget and sticky headers

- Cap default visible columns at **6–8** *(artofstyleframe)*; beyond that, hide
  behind disclosure. Pencil & Paper prefers no hard ceiling but demands
  prioritisation, a frozen first column, and user show/hide.
- **Sticky headers conflict with the rule, three independent confirmations:**
  1. `position: sticky` on `<thead>` is z-axis stacking over scrolling rows.
  2. NN/g explicitly recommends a **drop shadow** under a frozen header to
     "suggest" it is "floating above" the data.
  3. Ant's own docs: **"Z-index handling required for fixed columns displaying
     over mask layouts."** A shipping product admitting the mechanism.
- **Substitute:** a non-scrolling header region in normal flow and a separately
  scrolled body region beneath it, with column widths synchronised via matched
  `grid-template-columns` or `table-layout: fixed` with mirrored `<colgroup>`.

### 1.8 Units and empty tables

- Put the unit in the **column header once**, not per cell; exception for symbols
  that read naturally trailing the number. *(thin sourcing — blogs only)*
- **NN/g's empty state** *(fetched)*: state it in place — "There are no records
  to display for the selected date range" — **leaving the table structure
  standing**. The competing "replace the table, hide the headers" model is
  rejected; §7 already forbids it.

---

## 2. SPACING, TYPE, GEOMETRY

### 2.1 Spacing ladders

| System | Ladder (px) |
|---|---|
| Atlassian *(fetched)* | 0 · 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 |
| Carbon component | 2 · 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 |
| Carbon layout | 16 · 24 · 32 · 48 · 64 · 96 · 160 |
| GitHub Primer | 0 · 4 · 8 · 16 · 24 · 32 · 40 |

**Atlassian's usage bands**, worth carrying verbatim: **0–8px** inside components
(icon-to-text, badge padding) · **12–24px** for container padding and gaps
between substantial content · **32–80px** for page-level regions.

**Atlassian also ships negative-space tokens** (`space.negative.025` … `.400`),
stated purpose "breaking out of a container's padding **or for overlapping
elements**". Documented here precisely so it is never reached for.

### 2.2 Type

**Fluent 2's ramp** *(fetched — the strongest primary typographic source found)*,
size/line-height: 10/14 · 12/16 · **14/20** · 16/22 · 20/26 · 24/32 · 28/36 ·
32/40 · 40/52 · 68/92. Its own numbers give a ratio that **tightens as size
grows**: 1.43 → 1.33 → 1.25.

**Carbon's modular formula** *(fetched)*:
`Xn = X(n−1) + {INT[(n−2)/4] + 1} × 2`, from `y0 = 12px`, giving
12 · 14 · 16 · 18 · 20 · 24 · 28 · 32 · 36 · 42 · 48 · 54 · 60 · 68 · 76 · 84 · 92.

**Butterick** *(fetched)*: 15–25px on screen · line spacing **120–145%** · line
length **45–90 characters** · all-caps needs **5–12% extra letter-spacing** and
only for text under one line.

**Butterick on monospace, verbatim:** *"for standard body text, there are no good
reasons to use monospaced fonts. So don't."* His stated exceptions are code and
**tabular numerals** — and a fuel log is columns of numbers, which is his
exception rather than his rule. The honest reading: §8's choice is defensible
precisely where TRITIUM spends most of its pixels, and costs us in prose. Keep
prose short and inside his 45–90 character line.

**No precedent for monospace chrome.** VS Code uses the platform UI font for its
workbench and the code font only in the editor; Ghostty builds genuinely native
chrome per platform; even iA Writer applies monospace only to writing content,
never its own toolbars. iA documents the failure mode too — forcing every glyph
into one box "creates visual awkwardness for wider characters like M, W, m, and
w", which their duospace fixes by giving those four 50% extra width. **TRITIUM's
choice is outside every precedent found. It is settled by §8 and not reopened,
but it is not a well-trodden path and should not be treated as one.**

### 2.3 Radius

- **Fluent 2** *(fetched)*: **4px** default · 2px small · 8px large · 12px
  extra-large · **0px for nav bars and tab bars**. Plus a rule: no rounding where
  two elements in a container abut, or where an element meets a screen edge.
- **JADEITE shipped** `--radius: 6px`, `--radius-sm: 4px`.
- **Nested radius** *(fetched, cloudfour)*: `inner = outer − gap`, i.e.
  `--inner: calc(var(--outer) - var(--padding))`. The popular "outer = 2 × inner"
  rule is just this formula for the case where padding happens to equal the inner
  radius.

### 2.4 Vertical centring — the forbidden techniques

Both mainstream techniques for optically centring text and icons in controls use
**negative margins**, which the no-overlap rule forbids: the "Basekick" method
for stripping line-box leading, and D'Amato's negative `margin-block` for icon
centring. **The compliant replacement is `inline-flex` with `align-items:
center`**, letting padding define the box. Also from D'Amato: prefer
`padding-block` over `min-height` so wrapped text still breathes; **px** for
padding (click targets should not move with font size), **em** where spacing
should track local size, **rem** where it should track a global preference.

---

## 3. DEPTH, COLOUR, SEPARATION

### 3.1 How much luminance separation is actually needed

Computed from IBM Carbon's **shipped token files** (`@carbon/themes@11.79.0`,
`@carbon/colors@11.56.0`) rather than from documentation prose:

**Dark (`g100`), fill-only separation:**

| Step | Hex | L* | Δ | Contrast |
|---|---|---|---|---|
| background | `#161616` | 7.2 | — | — |
| layer-01 | `#262626` | 15.2 | +7.9 | **1.20:1** |
| layer-02 | `#393939` | 24.0 | +8.8 | **1.31:1** |
| layer-03 | `#525252` | 34.9 | +10.9 | **1.48:1** |

**Light:** `#ffffff` → `#f4f4f4` is Δ3.8, **1.10:1**.

**The load-bearing finding:** a fill step alone reads as a distinct surface at
roughly **1.1–1.5 : 1**, far below any text threshold — it only has to be
perceptible as a plane change. **Fill separation and border separation are two
different jobs at two different magnitudes.**

**Borders, same computation:** `border-subtle` lands at **1.5–2.3 : 1**;
`border-strong` at **3.0–3.3 : 1** — which is not a coincidence, it is exactly
the WCAG 1.4.11 non-text floor. Carbon reserves the ≥3:1 border for boundaries
that are the *sole* indicator of something.

**Light themes may need to alternate rather than step.** Carbon's light layers go
white → `gray-10` → white → `gray-10`, because a 1.10:1 step is imperceptible
without a border. The real requirement is not a monotonic ramp: it is that **no
two adjacent, simultaneously visible surfaces resolve to the same value.**

### 3.2 Dark UI

- Material, verbatim: dark surfaces are **"dark grey instead of black, which
  increases visibility for shadows and also reduces eye strain for light text"**,
  and **"shadows are less effective in an app using a dark theme"**. Its
  replacement: **"surfaces become lighter and more colorful at higher
  elevations"** — a fill change, not a shadow.
- Refactoring UI independently: **"true black tends to look pretty unnatural"**.
- **No pure black surface, no pure white text, in any of the eleven.**
- NN/g's caution, worth holding against dark-first instinct: dark mode reduces
  reading speed and comprehension for long-form text. TRITIUM is columns, not
  prose, so the cost is small — but it argues against assuming dark is simply
  better.

### 3.3 Deriving eleven palettes instead of hand-tuning them

Available in this build — **Chromium 150 confirmed by inspecting the binary**,
against gates of 111 / 119 / 123:

- `color-mix()` — Chrome 111. MDN explicitly discourages `srgb` for this
  ("overly dark or grayish mixes"); use **`oklch`/`oklab`**.
- **Relative colour syntax** — Chrome 119. `lch(from var(--surface) calc(l + 8) c h)`
  defines a step as a *formula* rather than a literal, so each palette supplies
  only its true source colours and the rest falls out.
- `light-dark()` — Chrome 123. Less relevant to an eleven-palette system.

**Evil Martians on why OKLCH and not HSL** *(fetched)*: *"Adding 10% lightness
will have different results for blue and purple colors."* Fixing lightness and
varying only hue **guarantees the same contrast outcome across hues** — which is
precisely the eleven-palette problem. Linear moved its whole theme generation to
LCH for the same reason: so relationships stay "perpetually uniform" across hues.

**JADEITE already does this**, deriving a wash/tint/line/mark ladder from one
accent at 12% / 24% / 45% / 88% toward the surface, in OKLCH.

**Alpha borders as an alternative** *(oliverjam, fetched)*:
`outline: 1px solid hsla(0,0%,0%,.25)` reads correctly against every background
it meets — one rule instead of eleven overrides. Requires `background-clip:
padding-box` where the element has its own background.

**Radix's twelve-step scale** is the reference architecture: 1–2 backgrounds ·
3–5 component fills (normal/hover/pressed) · **6–8 borders** (6 subtle
non-interactive, 7 interactive, 8 strong + focus rings) · 9–10 solid fills ·
11–12 text. Fixed *role* per step, repeated identically in every palette, so
switching palette can never swap a text step for a background step.

**Refactoring UI on ramps:** greys alone need **8–10 shades**; define a fixed
9-step ramp up front rather than computing shades on demand — *"that's how you
end up with 35 slightly different blues that all look the same."*

### 3.4 Shadow, and the part that survives

- **Outer `box-shadow` is forbidden** — it paints outside the border box.
  **`inset` shadows and bevels are not**, and Polaris's own token taxonomy splits
  exactly there: Elevation / Inset / Bevel.
- **Single light source still governs.** Comeau: every shadow should share the
  same offset ratio, light from above and slightly left, vertical ≈ 2× horizontal;
  layer several low-opacity shadows rather than one hard one; **tint the shadow
  with the surface hue instead of pure black**, which reads "washed out". Applied
  here: if a carved input implies light from above, every carved element must.
- **One hardcoded alpha across eleven palettes will look wrong in most of them.**
  Fluent ships an actual correction formula —
  `opacity = round(42 − 0.116 × luminosity)` — because a fixed alpha reads
  differently on differently-lit surfaces. The lesson transfers directly to
  border and line alphas.
- **Fluent's own escape hatch, verbatim:** *"Windows notably uses strokes instead
  of key shadows for outlines."* The substitution TRITIUM needs system-wide is
  one Microsoft already makes.
- **Atlassian's pairing rule:** always pair a given surface token with its
  matching depth cue; mismatching them "undermines dark mode differentiation".
  Generalised: each semantic surface type gets one fixed fill+border pairing used
  everywhere it appears.

### 3.5 Accent discipline

Three unrelated systems converge on **accent as a single-purpose signal, never
structure**:

- **GOV.UK**, on `#ffdd00`: *"Only use this colour to indicate which element is
  focused on."*
- **Carbon**: every `border.*` token resolves to a **neutral grey** — the only
  exception is `border.interactive`. Structural separation is 100% achromatic.
- **Material 3**, even where accent *is* the elevation signal, caps the mix at
  roughly **5–14%**.

**The binding constraint for TRITIUM:** `accent` must clear **3:1 against both
`surface` and `surfaceRaised`, in all eleven palettes**, light and dark. That,
not taste, is what limits how saturated or dark any palette's accent may be.

### 3.6 Contrast floors

- Text **4.5:1**; large text (≥24px, or ≥18.66px bold) **3:1**; non-text UI and
  meaningful borders **3:1** (SC 1.4.11).
- **Focus: SC 2.4.13** — note the number. It was **2.4.11 in draft** and
  renumbered before WCAG 2.2 was final, so older sources citing 2.4.11 are using
  superseded numbering. Requires an indicator at least as large as a **2px
  perimeter**, and **≥3:1 between the focused and unfocused states of the same
  pixels** — a contrast-of-change measurement, distinct from contrast against
  neighbours.
- WebAIM's warning against rounding: `#777777` at 4.47:1 **fails**.
- **Eleven palettes make hand-checking non-credible.** These floors have to be
  computed in a test, per palette.

---

## 4. ELECTRON, AND LINUX IN PARTICULAR

Electron 43 ships **Chromium 148 → 150**, Node 24.17, V8 15.0. This build reports
`Chrome/150.0.7871.224`.

### 4.1 Things that will bite

- **`font-variant-ligatures: none`** — see §0.1. Mandatory.
- **`-webkit-font-smoothing` is macOS-only.** It has no effect on Linux or
  Windows, and there is no CSS lever for font smoothing on Linux at all — it is
  entirely a system fontconfig matter. Copying JADEITE's
  `-webkit-font-smoothing: antialiased` would be cargo cult.
- **Open font-rendering regression on Arch + GNOME + Wayland** — issue #47502,
  filed 18/06/2025, screenshots comparing Electron 32 (fine) with 36 (degraded),
  no maintainer response. The maker's platform exactly.

### 4.2 Wayland takes window placement away

- `setPosition`, `center`, `setSize` non-functional; `getPosition` returns
  `[0, 0]`. Electron's own words: *"the compositor — not the app developer —
  decides where it goes."*
- **On Linux, child windows do not move with their parent** (they do on macOS).
  Drag the main window after opening a form and the form stays behind.
- Modal windows on Linux become window type `dialog`, and **many desktop
  environments cannot hide a modal** — so never design a flow that hides and
  re-shows one; close and recreate.
- `--ozone-platform` is a **command-line switch**; the old
  `ELECTRON_OZONE_PLATFORM_HINT` env var is a silent no-op as of Electron 38/39.
  Whether Wayland is default at all is **disputed inside Electron's own tracker**
  — set it explicitly rather than trusting auto-detection.
- **§7's "the compositor draws the decorations" is not literally true on GNOME.**
  Electron ships `ClientFrameViewLinux`, which "uses GTK to paint convincing
  native window frames" itself, because GNOME/Wayland expects client-side
  decoration. KDE's kwin is more likely to give genuine server-side decoration.
  The two major Linux desktops do not necessarily frame TRITIUM by the same
  mechanism, even though both look like a normal titled window.

### 4.3 Translucency is closed on Linux — which is convenient

- `setVibrancy()` is **macOS-only**. `backgroundMaterial` needs **Windows 11
  22H2+**. Electron's docs, verbatim: *"Linux lacks native support for vibrancy
  and background material features."*
- Real window `transparent: true` on Linux has a long broken history, and
  TriliumNext — a shipping Electron app — **reverted it**, because on Wayland it
  "disables the shadow ... which is quite annoying UX-wise". On Wayland it is a
  drop shadow *or* transparency, not both.
- `backdrop-filter` is also the most expensive common effect available: a genuine
  per-pixel convolution whose cost scales with radius **and** area, with
  hardware-dependent behaviour.
- **All three point the same way: flat, opaque, palette-driven surfaces.** The
  no-overlap rule is not costing us anything here that the platform was going to
  give.

### 4.4 Scrollbars

- Two mechanisms: standard `scrollbar-width` / `scrollbar-color`, and legacy
  `::-webkit-scrollbar-*`. **If the standard ones are set to anything but `auto`
  they override the webkit ones** — so pick one. Only the webkit family exposes
  hover states, a styled corner, and thumb radius, so that is the one to use.
- **Overlay (floating) scrollbars are not available**, and the old
  `enable-overlay-scrollbar` switch is long dead. Chromium's default is
  gutter-reserving scrollbars that never float over content — **the platform
  default is already what the no-overlap rule wants.**
- `scrollbar-gutter: stable` stops columns jumping when a scrollbar appears.
- Thumb and track need **≥3:1**, per palette. `@media (forced-colors: active)`
  silently resets `scrollbar-color` to `auto`.
- Counter-argument worth heeding: thin scrollbars hurt users with fine motor
  control, and **in Electron there is no user-side override** — no `about:config`,
  no GTK override. Whatever width we choose is final for everyone.

### 4.5 Performance

- **Only `transform` and `opacity` are compositor-only.** Everything else —
  `color`, `box-shadow`, `filter`, geometry — forces layout and/or paint on the
  main thread.
- `will-change` promotes a layer at real GPU memory cost; remove it after the
  transition ends rather than leaving it on.
- Electron-specific: a renderer's GPU work **round-trips through the main
  process**, so a main process busy with synchronous file work can stall
  rendering even when renderer JS is idle. Relevant to us: reads and writes go
  through main.

### 4.6 Making it feel like an application, not a page

- **`cursor: default` on buttons, tabs and rows; `pointer` reserved for genuine
  hyperlinks.** Native desktop apps use the arrow for controls. TRITIUM has **no
  links at all** — §3.5 makes every address selectable text — so the hand cursor
  should appear nowhere in the app.
- **`user-select: none` broadly, carved out for inputs** — arbitrary click-drag
  highlighting is the loudest "this is a web page" signal. **But §3.5 requires
  the source address to be selectable**, so the carve-out list must include it,
  not only form fields.
- Do not strip the focus outline as a side effect of the `user-select` reset
  without putting an explicit `:focus-visible` treatment back.
- Suppress `-webkit-user-drag` on images and links.
- **Cross-window palette sync is missing today.** Each `BrowserWindow` is
  isolated; the documented pattern is to hold state in main and push it to every
  window. TRITIUM broadcasts `vehicles:changed` but **not palette or language** —
  so a form window opened before a palette switch keeps the old palette. F4b must
  fix this or eleven palettes will visibly desynchronise across windows.
- Wire per-window `focus`/`blur` so the active window reads as active. With a
  main window and form windows routinely open together, otherwise every window
  looks equally "on".
- **Unresolved tension:** a native context menu (`Menu.popup()`) is still an
  overlay at the OS level. It wins on keyboard navigation and does not
  participate in the app's own stacking context, but it does cover what is under
  it. **This needs the maker's ruling: native menu, or no context menu at all.**

---

## 5. THE CRAFT ADVICE THAT SURVIVED SCRUTINY

- **Refactoring UI:** *"most interface problems are hierarchy problems"* — and
  the fix is usually to **de-emphasise the secondary, not amplify the primary**.
  Design in greyscale first, so spacing, contrast and size "do all of the heavy
  lifting", and add colour last. This matters doubly for an eleven-palette app:
  build hierarchy that survives in greyscale, and let palettes be a skin over it
  rather than the thing it depends on.
- **Borders are a last resort, not a first.** NN/g's Harley gives the test to
  apply before adding one: *"Are they necessary to understand the grouping? Can I
  communicate this grouping by simply adding or removing whitespace?"*
- **Kennedy:** every element wants both an up-pop and a down-pop property, tilted
  one way; only page titles get full emphasis. **Never animate size or weight on
  state change.**
- **Rams:** *"Good design is as little design as possible."* And products that
  fulfil a purpose "are like tools ... their design should therefore be both
  neutral and restrained".
- **Hit targets: this is a mouse app, not a touch app.** Microsoft's desktop
  guidance is **16×16px minimum**, splitters ≥5px, with a 3px release tolerance —
  not the 44×44 touch figure. Applying touch minimums here would bloat a dense
  tool for a benefit nobody collects. Also from Microsoft: *"Never require users
  to click an object to determine if it is clickable"*, and the **whole visual
  target must be clickable, not just its label** — the classic engineer bug of
  wiring the `<span>` instead of the row.
- **Density is not pixels.** Ström-Awn defines it as *"the value a user gets from
  the interface divided by the time and space the interface occupies"*. Whitespace
  is not free — past a point it costs the scrolling needed to reassemble a
  picture that a denser layout showed at once.
- **Do not mix the two whitespace regimes.** Kennedy's "double your whitespace"
  is sourced for *chrome* — nav, headers, titles. Kargaev's 32–36px is for the
  *table body*. Applying consumer whitespace ratios to table rows is precisely
  the mistake dense-tool writing exists to warn against.
- **NN/g on modals vindicates §5.1's second windows.** A separate OS window is
  already "nonmodal" by NN/g's own definition, and their preference for
  validation errors is inline, next to the field — never in a further dialog.

---

## 6. WHAT THE RESEARCH DID NOT SETTLE

Recorded so it is not mistaken for settled:

- **No precedent exists for monospace UI chrome** (§2.2). We are on our own.
- **Whether to track uppercase labels** (§0.6) — unresolved, needs a ruling.
- **Whether to have context menus at all** (§4.6) — unresolved, needs a ruling.
- **Ubuntu Aubergine's canonical values** were never fetched; Canonical's brand
  palette still needs reading.
- **No curatorial standard exists for dense desktop software.** The Apple Design
  Awards categories are consumer- and animation-shaped and transfer poorly.
- Adobe Spectrum's row heights, Material 3's current spacing spec, and Carbon's
  per-token line heights all failed to fetch — JS-rendered pages.
- The claim that a 5–10% grey tint suffices for zebra rows **could not be
  confirmed** against NN/g's actual article and is likely a search-summary
  misattribution.

---

## 7. WHAT REAL APPLICATIONS ACTUALLY DO

The sixth researcher returned late, and its findings carry two of the sharpest
warnings in the whole set.

### 7.1 The icon-width problem is real and it is ours

**Nerd Fonts ships three different width strategies because strict monospace and
legible icons are in genuine tension**, and the project says so itself: *Nerd
Font Mono* forces every glyph into the cell width; plain *Nerd Font* lets icons
run double-width and warns it "may require an extra space ... to avoid cut-off or
**overlapped** glyphs"; *Nerd Font Propo* makes icons proportional for GUI use.

**TRITIUM vendors the Mono build.** There are live upstream bugs for oversized
glyphs in Mono builds (#1198), undersized double-width icons in practice
(#4013), and an open PR to rescale non-mono icons to match surrounding weight
(#1926). Combined with the known limit that our vendored font carries only FA 4.7
and FA 6.5.1, **icon rendering must be checked glyph by glyph at the real UI size,
not assumed.** Note the irony worth recording: the plain build's documented
failure mode is literally overlapping glyphs.

### 7.2 The overlay problem has a real solution, and it is JetBrains'

Every celebrated interaction in this category is an overlay. WezTerm's own docs
call its command palette a "modal overlay". Kitty defines a "kitten" as something
that opens "an overlay window over the current window" — and its palette, theme
picker, file picker and diff viewer are all kittens. VS Code's palette and Quick
Open float over the editor; Sublime's Goto Anything and Zed's finder are the same
shape. Obsidian users have filed a complaint that hover previews "obscure pane
contents" — our exact rule, wanted by their users.

**JetBrains' answer is the one to steal:** Quick Documentation appears as a hover
popup, but *"press Ctrl+Q again while viewing the popup to switch to a dedicated
tool window instead."* The overlay is **promotable**. Applied here: a quick peek
need not be banned outright or accepted as an overlay — it can convert on demand
into a docked pane or, matching §5.1's existing convention, a real second window.

JetBrains also keeps tool windows **docked or fully detached to their own OS
window, with no floating-over-content third state** — which is TRITIUM's rule,
already shipped by a major IDE.

### 7.3 Two performance findings that bind F7 and F4b

- **Hyper — the one genuinely Electron terminal — dropped to roughly one frame
  per second** running `find ~`, because its renderer painted the DOM directly.
  Zed's founders describe the same wall from the other side: *"An expensive DOM
  relayout and we missed another frame."* **TRITIUM's dense tables must be
  virtualised; a full-DOM repaint on a long fuel log is the documented failure
  mode.** That is F7's constraint, and F4b must not design anything that forbids
  windowing rows.
- **Hendrik Erz, who builds Zettlr in Electron, watched a preferences dialog run
  at two frames per second**, traced it to a full-screen backdrop-blur, and found
  that "when I disabled the blur-effect out of curiosity, the app suddenly felt
  snappy as hell." His conclusion after rebuilding against the platform
  guidelines: *"Minimalism is key here. We have to restrict ourselves to rather
  basic shapes and colours, and refrain from adding animations."* This is the
  only concretely measured performance killer in the entire research set, and it
  is the same effect §4.3 already rules out on three other grounds.

### 7.4 Test the narrow window before it becomes a complaint

A named, repeated Linux complaint: *"How the hell do slack, discord, and gitter
STILL not collapse their sidebars when you resize the containing window to be
tall and narrow? It makes them unusable in a tiling WM."* That is a fixed
multi-pane app on Linux — **TRITIUM's exact shape and primary platform**. §7 fixes
a 1280 × 720 minimum, but the two-pane body must be tried at narrow and tall
aspect ratios deliberately.

### 7.5 The Linux criticism does not land on us, if we commit

The recurring charge — Electron apps "stick out like a fat wart", "a different
CSS-enhanced, antialias-enabled 90s Winamp skin for each app" — is aimed at apps
that **half-imitate** native GTK chrome and get it inconsistently wrong.
TRITIUM's fully custom, consistently applied monospace and eleven-palette chrome
is a different posture and a more defensible one. **Own the custom look
deliberately; do not half-imitate the desktop.**

Similarly, **GIMP's multi-window failure was not "separate windows"** — it was
undocked, easily lost, floating tool palettes. TRITIUM keeps habitual controls in
the fixed two-pane body and reserves real windows for discrete tasks, which
avoids GIMP's actual mistake by construction. Worth knowing, though, that VS Code
deliberately resists multi-window and closed the request as a duplicate for years
— **forms-as-real-windows is a considered minority position, and should stay a
deliberate call rather than an accident.**

### 7.6 Theming patterns worth taking

- **JetBrains splits chrome tokens from content tokens into two separate
  artefacts** (a JSON UI theme and an XML editor scheme). Scale for calibration:
  JetBrains defines roughly **1,200** chrome keys, VS Code about **300**. Eleven
  hand-maintained palettes want to sit far below JetBrains and nearer the low end
  — but seventeen tokens is at the coarse extreme, and the split between
  application chrome and table content is worth making explicit.
- **Zettlr's model fits us better than Obsidian's**: a small number of complete,
  named, opinionated bundles plus a manual CSS escape hatch — rather than
  exposing every variable and needing a 558-theme gallery to stay legible.
- **Joplin injects its `--joplin-*` variables into every plugin webview** so
  third-party UI matches the host automatically. One token set, broadcast
  outward, never reimplemented per surface — precisely the shape §4.6 says we
  need for form windows.
- **Ghostty's `palette-generate`** derives a full 256-colour ramp from a base 16,
  and **Sublime interpolates 256 stable, distinguishable hues in HSL from a
  handful of anchors**. If per-vehicle or per-category colour is ever wanted,
  that is how to get it without hand-picking colours eleven times over.
- **iA Writer's Focus Mode dims everything else in place** rather than stacking a
  highlight on top — the model for "emphasise this row".
- **Warp's blocks** group a command and its output into a discrete visual unit
  with no z-index tricks at all; **iTerm2's `tmux -CC`** and **Windows Terminal's
  tab tearout** both promote in-pane content to a genuine OS window rather than a
  floating layer. All three are the no-overlap instinct arrived at independently.

---

## 8. FROM HERE

`F4b.md` is the plan; this file is its evidence. Where the two disagree, this
file is the record of what was actually found and the plan is the decision taken
— which may knowingly go against a source, but should never go against one by
accident.
