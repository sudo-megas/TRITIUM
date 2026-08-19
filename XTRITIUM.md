# TRITIUM — XTRITIUM

**Fuel Logging / Maintenance Tracking for any ICE Vehicle**

This document is the constitution of the project. Every decision below was made
deliberately, one at a time, before a line of code was written. When code and XTRITIUM
disagree, XTRITIUM wins until XTRITIUM is amended. Amendments are edits to this file with
a dated note — never silent drift.

Repo path of this file: `~/REPO/XTRITIUM.md` (repo root).
Milestone documents live in `~/REPO/build/docs/F<N>.md`.

---

## 1. IDENTITY

| | |
|---|---|
| Name | **TRITIUM** (product), `tritium` (app id, binary, desktop file, data dir) |
| Family | Megas — app 6, alongside SAAT, JADEITE, PARACHRON, INDIUM, RESONANCE |
| What it is | A local, offline fuel and vehicle-cost journal — a curated subset of Fuelio's ideas plus the maker's own two spreadsheets, built precisely |
| Platform | **Arch Linux exclusively** (desktop phase). Android follows later as a **full, separate rewrite** on its own branch |
| Licence | **GPL-3.0-or-later** |
| Distribution | Local build → `.pkg.tar.zst` → the maker's own `megas-xlr` pacman repo. **No AUR. No CI.** |
| Attribution | No AI attribution anywhere: no commit trailers, no mentions in docs, code comments, or release notes |

---

## 2. STACK

Decided by reading JADEITE v1.2.0's actual `package.json`, then subtracting what
TRITIUM does not need (encryption, SQL) and adding what it does (TOML).

| Layer | Choice | Note |
|---|---|---|
| Runtime | **Electron, latest stable** at scaffold time, pinned exact | Deliberately *not* pinned to JADEITE's 42 — 42 was merely current when JADEITE shipped |
| Language | **TypeScript**, `strict: true` | ESLint + Prettier |
| Frontend | **React 19** + react-dom | JADEITE's choice, kept |
| State | **zustand** | |
| Tables | **@tanstack/react-table 8** | Carries the dense-table view |
| Charts | **ECharts 6** | JADEITE's Altın Eğrisi library, confirmed from its manifest |
| i18n | **i18next + react-i18next** | |
| Storage format | **TOML** via **smol-toml** | See §4 |
| Styling | **Plain CSS with custom properties** | No framework. This is how JADEITE switches palettes instantly |
| Build | **electron-vite + electron-builder** | |
| Package manager | **npm** | |
| Tests | **vitest** (unit) + **@playwright/test** (e2e) + audit scripts | Heavy suite is a stated goal |
| Dependency budget | Soft — a dep is welcome when it does real work; unused deps are the sin | |

Dropped from JADEITE's list: `argon2`, `better-sqlite3-multiple-ciphers` — no
encryption, no database, and with them goes every native-module packaging headache
JADEITE's README documents.

---

## 3. HARD PRINCIPLES

These are not preferences. Violating one is a bug.

1. **Zero network. Ever.** No fetch, no lookup, no update check, no telemetry, no
   analytics, no crash reporting. An `audit-egress` script fails the build if any
   network primitive appears in source.
2. **No encryption, no password, no lock.** Fuel logs are not secrets. The app
   opens straight into the data.
3. **Only realised data.** No estimates, no projections *of future entries*, no
   recurrence engine, no reminders, no "guessing game". (Derived statistics over
   existing data — averages, projections *as statistics* — are fine; creating or
   suggesting entries the user did not make is not.)
4. **Plaintext, hand-editable storage.** A person with Neovim can read and repair
   every byte of their data.
5. **The app opens no browser and follows no link.** Every address — About page,
   vendor URLs — is selectable text, never clickable.
6. **No locale detection.** English on first launch, Turkish by manual switch,
   nothing read from the OS.
7. **Derived values are never stored.** Total cost, l/100km, cost/km, monthly
   sums — all computed at read time from the entered figures. One source of truth.
8. **All entries are editable at any time.** The app warns about suspicious input
   (e.g. backwards odometer) and then accepts the user's word.

---

## 4. STORAGE

### 4.1 Layout

```
~/.local/share/tritium/
├── settings.toml
└── vehicles/
    └── <vehicle-slug>/
        ├── vehicle.toml    # the vehicle record
        ├── fuel.toml       # all fill-ups          [[entry]]
        ├── costs.toml      # İLK ALIŞ + TEKRAR EDEN + manual   [[entry]]
        └── service.toml    # Periyodik Bakım       [[entry]]
```

- Whole files are loaded into memory at launch; whole files are written back on
  change. At this app's realistic scale (~600 records/decade/vehicle) this costs
  milliseconds.
- **Atomic writes, always:** write to a temp file in the same directory, `fsync`,
  `rename` over the target. Power loss yields the old file intact or the new file
  complete — never a torn one.
- Backups are the user's business: copy the directory, or point RESONANCE at it.
  The app ships no backup feature, no export feature, no import feature, no MIME
  type.

### 4.2 Schema versioning

Every file carries `schema_version = <int>` at the top. On read, an older version
is upgraded in memory and written back on the next save. No migration framework.

### 4.3 Money and measures

TOML stores the human-readable figures as entered (`73.38`, `36.789`). Internally,
all arithmetic runs on scaled integers (money ×100, litres and price ×1000),
converted once at load. Sums are exact; files stay readable.

### 4.4 Record shapes (reference)

```toml
# settings.toml
schema_version = 1
[general]
language = "en"            # "en" | "tr" — manual only
currency = "TRY"           # asked ONCE at first launch, then fixed forever.
                           # No exchange rates, no conversion, ever.
[units]                    # each independent of language, persisted
distance    = "km"         # "km" | "mi"
volume      = "l"          # "l" | "gal"
consumption = "l100km"     # "l100km" | "kml" | "mpg"
[format]
decimals_consumption = 2   # configurable
decimals_cost_per_km = 3
[appearance]
palette = "<palette-id>"   # one of eleven, §8
```

```toml
# vehicle.toml
schema_version = 1
name = "SPORTAGE 1.6 T-GDI"
make = "Kia"
model = "Sportage"
year = 2025
engine = "1.6 T-GDI"
fuel_spec = "Kurşunsuz 95"
plate = ""
vin = ""
tank_capacity_l = 54.0
purchase_date = 2025-04-25
purchase_price = 2160000.00
registration_date = 2025-04-26
inspection_due = 2027-04-01     # passive reference only — nothing watches it
# NO photo field. Vehicles have no photos anywhere in TRITIUM.
```

```toml
# fuel.toml — one [[entry]] per fill-up
[[entry]]
id = "f-0001"
date = 2026-08-16
odometer_km = 19764
litres = 29.990                # entered
price_per_litre = 73.380       # entered
full_tank = true               # meaningful — see §5.2
fuel_type = "Kurşunsuz 95"     # from a fixed pick-list (95, 97, dizel, LPG…)
# total = litres × price — DERIVED, never stored
```

```toml
# costs.toml — İLK ALIŞ, TEKRAR EDEN (except Periyodik Bakım), MANUAL
[[entry]]
id = "c-0001"
date = 2026-04-11
group = "tekrar-eden"          # "ilk-alis" | "tekrar-eden" | "manual"
category = "trafik-sigortasi"
title = "Trafik Sigortası 26/27"
amount = 11746.00
income = false                 # negative costs (payouts, refunds) = true
payment_method = "kredi-karti" # editable list; ships: EFT, kredi kartı, banka kartı
bank = "Enpara"                # its own field — totals by bank become possible
instalment = "Taksit 6"        # plain text, no engine behind it
note = ""
```

```toml
# service.toml — Periyodik Bakım (the PERİYODİK BAKIM sheet's shape)
[[entry]]
id = "s-0001"
date = 2025-05-14
part = "Michelin Primacy 4 S1 235/50R19 103V XL"
odometer_km = 370
amount = 8664.00
vendor = "https://www.lastikcim.com.tr/…"   # selectable text ONLY, never a link
```

---

## 5. THE FUEL MODEL

### 5.1 Entry

The user enters **litres** and **price per litre**. **Total is derived** —
`29.990 l × 73.380 ₺/l → 2.200,67 ₺` — and shown live on the form, never stored.
Odometer is absolute only, with the previous value shown as a hint. A backwards
odometer triggers a warning and is then accepted (typos in *old* entries must be
fixable, and the user's word is final).

Two entry paths (both are movable, non-anchored popup windows — real separate
Electron windows, draggable outside the main one):

- **Quick-add:** odometer, litres, price/litre — done. Everything else editable later.
- **Full form:** all fields of §4.4.

### 5.2 Consumption — the full-tank algorithm

Partial fills exist (decision reversed late, deliberately: "don't know what future
will bring"). Therefore consumption is computed **only between consecutive
full-tank entries**, exactly as Fuelio does:

- Sort a vehicle's entries by odometer.
- A consumption data point exists **only at a full-tank entry** that has an
  earlier full-tank entry before it.
- `litres` = this full entry's litres **plus every partial fill's litres in
  between**.
- `distance` = this full entry's odometer − previous full entry's odometer.
- `l/100km = litres ÷ distance × 100`.
- Partial entries and the first-ever entry produce **no** data point.

Mis-flagging full/partial shifts the figures on both sides — the flag is a real
field, not decoration. Tank capacity is set once on the vehicle; there is no tank
-level estimation anywhere ("an app that targets precision" does not guess).

---

## 6. THE COST MODEL

### 6.1 Category tree (user-authored, final)

```
İLK ALIŞ            TEKRAR EDEN          MANUAL ENTRY
├─ Kapora           ├─ Periyodik Bakım   └─ add custom: …
├─ Araç Bedeli      ├─ MTV 1
├─ Noter (Ruhsat)   ├─ MTV 2
├─ Plaka (Noter)    ├─ Trafik Sigortası
└─ Plaka (Ş.O)      └─ Kasko
```

Every Fuelio category is dropped (Servis, Bakım, Kayıt, Park, Yıkama, Geçiş
Ücreti, Bilet/Ceza, Modifiye, Sigorta). **Tolls are deliberately not tracked.**

### 6.2 The form adapts to the category

- **İLK ALIŞ and TEKRAR EDEN (money categories)** → payment method + bank +
  instalment fields appear.
- **Periyodik Bakım** → part + odometer km + vendor fields appear; entries land
  in `service.toml`.
- **MANUAL** → the money shape.

No cost templates. No recurrence. No attachments — documents are PARACHRON's job.

---

## 7. THE INTERFACE

| Decision | Value |
|---|---|
| Shape | **Top tab bar above two big panes.** Deliberately not the JADEITE/INDIUM sidebar — fresh air |
| Windows | One main window; entry forms as movable popup windows; **per-chart fullscreen button** |
| Window chrome | The compositor draws decorations. Minimum size **1280 × 720** |
| Lists | **Dense tables** (TanStack), given the same time-range chips as the charts |
| Search | None. Filtering is the range chips |
| Shortcuts | None |
| Tray / autostart | None |
| Empty state | Empty cells in the same layout as a filled app — no "get started" screens |
| Vehicles | Multiple, with a picker. **No photos** |

Tab list and pane contents are **design-phase work** (§11) — XTRITIUM fixes the frame,
not the furniture.

### 7.1 Summary page blocks (settled)

Vehicle header (name + odometer, no photo) · Gas card (average consumption, last
consumption, last price + date) · Costs card (this month vs previous month) ·
**Trend cards as a static grid, all visible at once — no carousel** · Last
entries · Lifetime totals (spend, distance, litres).

### 7.2 Charts (settled)

Seven detailed charts: **Fuel Consumption · Monthly Costs · Gas Price · Fill-up
Costs · Odometer · Cost per Kilometer · Monthly Distance.**

Each with: Fuelio's time-range chips (All time, YTD, Previous year, This month,
Previous month) **and** a custom date-range picker; tooltip, zoom, pan;
line/area/smooth toggles; **no average reference line**; fullscreen button.
Bar charts carry a data table beneath, as in Fuelio.

### 7.3 Statistics

A **dedicated section of its own**: best and worst tank, km per day, projected
annual cost, true cost per km including purchase price — computed over realised
data only.

---

## 8. LANGUAGE, UNITS, FORMAT, TYPE

- **English default at first launch. Turkish by manual switch. Never detected.**
- Units are **independent of language**, each its own persisted setting:
  km/miles, litres/gallons, l/100km / km/l / mpg.
- **Currency is asked once at first launch and then fixed forever.** No rates, no
  conversion — the family rule ("currencies never mix") holds.
- Numbers and dates in the family convention, both languages: **`1.234,56 ₺`**
  and **`GG/AA/YYYY`**.
- Decimal precision configurable (defaults: consumption 2, cost/km 3).
- Font: **CaskaydiaCove Nerd Font Mono** for the whole UI — it suits an app that
  is mostly number columns. Icons come from the **Font Awesome glyphs already
  patched into the Nerd Font** — no icon library dependency.
- Theming: **JADEITE's ten palettes, ported, plus an eleventh: Ubuntu Aubergine
  (Canonical).** All palettes are CSS custom properties, switched instantly,
  stored in `settings.toml`.

---

## 9. BUILD, VERSION, RELEASE

### 9.1 Versions ride milestones (decimal roll)

One milestone, one version, one tag. The patch digit **rolls at ten**: the tenth
version of a series is `.0` of the next, never `.10`.

The desktop phase is finished, so the rows below are no longer an illustration.
Every one of them is a tag in this repository:

```
F1  → v0.1.0      F5  → v0.1.5      F10 → v0.2.0
F2  → v0.1.1      F6  → v0.1.6      F11 → v0.2.1
F3  → v0.1.2      F7  → v0.1.7      F12 → v0.2.2
F4  → v0.1.3      F8  → v0.1.8      F13 → v0.2.3
F4b → v0.1.4      F9  → v0.1.9      F14 → v0.2.4
```

**Amendment — 19/08/2026.** This table used to run `F1 → v0.1.0` straight
through the F-numbers, which printed `F5 → v0.1.4` and left every row after it
one short. The **rule** was never wrong; the **illustration** was. It assumed one
milestone per F-number, and **F4b** — the design milestone inserted after F4 —
took a version of its own, shifting everything behind it by one.

The decimal roll is the part that came through untouched, and F10 is where it
earned its place: the shifted map put F10 at `v0.1.10`, which is not a version
this project uses, so F10 took **v0.2.0** — precisely what the roll is for.

`build/docs/issues.md` I-10 carried this from F4b to today, deferred each time as
an amendment rather than a correction. It was a correction: the tags were already
the fact, and the table was only failing to print them.

The Android phase (separate rewrite, branch **`android-port`**, milestones
AF1, AF2, …) ends at **v1.0**.

### 9.2 The PUTAG protocol

Nothing is implicit. Each milestone ends only on the maker's signal:

- **`PUTAG`** → commit locally → tag locally → build locally. **No push.**
- **`PUTAGREL`** (final milestone only) → commit → tag → build → push → release.

### 9.3 Packaging

- `PKGBUILD` lives **in this repo** (`packaging/PKGBUILD`), builds from a **git
  tag**, produces `tritium-<ver>.pkg.tar.zst`.
- Built in a **clean chroot** (`extra-x86_64-build`) so stray host deps cannot
  sneak in.
- **The maker signs packages himself** and places them into `megas-xlr` himself.
  TRITIUM's tooling never touches that repo.
- Desktop integration: `tritium.desktop` + hicolor icons in multiple sizes
  (**icon PNGs are supplied by the maker into the build path during the build**).
  No MIME type — there is no custom file format to claim.

### 9.4 Quality gates

`npm run build` and `npm test` both run the audit scripts first, in the JADEITE
pattern: `audit-egress` (no network primitives), `audit-strings` (no hardcoded
UI strings outside i18n), `audit-colours` (no colours outside the palette
variables), `audit-locale` (no locale-detection calls). vitest for units —
the consumption engine, scaled-integer money, TOML round-trips, atomic writes —
Playwright for flows.

---

## 10. DOCUMENTATION

- **README** in the family convention: banner, badges (version / release date /
  licence / Arch package size), bilingual subtitle, numbered ALL-CAPS sections
  (DESCRIPTION, DEPENDENCIES, INSTALLATION, HOW TO USE, LICENCE SUMMARY),
  "Built with Reason and Passion."
- **About page** in the family cult layout: the mark, the maker, version,
  release date, source address, full licence text — addresses selectable, never
  clickable.
- Milestone docs: `build/docs/F<N>.md`, one per milestone — scope, tasks,
  acceptance criteria, exit by PUTAG.

---

## 11. OPEN — RESERVED FOR THE DESIGN PHASE

Deliberately not decided yet; to be settled together before the milestones that
need them:

1. Final tab list and what lives in each pane of the two-pane layout.
2. Visual design of forms, tables, cards; spacing and density.
3. The eleven palettes' exact values (ten ported from JADEITE + Aubergine).
4. Bilingual subtitle wording, README banner, icon artwork (maker supplies PNGs).
5. Exact milestone count and the full F-map beyond F1 (sketched in F1.md §1,
   confirmed as each milestone document is written).
