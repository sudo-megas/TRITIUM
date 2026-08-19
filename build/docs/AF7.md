# TRITIUM — AF7 · versionName 0.7 · «Lists / summary»

Repo path of this file: `~/REPO/build/docs/AF7.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF7 is where AF1.md §1.2's own map bundles two desktop milestones into one:
*"Lists / summary"* is F7 (the dense-table replacement pass) and F9 (the
Summary page) together, not F7 alone. AF6b's design phase closed the fork
both of them were waiting on — native Material 3, five bottom-nav
destinations, final — so nothing defers either any further.

Two things carry over unchanged from F7/F9 and three things do not.
Unchanged: the correctness rule that the range decides what is *shown*,
never what is *computed* (§1.2 below); the deletion principle, "asks twice,
in the flow, never a dialog"; average-consumption's ratio-of-the-sums, never
the mean-of-the-ratios. Not carried over: TanStack's dense table (`LazyColumn`
already does this job), the split-pane detail region (AF4–AF6 already built
tap-a-row-to-edit, which serves the same purpose), and F9's month-over-month
trend cards (`costPerKmSeries`, `monthlyDistanceSeries`, `compare` — real
desktop features, but F8/F10-adjacent scope this milestone does not need to
open to fill Home's actual hole, which is simpler: no fuel, cost, or service
figure is summarized anywhere on the phone today).

---

## 1. WHERE AF7 SITS

### 1.1 Decided from precedent

Five bottom-nav destinations, final (AF6b.md §1.1). Native Material 3
(AF6b.md §1). AF7 changes no destination, no colour, no typography — it
fills in behaviour behind three screens that have said *"placeholder
furniture AF7 replaces"* since AF4, AF5 and AF6, and behind a Home screen
that has shown nothing but a vehicle's static fields since AF3.

### 1.2 The one rule that must hold, quoted from where AF4 already stated it

`Consumption.kt`'s own doc comment and `FuelScreen.kt`'s already carry this
rule forward from F7.md decision 3, word for word in spirit: the engine is
fed the vehicle's *entire* fuel history, always; a range chip filters rows
*after*, never the list handed to `consumptionById`. AF7 is the first
milestone that can actually get this wrong — AF4 stated the rule with
nothing yet built that could violate it. The chip filter is therefore
written to filter at the row-render site only, never at any point upstream
of `consumptionById`'s own input.

### 1.3 Decided from the desktop's own F7.md, F9.md and XTRITIUM §7

| Decision | Answer | Source |
|---|---|---|
| The dense table | Not ported. `LazyColumn` already renders every row `FuelScreen`/`CostScreen`/`ServiceScreen` need; TanStack's column models, sort models and the `.entries` CSS treatment (F4b) have no Compose counterpart and no job left to do once there are no columns | AF1.md's own AF-map: "a mobile-appropriate view, not a port of the desktop's dense tables" |
| The chips | Five fixed — All time · YTD · Previous year · This month · Previous month — plus a custom `GG.AA.YYYY`×2 pair. No text filter, no category filter, ever | F7.md §2.1 decision 2, XTRITIUM §7.2 |
| Custom range input | Two text fields in the family's own date format, parsed by `Format.parseDate`; an unreadable bound is simply not applied. No date picker | F7.md §2.1 decision 5 — `audit-overlap` forbids the construct on desktop; Android has no such audit, but the underlying reason (a maker mid-keystroke is not wrong yet) is carried forward as a stated choice, not an automated one |
| The detail pane | Not built. Tapping a row already opens `CostFormScreen`/`FuelFormScreen`/`ServiceFormScreen` pre-filled, exactly what the desktop's detail pane exists to show | AF4–AF6 precedent, not a fresh decision |
| Deletion | Asks twice, in the flow — a per-row control that turns into a confirming control on first tap, and reverts on anything else touched. Never an `AlertDialog` | F7.md §2.1 decision 8. Compose has no `audit-overlap`; the mechanism is a per-screen `confirmingId` state, reset by every other click handler on the screen, not a literal port of the desktop's button-morph but the same principle |
| Sort | Each list keeps its own default (fuel: odometer desc; costs/service: date desc, already what `CostViewModel`/`ServiceViewModel` do) with a single toggle cycling default → ascending → descending → default. No multi-column sort menu — none of the three lists has more than one sort key worth exposing | F7.md §2.1 decision "sorting by a column reorders the rows," reinterpreted for a single-key row list rather than a literal table header |
| Summary scope | `summary.ts`'s eight functions, minus `compare` and the month-over-month trend cards that lean on `costPerKmSeries`/`monthlyDistanceSeries` — those stay unbuilt, named explicitly in SCOPE OUT rather than silently dropped | F9.md/`SummaryPane.tsx`, narrowed to what Home's actual gap needs — see §1.4 |
| Units | Raw km / l/100km / the active currency — no conversion, matching every screen AF3–AF6 already built. F7.md's own SCOPE OUT: "units stay km, litres and l/100km" | F7.md §3; AF9's, unchanged |

### 1.4 Why `compare` and the trend cards are out

`SummaryPane.tsx` computes four month-over-month comparisons (spend,
distance, cost-per-km, fill-up count) against `previous-month`, each stating
the exact span compared. That is real F9 content, but it depends on
`monthlyDistanceSeries` and `costPerKmSeries` — F8-adjacent series work with
no other caller anywhere in the current AF-map, ported for a feature that
would be the only thing using them. Home's actual hole is simpler: no
lifetime figure and no recent-activity list exist at all yet. Filling that
first, and naming the trend cards as a deferred extension rather than
silently forgetting them, keeps AF7 the size its own bundle-fold ("Lists /
summary," not "Lists / summary / trends") implies.

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**1 — `storage/Range.kt`.** Ported from `range.ts` whole: `RangeKey` (six
values, `CUSTOM` last), `DateBounds`, `boundsFor(key, today, custom)`,
`withinBounds(date, bounds)`, `filterByBounds(entries, bounds)`. `today`
arrives as a parameter everywhere, never read from a clock inside the
object — the same discipline `FuelDraft.quickAddDefaults` already uses.

**2 — `storage/Series.kt`.** Only what `Summary.kt` needs: `DatePoint`,
`MonthPoint`, `odometerSeries(fuel, service)`, `monthlyCostSeries(fuel,
costs, service)`. Not the other five series `series.ts` exports — those
serve F8/F10 charts with no Android home in the current AF-map.

**3 — `storage/Summary.kt`.** Ported: `averageConsumption`, `lastConsumption`,
`lastPrice`, `latestOdometer`, `lifetimeDistance`, `lifetimeLitres`,
`lifetimeSpend`, `recentEntries` (with `EntryKind`, `RecentEntry`). Not
ported: `compare` (§1.4).

**4 — `signedAmount` promoted out of `CostScreen.kt`.** `CostRow`'s own
inline `if (entry.income) -entry.amount else entry.amount` gets a second
caller (`Summary.lifetimeSpend`/`recentEntries`) — the same "second caller
promotes a helper" pattern AF6 already named for `highestOdometer`. Lives on
`CostEntry` itself as `CostEntry.signedAmount()`.

**5 — `ui/HomeViewModel.kt` grows summary state.** The active vehicle's
whole bundle (fuel/costs/service entries) read once per `refresh()`, same
snapshot discipline every other ViewModel already uses; the eight `Summary`
figures and `recentEntries` derived from it, exposed as one state object
rather than eight separate flows.

**6 — `ui/screens/HomeScreen.kt` grows a summary block**, appended below the
existing `VehicleSummary`: latest odometer, average/last consumption, last
price+date, lifetime distance/litres/spend, and the merged recent-entries
list (limit 8, matching `SummaryPane.tsx`'s own `RECENT_LIMIT`). A null
figure (no fuel yet, no previous fill-up) renders as "—" (`summary_nothing`),
never a zero standing in for an absence — the same reasoning `compare`
itself states for a missing previous period, applied here to a missing
figure.

**7 — `ui/screens/RangeChips.kt`**, one shared composable used by all three
lists: the five fixed chips plus a sixth ("Custom") that reveals two
`GG.AA.YYYY` text fields when selected. Filtering happens where each screen
renders its rows, never upstream of `Consumption.consumptionById`'s input
(§1.2).

**8 — Delete, per row, on all three lists.** A small icon/button per row;
first tap flips that row into a confirming state (a screen-scoped
`confirmingId: String?`), second tap on the same row commits
`removeFuelEntry`/`removeCostEntry`/`removeServiceEntry` (already in
`VehicleRepository`, unexposed until now) and refreshes; any other tap on
the screen — another row's delete, a chip, Add, the sort toggle — resets
`confirmingId` to null first.

**9 — Sort toggle, per list.** One control cycling default → ascending →
descending → default, applied at render, over whatever the range chip has
already selected. `FuelViewModel.refresh()` gains a real default sort
(odometer desc) it never had — a genuine gap AF4 left, since nothing before
AF7 needed the fuel list ordered at all.

### 2.2 What is written

| Path | What it is |
|---|---|
| `storage/Range.kt`, `Series.kt`, `Summary.kt` | **new** |
| `storage/Records.kt` | **modified** — `CostEntry.signedAmount()` |
| `ui/FuelViewModel.kt` | **modified** — default sort, `removeFuelEntry` exposed |
| `ui/CostViewModel.kt`, `ui/ServiceViewModel.kt` | **modified** — `removeCostEntry`/`removeServiceEntry` exposed |
| `ui/HomeViewModel.kt` | **modified** — summary state |
| `ui/screens/HomeScreen.kt` | **modified** — the summary block |
| `ui/screens/RangeChips.kt` | **new** — shared by all three lists |
| `ui/screens/FuelScreen.kt`, `CostScreen.kt`, `ServiceScreen.kt` | **modified** — chips, sort toggle, delete-with-confirm |
| `res/values{,-tr}/strings.xml` | **modified** — `summary.*`/range-chip labels ported verbatim from desktop i18n |
| `test/.../storage/RangeTest.kt`, `SeriesTest.kt`, `SummaryTest.kt` | **new** |
| `androidTest/.../SummaryAndDeletionTest.kt` | **new** |

---

## 3. SCOPE — OUT

No dense table, no column model, no split-pane detail region (§1.3). No
month-over-month trend cards, no `compare`, no `costPerKmSeries`/
`monthlyDistanceSeries` (§1.4) — a real extension, named here rather than
silently dropped, for whichever later AF wants it. No charts (no Android AF
maps to F8). No statistics/true-cost-per-km/projections (no Android AF maps
to F10 either — recorded as an open question in the AF-map, not this
milestone's to answer). No unit conversion, no settings UI — AF9's. No bulk
delete: one record at a time, matching F7.md's own reasoning that this is
the only rate at which a maker regrets one.

---

## 4. ACCEPTANCE CRITERIA

AF7 is done when every line below is true:

1. `./gradlew check` is green: `RangeTest`, `SeriesTest`, `SummaryTest`, and
   every prior milestone's suite. `./gradlew assembleDebugAndroidTest`
   compiles `SummaryAndDeletionTest`.
2. `averageConsumption` is the ratio of the sums — the 40l/400km + 10l/500km
   worked example resolves to 5,56 l/100km, never 6,00.
3. A consumption figure shown for a fuel entry is identical whether or not
   the active range chip hides the full-tank entry it was measured against.
4. Each of the five fixed chips and a valid custom range visibly change
   which rows are listed on all three screens; an unreadable custom bound
   is not applied, not treated as filtering to nothing.
5. Deleting a row requires two taps on the same row; any other tap in
   between reverts it to its normal state without deleting anything.
   Deleting removes exactly one entry, leaves every other entry's id
   untouched, and a backup exists after.
6. The sort toggle cycles default → ascending → descending → default on
   each list independently.
7. Home shows, once a vehicle is active: latest odometer, average and last
   consumption, last price with its date, lifetime distance/litres/spend,
   and up to 8 recent entries merged across fuel/costs/service, newest
   first. Any figure with nothing to compute from shows "—", never 0.
8. AF1–AF6b's own test suites stay green.
9. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme: untagged by default, sideloaded from the
maker's own build. `AF8`'s own doc is written after AF7 exits.
