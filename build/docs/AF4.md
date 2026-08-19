# TRITIUM — AF4 · versionName 0.4 · «Fuel»

Repo path of this file: `~/REPO/build/docs/AF4.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF4 is the desktop's own F4 milestone, ported: the first milestone that
**computes** something that lives in no file. F4.md's own framing carries
over exactly — "A stored figure that is wrong is visible: it is on the
screen and in the file, and the maker can see it. A derived figure that is
wrong is invisible until it has been wrong for a year. So the algorithm,
not the forms, is what this milestone is really about."

AF2 already built everything the storage side needs.
`VehicleRepository.addFuelEntry`/`updateFuelEntry` exist, untouched by this
milestone; `FuelEntry.fullTank`'s own doc comment already says "the
consumption engine reads it (AF4)." What was missing, confirmed by grep
before this document was written: the consumption engine itself, and every
fuel-facing screen.

---

## 1. WHERE AF4 SITS

### 1.1 Decided with the maker

Fuel gets its own bottom-nav destination ("Fuel"), not a section stacked
into Home — matching the desktop's dedicated `FuelPane` most closely, and
avoiding the unstacking question recurring at AF5 and AF6 when costs and
service arrive. AF1.md §2.1 decision 7 already called the destination count
provisional and expected to grow.

### 1.2 Decided from precedent

| Decision | Answer | Source |
|---|---|---|
| Entry paths | Two separate full-screen destinations, not one screen with a mode toggle | Desktop treats quick-add and the full form as genuinely different "kinds." AF3.md §1.3 already settled that Android's answer to "separate window" is a separate full-screen route |
| Quick-add fields | Exactly three: odometer, litres, price/litre. Date, fuel type, and `full_tank` all default silently (today; the vehicle's own `fuel_spec`; `true`) and are shown as a note, not asked | XTRITIUM §5.1, F4.md decision 1 — `full_tank` defaulting `true` is not filler: a `false` default means the fast path never produces a consumption point at all |
| Full form | Every `fuel.toml` field, `full_tank` as a real checkbox, doubles as the edit path | XTRITIUM §5.1, F4.md decisions 2–3 |
| Live total | Computed and shown on both forms, never stored | XTRITIUM §5.1, §4.4 |
| Backwards odometer | Warns, never blocks — the previous odometer shown as a hint | XTRITIUM §5.1, §3 principle 8; desktop's `fuel-draft.ts` |
| The consumption algorithm | Ported field-for-field from `src/shared/consumption.ts` | XTRITIUM §5.2 |
| The fuel list | A provisional list — placeholder furniture AF7 replaces, exactly as F7 replaced F4's own | F4.md §2.5 |
| Deletion | Out of scope — AF7's | F4.md decision 8 |

**The one correctness rule that must hold from day one**, quoted from the
desktop's own `FuelPane.tsx` header because it is worth getting wrong
exactly zero times:

> "§5.2's consumption figure exists only between consecutive full tanks, and
> it counts every partial fill in between. Hand the engine a filtered list
> and all of that quietly stops being true... So the engine is fed
> `bundle.fuel.entries` ENTIRE, always, and the range is applied afterwards,
> to the rows."

AF4 has no range chips yet to apply this wrong with — but the rule is
stated in the engine's own contract now, so AF7 inherits it instead of
rediscovering it. That is F4's own lesson (`issues.md` I-01/I-02: "the same
defect in two places, found because the decision was written down as a
decision rather than only implemented") applied to itself before it has
had the chance to repeat.

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**1 — `Consumption.kt`, the engine, ported whole.**

`sortByOdometer` (tie-break: odometer, then date, then id sequence),
`consumptionPoints` — the full-tank-interval algorithm:

- A point exists only at a full-tank entry with an earlier full-tank entry
  before it.
- `litres` = this entry's litres plus every partial fill's litres since the
  previous full tank.
- `distance` = this odometer − the previous full entry's odometer.
- `l100km = round(litres × 100 ÷ distance)`, kept at the engine's own
  ×1000 scale internally regardless of display precision.
- `distance ≤ 0` (two entries at one reading) produces no point, but the
  interval boundary still advances — sorted by odometer, this can only
  happen at a tied reading, which measures nothing and so says nothing.
- A partial fill before the first full tank is dropped, not carried
  forward — there is no interval yet for it to belong to.

`consumptionAt` cuts the engine's 3-decimal internal figure to a display
precision without the engine having an opinion about what that precision
is. `consumptionById` is the lookup map the UI actually reads.

Pure functions, no Android dependency — testable as plain JVM JUnit,
matching every storage-layer file so far.

**2 — `FuelDraft.kt`, ported from `fuel-draft.ts`.**

The previous odometer (highest among the active vehicle's fuel entries),
the backwards-odometer check (warns, never blocks), and quick-add's silent
defaults: today's date via `Format.todayIso`, the vehicle's own
`fuel_spec`, `full_tank = true`.

**3 — The money-total helper, added to `Scaled.kt`.**

`litres × price/litre`, both already scaled ×1000, rescaled to money's
×100 by integer arithmetic — `(litresScaled * priceScaled + 5000) / 10000`
with the rounding folded into the division, never two scaled `Long`s
multiplied and then converted through a `Double`. Checked against XTRITIUM
§5.1's own example: `29.990 l × 73.380 ₺/l → 2.200,67 ₺` is
`29990 × 73380 = 2,200,666,200`, `(2,200,666,200 + 5000) / 10000 = 220067`,
`formatMoney(220067) = "2200.67"`.

**4 — `Destinations.kt` grows three routes.**

`FuelRoute`, `FuelQuickAddRoute(slug: String)`,
`FuelFormRoute(slug: String, entryId: String? = null)`; `FUEL` joins
`TopLevelDestination`.

**5 — `FuelViewModel`, mirroring `HomeViewModel`'s own shape.**

`fuelEntries: StateFlow<List<FuelEntry>>` for the active vehicle, derived
from `configState.config` independently of `HomeViewModel` — each screen's
ViewModel stays self-sufficient, the same independence
`SettingsViewModel`/`HomeViewModel` already have from each other. Refreshed
on entry and after every add/update, never cached, matching AF2.md §1's own
correction of the "in-memory index" AF1 originally sketched.

**6 — `FuelScreen`, the Fuel tab's content.**

Two buttons — Quick add, Full add — disabled with no active vehicle,
matching Home's own picker-driven guard. Beneath them, the provisional
list: date, odometer, litres, price, derived total, the full-tank flag, and
l/100km where `consumptionById` has one — fed the whole entry list, per
§1.2's correctness rule, every time.

**7 — `FuelQuickAddScreen`.** Three fields, the live total, the defaults
note (so the maker sees what will be silently saved before saving it), the
odometer hint and warning. Add-only — no `entryId`, always
`addFuelEntry`.

**8 — `FuelFormScreen`.** Every field, the `full_tank` checkbox, the
`fuel_type` picker from AF2's `FUEL_TYPES`. `entryId == null` adds;
otherwise updates.

**9 — `TritiumApp.kt`.** Fuel joins the bottom nav; it hides — the same
way it already hides for `VehicleFormRoute` — while any of the three new
full-screen routes is open.

### 2.2 What is written

| Path | What it is |
|---|---|
| `storage/Consumption.kt` | **new** |
| `storage/FuelDraft.kt` | **new** |
| `storage/Scaled.kt` | **modified** — the money-total helper |
| `ui/nav/Destinations.kt` | **modified** |
| `ui/FuelViewModel.kt` | **new** |
| `ui/screens/FuelScreen.kt`, `FuelQuickAddScreen.kt`, `FuelFormScreen.kt` | **new** |
| `ui/TritiumApp.kt` | **modified** |
| `res/values{,-tr}/strings.xml` | **modified** — fuel field/button labels, pulled from the desktop's own `fuel.*` i18n keys the way AF3 pulled `vehicles.*` |
| `test/.../storage/ConsumptionTest.kt`, `FuelDraftTest.kt`, `ScaledTest.kt` additions | **new/modified** |
| `androidTest/.../FuelFlowTest.kt` | **new** |

---

## 3. SCOPE — OUT

No costs (AF5), no service (AF6). No dense table, no range chips, no
deletion of fuel entries — all AF7, the list here is placeholder furniture
exactly as F4's own was. No unit conversion, no settings UI for precision —
AF9. No charts, no summary cards, no statistics. No palette or visual
design — still deferred. `VehicleRepository`'s existing `addFuelEntry`/
`updateFuelEntry` are reused untouched; nothing about AF2's storage layer
changes.

---

## 4. ACCEPTANCE CRITERIA

AF4 is done when every line below is true:

1. `./gradlew check` is green: all prior milestones' tests plus
   `ConsumptionTest`, `FuelDraftTest`, the `Scaled.kt` money-total tests.
   `./gradlew assembleDebugAndroidTest` compiles `FuelFlowTest`.
2. A point exists only at a full-tank entry with an earlier full tank
   before it; the first-ever entry, a run of only partials, and partials
   before the first full tank all produce no point.
3. A partial fill's litres are counted into the *next* full tank's point,
   not the one before it.
4. Two entries at the same odometer reading produce no point, but the
   interval boundary still advances to the later one.
5. `l100km` matches `litres × 100 ÷ distance`, rounded once, on scaled
   integers throughout — no intermediate `Double`.
6. The money-total helper matches XTRITIUM §5.1's own worked example
   exactly: `29.990 l × 73.380 ₺/l → 2.200,67 ₺`.
7. Quick-add writes one `[[entry]]` with `full_tank = true`, today's date,
   and the vehicle's own `fuel_spec` — none of the three asked.
8. The full form edits an existing entry in place, by id, without changing
   any other entry.
9. A backwards odometer shows a warning and still saves.
10. `total` never appears in a written `fuel.toml` — AF2's own guarantee,
    confirmed still holding after this milestone writes through it.
11. The fuel list, on a real device, shows a consumption figure for a
    second full-tank entry and none for the first.
12. AF1–AF3's own test suites and the manifest guardian stay green.
13. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme: untagged by default, sideloaded from the
maker's own build, unless the maker signals otherwise. `AF5.md` is written
after AF4 exits.
