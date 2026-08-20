# AF9b — TRITIUM Android · «Import»

## Context

AF9 closed last window at ~99% completion, per the maker's own standing
instruction to stop right before AF10 — the actual GitHub release — for a
plan-mode check-in rather than proceeding straight through. Before that
release happens, the maker found a real gap and named it directly: the
phone needs **import**, not only export, because the actual scenario is
*"if I purchase a new phone in the future"* — moving a phone's own history
onto its replacement. Right now the only device that can read a TRITIUM
bundle back in is the desktop (F16). A phone that is lost, broken, or
simply replaced has no way to receive an old phone's export.

AF8.md said so itself, explicitly ruling this out at the time: *"AF8 adds no
import path to Android... a phone that could also import would need its own
merge/skip-wins/backup logic mirroring F16's, which is scope this milestone
does not need to open."* AF9b is where that scope opens — a second lettered
milestone, after AF6b, inserted before AF10 exactly as AF6b inserted itself
before AF7. It does not touch AF10's own reserved territory — signing, the
release workflow, README finalisation, the `v1.0` tag — and it does not
move `versionName` forward, matching AF6b's own corrected precedent that a
lettered insertion does not own a version number (AF6b.md §1.2).

**What makes this cheap:** AF8's export already writes exactly the file F16
already specified and the desktop already reads. Nothing about the format
changes. The whole gap is "Android has never read its own output back in" —
closed by a field-for-field port of the desktop's own `import.ts`/
`bundle.ts`/`backup.ts` (F16), onto Kotlin classes that already exist for
almost every piece of it: `VehicleFile.kt`'s `readVehicleTable` (its own
doc comment already named this exact future use — *"AF8's import will need
to read a vehicle from a bundle's `[[vehicle]]` table without
re-implementing this"*), `EntrySpec.readEntry` (`FuelSpec`/`CostSpec`/
`ServiceSpec`, already built for the record files themselves), `Backup.kt`
(ported at AF2 for the update/remove paths, unused by import until now),
and `Bundle.kt`'s own format constants (AF8, only ever used for writing
until now). What's missing is the merge algorithm (`mergeEntries`,
skip-wins per kind) and the plan-then-write orchestration — neither has an
Android counterpart yet.

---

## §1 WHERE AF9b SITS

### 1.1 Decided from the desktop's own precedent (F16, read in full)

| Decision | Answer | Source |
|---|---|---|
| Direction | Android gains import; desktop's own scope (import-only, no export) is untouched — Android catching up to a capability desktop already had | F16 §1.1, AF8.md §0 |
| Identity across devices | No id crosses the boundary — an id present in a bundle is ignored; the receiving file allocates its own from its own highest | F16 decision 2 |
| "Same record" test, per kind | fuel: `date`+`odometer_km`. service: `date`+`odometer_km`+`part` (tyres and an oil change, same day, same reading, are still two records). costs: `date`+`category`+`amount` (no odometer on a cost at all) | F16 decision 3, `bundle.ts`'s `fuelKey`/`serviceKey`/`costKey` |
| A vehicle already on this phone | `vehicle.toml` is left alone — a bundle only adds entries, it never rewrites the vehicle record | F16 §2.2 |
| A vehicle not yet on this phone | Created from the bundle's own `[[vehicle]]` table, stripped of `slug`/`fuel`/`costs`/`service` first — the exact bug `import.ts`'s own comment names: leaving those keys in makes the vehicle reader carry a whole fill-up history into `vehicle.toml` as one inline blob | `import.ts`'s `vehicleTableOf`/`BUNDLE_VEHICLE_KEYS` |
| Nothing half-applied | The whole bundle is validated and the whole merge computed before any file is touched — a refusal or an existing file that will not parse leaves disk exactly as it was | F16 §2.1 decision 4 |
| Nothing destroyed quietly | Every file about to change, backed up in one round before the write phase, reusing `Backup.kt` exactly as `updateFuelEntry`/`removeFuelEntry` already do. A brand-new vehicle has nothing to preserve; a vehicle where everything was skip-wins-deduped changes nothing — both get no round | F16 decision 4 |
| A bundle this build doesn't understand | Refused outright — `format` must equal `"tritium-export"`, `format_version` must not exceed what this build knows. Nothing is written | F16 decision 5 |
| Where the file comes from | `ACTION_OPEN_DOCUMENT`, MIME filter `"*/*"` — F16 §3 registers no MIME type for this format, so filtering by one risks hiding a legitimate file however another app happened to tag it | Mirrors AF8's own `ACTION_CREATE_DOCUMENT`, read-side |
| Existence/readability check | Handled once, in the UI layer, via `ContentResolver.openInputStream` returning null/throwing — `Bundle.read`/`VehicleRepository.importBundle` take the text already in hand, unlike desktop's path-based `existsSync`, a main-process artifact Android's `Uri`-based SAF flow doesn't need | Platform-appropriate adaptation |
| The report shown to the maker | Two numbers only — total added, total skipped, summed across every vehicle and kind — on success; one generic "not imported, nothing changed" on any refusal, matching desktop's own `runImport`, which does not surface *why* a refusal happened either | `SettingsPane.tsx`'s `runImport`, read in full |
| Where the button lives | Settings screen, a new Import section, beside AF8's own Export section | Mirrors `SettingsPane.tsx`'s own placement |
| A fresh phone, zero vehicles | Importing sets the active vehicle to the first one the bundle created, **only** when nothing was active before — never switching the maker away from a vehicle already in use | `HomeViewModel.createVehicle()`'s own precedent: *"Makes the new vehicle active, since creating one with nothing else on the phone is the obvious thing to switch to"* |
| Versioning | Rides on AF9's own versionName ("0.9"), not bumped | AF6b.md §1.2 |

### 1.2 What does not cross the boundary, named because one field is not harmless to get wrong

F16's format (§2.2) carries vehicles and entries only. Language, units,
decimals, theme and **currency** all stay device-local — exactly as they
already do between the desktop and the phone today. Most of that is cheap
to re-pick on a fresh phone. Currency is not: `SettingsViewModel.setCurrency`'s
own doc comment says it is *"asked once, at first launch, fixed forever"* —
no settings screen ever offers to change it again (AF3.md §2). A maker
setting up a genuinely new phone answers `CurrencyAskDialog` before Import
is ever reachable; picking differently than their old phone did leaves
every imported amount rendering under the new symbol with no way to
correct it afterward. This milestone does not reopen `setCurrency`'s own
scope to fix that — it names the caveat once, at the point it matters:
`import_hint`, and here.

---

## §2 SCOPE IN

1. **`storage/Bundle.kt`** — `fuelKey`/`costKey`/`serviceKey`, `Counts`
   (per-vehicle tally shape: fuel/costs/service), `ImportTally` (with
   `totalAdded()`), `ImportResult`, a `BundleRefusal` sealed type
   (`Unreadable`/`NotABundle`/`TooNew`), `BundleError`, and
   `Bundle.read(text): TomlTable` — the envelope parse and version guard,
   pure, no filesystem. Mirrors `shared/bundle.ts` 1:1.
2. **`storage/Import.kt`** — the pure merge layer: `mergeEntries` (skip-wins
   per kind, ids allocated from the receiving document's own highest,
   returns `MergeCounts(added, skipped)` — a per-kind pair, distinct from
   `Bundle.kt`'s per-vehicle `Counts`), `BUNDLE_VEHICLE_KEYS`,
   `vehicleTableOf`.
3. **`storage/VehicleRepository.kt`** — `importBundle(text, now)`: plan
   every `[[vehicle]]` block against what's on disk now, one backup round
   for every touched file, one write per file. A member function, not a
   free function taking `paths` separately — every other mutation already
   lives here with `paths`/`Backup` as private collaborators. Stays
   ignorant of `ConfigState`, matching AF1's stateless-repository boundary.
4. **`ui/SettingsViewModel.kt`** — `importBundle(text)`, delegating to the
   repository, then setting `activeVehicleSlug` to the first imported
   vehicle only when it was null before (§1.1).
5. **`ui/screens/SettingsScreen.kt`** — an Import section: `OpenDocument`
   launcher, `ContentResolver` read, the added/skipped report or the
   generic failure text. Test tags `importButton`, `importReport`.
6. **`res/values{,-tr}/strings.xml`** — `import_title`, `import_hint`,
   `import_action`, `import_success`, `import_failure`.
7. **`test/.../storage/BundleTest.kt`**, **`ImportTest.kt`** — hand-typed
   TOML fixtures only, never `Bundle.build`'s own output (F16's own reason:
   *"a test that fed the importer its own output would be proving the
   wrong thing"*).
8. **`androidTest/.../ImportFlowTest.kt`** — an existing-vehicle merge case
   and a fresh-phone (zero vehicles) auto-activate case.

## §3 SCOPE OUT

- **No conflict-resolution UI** — one rule, skip-wins, and it is written
  down (F16 §3).
- **No partial/selective import** — a bundle imports whole, matching AF8's
  own "always every vehicle, never a picker" symmetry.
- **No import-on-launch or watched folder** — happens only when the maker
  asks (F16 §3).
- **No change to AF8's export path** — the two stay fully independent,
  sharing only `Bundle.kt`'s format constants.
- **`settings.toml` does not cross the boundary** — §1.2, named rather than
  silently dropped, currency specifically called out.
- **No `format_version` bump** — this milestone reads exactly what F16 and
  AF8 already agreed on; widening the format is out of scope.

## §4 ACCEPTANCE CRITERIA

1. Settings offers an Import section beside Export, with a working file
   picker.
2. A hand-typed bundle creates a new vehicle exactly as F16 §2.2 describes,
   and adds entries to an existing vehicle without rewriting its
   `vehicle.toml`.
3. Re-importing the same bundle adds nothing the second time; the record
   files are byte-identical before and after the second import.
4. No entry in any record file carries an id from a bundle; ids are the
   receiving file's own, allocated from its highest.
5. A bundle with a higher `format_version`, the wrong `format`, or
   malformed TOML is refused and leaves every file on disk untouched.
6. `backups/` holds a pre-import copy of every file an import actually
   changed, and none for a freshly created or an all-skipped vehicle.
7. Importing on a fresh phone (zero vehicles) leaves the imported vehicle
   active and visible on Home, not the empty state; importing while a
   vehicle is already active never switches away from it.
8. Local build (`check assembleDebug assembleDebugAndroidTest`) green, CI
   green, on-device confirmation via the real Settings → Import picker:
   a real export imported, re-imported with everything skipped, and an
   unrelated/corrupt file refused with nothing changed.

## §5 EXIT

Untagged, still 0.9 — no version bump, matching AF6b's own precedent that a
lettered insertion does not own a number. AF10 remains signing, the release
workflow, and the tag; the maker's own standing instruction stops
autonomous work there, before AF10 begins, for a plan-mode check-in rather
than proceeding straight through.
