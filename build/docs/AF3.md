# TRITIUM — AF3 · versionName 0.3 · «Vehicles»

Repo path of this file: `~/REPO/build/docs/AF3.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF1 gave the phone a shell. AF2 gave it the whole storage layer, with no UI
on top of it. AF3 is the desktop's own F3 milestone, ported: "a person in
front of" AF2's storage — a vehicle can be created and edited, switched
between, and the currency question XTRITIUM §8 reserves for first launch is
finally asked.

---

## 1. WHERE AF3 SITS

### 1.1 A correction to AF1's own AF-map, found by checking the desktop's actual history

AF1.md §1.2 wrote that TRITIUM's Android design phase gates AF7, by loose
analogy with the desktop's XTRITIUM §11. Checking F3.md and `XTRITIUM.md`
directly: **the design phase did not happen before F3.** `XTRITIUM.md` §11
is still unedited, five items open, to this day. What actually unblocked F3
was a narrow, three-item local carve-out in F3.md §1.1 — "picker in the tab
bar, not a tab," "forms are real popup windows," "active vehicle
remembered" — and the real design milestone, **F4b**, shipped *two
milestones later*, after F3 **and** F4.

AF3 follows the shape F3 actually took, not the one AF1.md assumed: its own
narrow, local UI decisions, on AF1's placeholder theme, without waiting for
Android's own eventual design pass. Whether that pass should still be
scheduled before AF7, or moved earlier to mirror F4b's actual placement, is
left open for AF4 to consider — not a decision AF3 needed.

### 1.2 Decided with the maker

The vehicle picker lives in a **top app bar dropdown** on Home — the
closest match to the desktop's "chrome, not a screen" placement: always
present, switching never navigates away.

### 1.3 Decided from precedent

| Decision | Answer | Source |
|---|---|---|
| Add/edit vehicle form | A full-screen Compose destination, not a dialog or bottom sheet | The desktop's reason for a separate *window* is draggability — a desktop-only affordance. The family's sibling Android port's own form screens are full-screen, the standard Material mobile pattern for editing a multi-field record |
| Active vehicle persistence | `active_vehicle` in `settings.toml`'s `[general]` table, nullable, matching the desktop's own key name exactly | `src/main/storage/settings-file.ts`, F3.md decision 3 |
| Currency question | A small, non-dismissible dialog at launch when `currency` is absent — TRY/USD/EUR/GBP + free text, no cancel | F3.md §2.6, `CurrencyAsk.tsx`; the desktop sizes its own currency window small (520×320), not full-screen |
| Where currency lives | `settings.toml` only, never the vehicle record, never synced — AF1's bundle-format scope already excludes `settings.toml` entirely | `src/shared/settings.ts:97` ("optional on purpose"); AF1.md §3 |
| Renaming | Edits `name` only; the slug is allocated once at creation and never changes | F3.md decision 5 |
| Deletion | Out of scope, same as F3 | F3.md decision 6 / §3 |
| What creation writes | `vehicle.toml` only — already true of AF2's `VehicleRepository.saveVehicleRecord` | F3.md decision 7 |
| Empty state | The picker is present with zero vehicles too — offering only "Add," never a "get started" screen | XTRITIUM §7; `VehiclePicker.tsx` |

**One stale desktop precedent deliberately not ported.** F3.md's own
SCOPE-OUT line says "No backup, export, import" — that line predates the
§4.1 amendment F16 made, and `issues.md` I-33 is exactly the shape of text a
later milestone must not copy forward as current. AF3's own §3 below says
the accurate thing.

**One real gotcha carried forward.** F3.md §2.7 records that the currency
modal broke every *other* desktop e2e test, since they all launch against a
fresh data directory. AF1's own `ShellLanguageSwitchTest` hit exactly this —
fixed by seeding a currency ahead of `MainActivity`'s launch via a
`RuleChain`, not inside `@Before` (which runs too late relative to
`createAndroidComposeRule`'s own activity launch).

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**1 — `AppConfig`/`ConfigStore` grow `currency` and `activeVehicleSlug`,**
both nullable, both absent by default — mirroring the desktop's own
`Settings` interface exactly. `currency` absent is not a placeholder; it is
literally the signal the first-run question fires on. A stored default
would answer the question before it was asked.

**2 — `Format.kt`,** a full port of the desktop's `src/shared/format.ts`:
`formatFigure`/`parseInput` (the ambiguous-separator grouping-vs-decimal
logic, ported whole rather than simplified, because a finance app's number
entry is exactly the place fidelity to the desktop matters), `formatDate`/
`parseDate` (`GG.AA.YYYY`, checked against the real calendar via
`LocalDate`, refusing `31.02` rather than rolling it into March), and the
currency symbol table (`TRY→₺, USD→$, EUR→€, GBP→£`, unrecognised codes
print as themselves).

**3 — `CurrencyAskDialog`,** a non-dismissible Compose `AlertDialog`
(`dismissOnBackPress`/`dismissOnClickOutside` both false — the platform's
own back gesture would otherwise close an ordinary dialog for free). Same
four presets plus free text as the desktop, one Confirm action, no cancel.
Shown by `TritiumApp` whenever `config.currency == null`, drawn over
whatever screen is on top rather than gating the `NavHost` itself.

**4 — `HomeViewModel`,** wrapping `VehicleRepository`: `vehicleNames` and
`activeVehicle` as `StateFlow`s, refreshed together on `refresh()` and
after every mutation (`switchVehicle`/`createVehicle`/`saveVehicle`) —
**not** cached per-slug the way an earlier draft of `HomeScreen` tried
(`remember(activeSlug)`), which would have shown a stale summary after
editing the *same* vehicle, since the memo key never changed. Caught before
this document was written, not after.

**5 — `Home`'s top app bar carries the picker:** the active vehicle's name,
or "No vehicle," as a dropdown trigger; the menu lists every vehicle plus
"Add." Selecting one switches instantly; "Add" opens the form with no slug.
No dropdown-arrow icon — one would need `material-icons-core`, a dependency
this milestone has no other reason to add, matching AF1's own `icon = {}`
precedent for the bottom nav.

**6 — `VehicleFormRoute(slug: String? = null)`,** one full-screen
destination serving both add and edit. Every `vehicle.toml` field from
AF2's `Vehicle`; `name` is the only required one — it seeds the slug.
Numeric and date fields hold their *editable* text form
(`Format.toInput`/`Format.formatDate`), parsed back on save
(`Format.parseInput`/`Format.parseDate`) — unparseable input is simply not
written, matching XTRITIUM §3 principle 8: nothing here warns yet, and the
app accepts what it can read. No photo field, never, on either platform.

**7 — The bottom navigation bar hides while the form is open.** A full-screen
destination with the tab bar still visible beneath it would contradict its
own "full-screen, not a tab's content" premise (§2.1 decision 6).

### 2.2 What is written

| Path | What it is |
|---|---|
| `config/AppConfig.kt`, `ConfigStore.kt`, `ConfigState.kt` | **modified** — `currency`, `activeVehicleSlug` |
| `storage/Format.kt` | **new** |
| `storage/TritiumPaths.kt`, `VehicleRepository.kt` | unchanged — AF2's repository is reused as-is |
| `TritiumApplication.kt` | **modified** — holds the one `VehicleRepository` |
| `ui/nav/Destinations.kt` | **modified** — `VehicleFormRoute` |
| `ui/SettingsViewModel.kt` | **modified** — `setCurrency` |
| `ui/HomeViewModel.kt` | **new** |
| `ui/CurrencyAskDialog.kt` | **new** |
| `ui/screens/HomeScreen.kt` | **rewritten** — top app bar picker + active vehicle summary |
| `ui/screens/VehicleFormScreen.kt` | **new** |
| `ui/TritiumApp.kt` | **modified** — currency dialog, `VehicleFormRoute`, conditional bottom bar |
| `androidTest/.../ShellLanguageSwitchTest.kt` | **modified** — seeds `currency` via a `RuleChain` before launch |
| `androidTest/.../VehicleFlowTest.kt` | **new** — the currency dialog and the create flow, on a real launch |
| `test/.../storage/FormatTest.kt`, `config/ConfigStoreTest.kt` additions | **new**/**modified** |

---

## 3. SCOPE — OUT

No fuel, costs, or service entry (AF4–AF6). No lists or a dedicated
vehicles screen beyond the picker dropdown (AF7). **No export or import —
AF8's job, and F16's bundle format is what AF8 must produce.** AF2's
backups are unaffected by this milestone and already exist; nothing here
narrows or forbids them. No vehicle deletion. No photos, ever. Settings
does not yet display currency, units or precision — AF9. No palette or
visual-design decisions; Home's app bar and the form use AF1's placeholder
theme unchanged.

---

## 4. ACCEPTANCE CRITERIA

AF3 is done when every line below is true:

1. `./gradlew check` is green: all AF1/AF2 tests plus `FormatTest`, the
   `ConfigStoreTest` additions for `currency`/`active_vehicle`.
   `./gradlew assembleDebugAndroidTest` compiles `ShellLanguageSwitchTest`
   (now seeding a currency) and the new `VehicleFlowTest`.
2. `Format.parseInput` is the inverse of `Format.toInput` for a pump figure
   (three decimals) without misreading it as grouped thousands.
3. `Format.parseDate` refuses a day the real calendar does not have
   (`31.02`, `31.04`) rather than rolling into the next month.
4. On first launch with no `currency` set, the dialog appears and cannot be
   dismissed by the back gesture or a tap outside it — confirmed on device,
   not only asserted in a test CI does not run.
5. Answering the currency question writes `currency` to `settings.toml` and
   the dialog never reappears on a subsequent launch.
6. The picker shows "No vehicle" with zero vehicles present, and offers
   "Add" — never a "get started" screen.
7. Creating a vehicle writes `vehicle.toml` only (no `fuel.toml`,
   `costs.toml`, or `service.toml` for it), makes it active, and the picker
   shows its name afterward.
8. Editing the active vehicle and returning to Home shows the saved fields,
   not what was loaded before the edit.
9. Renaming a vehicle changes `name` in the file; the directory (`slug`)
   does not change.
10. `active_vehicle` and `currency` persist across a process restart, the
    same way `language` already does.
11. AF1's zero-permission guarantee and AF2's storage guarantees are
    unaffected — their own test suites stay green.
12. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme: untagged by default, sideloaded from the
maker's own build, unless the maker signals otherwise the way he did for
AF1. `AF4.md` is written after AF3 exits.
