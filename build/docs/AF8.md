# TRITIUM Android — AF8 · versionName 0.8 · «Export»

Repo path of this file: `~/REPO/build/docs/AF8.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF1.md's own AF-map states AF8 in one line: *"Export — writes F16's bundle
format via `ACTION_CREATE_DOCUMENT`; round-trip test against the real
desktop importer."* F16 is desktop-only and already built — it gives the
desktop an **import** and the format the phone must write, because at the
time F16 shipped "the Android app does not exist yet," and F16 said so
itself: *"this document is not only a milestone record, it is a
specification the unwritten app must satisfy."* AF8 is where that promise
comes due.

The direction stays exactly what F16 fixed: **the phone exports, the
desktop imports.** AF8 adds no import path to Android — XTRITIUM ships no
sync, no cloud, no network of any kind, and a phone that could also import
would need its own merge/skip-wins/backup logic mirroring F16's, which is
scope this milestone does not need to open. One direction, settled once, on
the desktop.

---

## 1. WHERE AF8 SITS

### 1.1 What F16 already fixed, binding on this milestone

F16.md §2.2, quoted because it is this milestone's actual specification,
not merely background: one TOML file, `format = "tritium-export"`,
`format_version = 1`, `exported` (a bare local date), `source` (free text,
"who made this file"), then one or more `[[vehicle]]` tables, each carrying
`slug` plus every `vehicle.toml` field, and nested `[[vehicle.fuel]]` /
`[[vehicle.costs]]` / `[[vehicle.service]]` arrays using the exact field
names `fuel.toml`/`costs.toml`/`service.toml` already use.

Three rules from F16 §2.2 are non-negotiable because the importer already
enforces them:

- **No `id` key on any entry.** F16 decision 2 — ids are file-local and
  non-monotonic; two devices numbering independently would both mint
  `f-0005`. `importBundle` ignores an id if one arrives; AF8 simply never
  writes one.
- **No `total` key.** Derived values are never stored, on either platform.
- **Figures are written as entered** — `29.990`, `11746.00` — the same
  human-readable text `fuel.toml`/`costs.toml`/`service.toml` already use,
  not a raw scaled integer. `Scaled.formatPump`/`formatMoney`/`formatTank`
  already produce exactly this text; AF8 reuses them, it does not
  reinvent them.

### 1.2 Decided from precedent

| Decision | Answer | Source |
|---|---|---|
| `source` | `"android"` | F16 §2.2's own worked example header comment: `source = "android"` |
| `exported` | Today's local calendar date, via `Format.todayIso()` — never read inside the writer from a live clock, matching `FuelDraft.quickAddDefaults`'s own discipline | F16 §2.2; AF7.md's `Range.kt` precedent for "`today` arrives as a parameter" |
| Which vehicles | **All of them**, one bundle, every `[[vehicle]]` block the phone has — not a per-vehicle picker | F16 §2.2 explicitly allows "Multiple `[[vehicle]]` blocks," and the maker's own workflow (F16 §0's own frame: *"once a month he brings that month across"*) is a whole-phone sync, not a vehicle at a time |
| A vehicle with no records | Included anyway, with empty entry arrays | F16 §2.2: "A vehicle with no records at all is legal, and imports as a vehicle" |
| Where the button lives | Settings tab, a new "Export" section | Mirrors the desktop's own placement — F16 §2.3: `SettingsPane.tsx`, "the Import section" |
| The save path | `ACTION_CREATE_DOCUMENT`, Android's own native file-save picker | AF1.md's own AF8 line names it explicitly; matches F16 decision 6's reasoning for the desktop's own native `dialog` module — a picker drawn outside the app's own surface is not the HTML/Compose modal any layout-overlap rule would ban |
| MIME type on the intent extra | `application/octet-stream` — Android's `ACTION_CREATE_DOCUMENT` requires some value, but the closest available answer to F16 §3's "no MIME type, no file association" | F16 §3 SCOPE OUT, applied to Android's own API constraint rather than ignored because the constraint exists |
| Suggested filename | `tritium-export-<today>.toml` | Matches the `exported` field inside the file; makes repeat exports on the same day distinguishable from the picker alone if the maker renames one |
| Reused writer code, not a second one | `EntrySpec.emitEntry` split into `emitEntryFields` (no id) + a default `emitEntry` that prepends it; `VehicleFile.kt` gains `emitVehicleFields` the same way | The desktop's own reason for reusing `FUEL_SPEC.readEntry` on the import side, applied to the Android write side: "a second reader [writer] here would drift from the first one within a milestone" (F16 `import.ts` header comment) |

### 1.3 The round-trip test, and why it can be real this time

`import.test.ts`'s own header comment, written before AF8 existed, explains
why every bundle in that file is hand-typed: *"This app has no export: the
file always comes from somewhere else, and a test that fed the importer
its own output would be proving the wrong thing."* That was true of the
desktop testing itself. It stops being true the moment a second,
independent implementation exists to feed it — which is exactly AF8.

So AF8 adds one thing `import.test.ts` structurally could not have: a test
that takes a bundle **actually produced by the Android code**, on a real
device, and feeds it to the desktop's own unmodified `importBundle`,
against a temp `XDG_DATA_HOME`, asserting the resulting `vehicle.toml`/
`fuel.toml`/`costs.toml`/`service.toml` files are what F16's own contract
promises. This is the "round-trip test against the real desktop importer"
AF1.md's AF8 line names — not a simulation of the importer, the importer
itself, unmodified, imported from `src/main/storage/import.ts`.

It lives in the desktop's own `tests/` tree, because that is where Node,
`vitest`, and the real `import.ts`/`bundle.ts` already are — there is no
Kotlin equivalent to run TypeScript against. It is not wired into
`android-ci.yml` (Kotlin/Gradle, no Node) or `package.yml` (tag-triggered
only, per that workflow's own comment) — no existing CI trigger crosses
that boundary, and building one is a CI-infrastructure decision bigger than
one milestone's export button. AF8 runs it by hand, once, against a real
on-device export, and records what it proved — matching the device-
walkthrough discipline every AF since AF5 has used for the thing an
automated suite cannot fully stand in for.

---

## 2. SCOPE — IN

1. **`EntrySpec.emitEntryFields` split out**, `FuelFile.kt`/`CostFile.kt`/
   `ServiceFile.kt` updated. Zero duplication between the record-file writer
   and the bundle writer — the same "second caller promotes a helper"
   pattern AF6/AF7 already used for `highestOdometer`/`signedAmount`.
2. **`VehicleFile.kt` gains `emitVehicleFields`**, the same split, for the
   same reason.
3. **`storage/Bundle.kt`** — `Bundle.build(vehicles: List<VehicleBundle>,
   exportedDate: String): String`, the envelope plus one `[[vehicle]]`
   block (and its three entry arrays) per vehicle, via the fields above.
4. **`ui/SettingsViewModel.kt`** grows `exportBundle(): String`, assembling
   every vehicle from `VehicleRepository` and calling `Bundle.build`.
5. **`ui/screens/SettingsScreen.kt`** grows an Export section: a button,
   `rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(...))`,
   writing the bundle text to the chosen `Uri` via `ContentResolver`, and a
   snackbar/message on success or failure.
6. **`test/.../storage/BundleTest.kt`** — the envelope's exact keys, no
   `id`/`total` anywhere in the output, a vehicle with zero entries still
   producing legal empty `[[vehicle.fuel]]`-free output (no empty array
   header emitted — TOML has no bare `[[x]]` for zero elements the same way
   `entry-file.ts`'s own `[[entry]]` loop naturally emits nothing for an
   empty list), figures rendered exactly as `Scaled.formatPump`/
   `formatMoney`/`formatTank` already produce them.
7. **`res/values{,-tr}/strings.xml`** — the Export section's strings.
8. **The round-trip test** — a new file in the desktop's own `tests/`
   tree, run by hand against a real on-device export (§1.3), not gated in
   any CI.

## 3. SCOPE — OUT

No import on Android — one direction, F16's own. No MIME type registration
or file association beyond the one intent extra `ACTION_CREATE_DOCUMENT`
requires. No background/scheduled export, no cloud, no network — XTRITIUM
§3's "Zero network. Ever." untouched. No per-vehicle export picker — always
every vehicle, §1.2. No CI wiring for the cross-stack round-trip check —
named explicitly here as a real gap, not silently dropped, matching
XTRITIUM's own "write reality, not ambitions" discipline.

---

## 4. ACCEPTANCE CRITERIA

1. `./gradlew check` is green: `BundleTest` and every prior milestone's
   suite.
2. A bundle exported from a phone with two vehicles, one with entries and
   one without, opens in a text editor and matches F16 §2.2's shape
   exactly: no `id`, no `total`, figures as entered, bare local dates.
3. That exact file, fed to the desktop's real, unmodified `importBundle`
   against an empty temp data root, creates both vehicles and every entry,
   with the empty vehicle importing with zero records and no error.
4. Importing the same exported bundle a second time adds nothing — the
   desktop's own skip-wins keys (`fuelKey`/`costKey`/`serviceKey`) already
   guarantee this; AF8 proves it rather than assuming it.
5. AF1–AF7's own test suites stay green.
6. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme: untagged by default, sideloaded from the
maker's own build. `AF9`'s own doc is written after AF8 exits.
