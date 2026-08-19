# TRITIUM — AF5 · versionName 0.5 · «Costs»

Repo path of this file: `~/REPO/build/docs/AF5.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF5 is the desktop's own F5 milestone, ported. Unlike AF4's algorithm, AF5's
weight is in the *shape* of one form: a cost's fields change with its
category, and one wrong branch — a typed MANUAL category silently falling
back to a slug nobody chose — has already shipped and been fixed once
upstream (`issues.md` I-17). AF5's job is to carry that fix over deliberately,
not rediscover it.

AF2 already built everything the storage side needs.
`VehicleRepository.addCostEntry`/`updateCostEntry`/`removeCostEntry` exist,
untouched by this milestone; `Records.kt` already carries `CostGroup`,
`COST_CATEGORIES`, `PAYMENT_METHODS`, `pickableCategories`,
`takesTypedCategory`, and the full `CostEntry` shape; `CostFile.kt` already
reads and writes `costs.toml` exactly to XTRITIUM §4.4/§6. Confirmed by grep
before this document was written: nothing on the storage side is missing.
What is missing is the screen.

---

## 1. WHERE AF5 SITS

### 1.1 Decided from precedent

Costs gets its own bottom-nav destination ("Costs"), not a section stacked
into Home. This is not a fresh decision — AF4.md §1.1 named it explicitly:
*"avoiding the unstacking question recurring at AF5 and AF6 when costs and
service arrive."* AF4's own Fuel-tab shape is precedent, not a new call.

### 1.2 Decided from the desktop's own F5.md and XTRITIUM §6

| Decision | Answer | Source |
|---|---|---|
| Form shape | **One** adaptive form, not a quick-add/full-form split like Fuel — a cost's fields change by category, so there is nothing "quick" to strip out | F5.md — costs have no single obvious 3-field fast path the way Fuel's odometer/litres/price is |
| The picker | A tree: group first (İLK ALIŞ · TEKRAR EDEN · MANUAL), category second, from `pickableCategories(group)`. Changing group clears the chosen category | XTRITIUM §6.1, `Records.kt`'s own `COST_CATEGORIES`/`pickableCategories` |
| Periyodik Bakım | Excluded from the picker even though it is a `TEKRAR EDEN` token — its entries belong to `service.toml`, AF6's tab, not this one. `pickableCategories` already filters it out | XTRITIUM §6.1; desktop's `costs.serviceElsewhere` string exists for exactly this |
| MANUAL's category | **Typed**, not picked, and stored through `slugify()` — never `slugFor()`/`uniqueSlug()`, which add a `"vehicle"` fallback for an empty result. Save is gated on `slugify(typed).isNotEmpty()`, not on the raw text being non-blank | `issues.md` I-17 — a MANUAL category of `"!!!"` once fell through to the vehicle-slug fallback and saved silently as `category = "vehicle"`, a category the maker never typed. `Slug.kt`'s own split between `slugify`/`slugFor` exists because of this bug |
| Money fields | `payment_method` (fixed 3, `PAYMENT_METHODS`), `bank`/`instalment` (free text) appear for every group, MANUAL included — F5's own framing is "MANUAL is the money shape too, only its category control differs" | F5.md, XTRITIUM §6.2 |
| Income | A checkbox, not a signed-amount field — the amount on disk stays positive; only the sign of its *display* changes | XTRITIUM §6.2, `CostEntry.income`, desktop's `costs.incomeHint` |
| Sort | Newest date first, id descending on ties | F5.md |
| Deletion | Out of scope, same as AF4 — `removeCostEntry` exists in the repository and stays unexposed in the UI | F5.md decision 12; AF4.md's own precedent for `updateFuelEntry` existing without a delete button |
| Save gate | Amount present and category resolved (picked, or typed-and-slugifiable for MANUAL) — not full validation, just "is this a record of anything yet" | F5.md |

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**1 — `ui/CostViewModel.kt`, mirroring `FuelViewModel`'s own shape.**

`costEntries: StateFlow<List<CostEntry>>` for the active vehicle, derived
from `configState.config` independently of every other ViewModel —
`FuelViewModel`'s own independence from `HomeViewModel` is the precedent, not
a fresh call. Refreshed on entry and after every add/update, never cached.

**2 — `ui/screens/CostScreen.kt`, the Costs tab's content.**

One "Add cost" button, disabled with no active vehicle — matching Fuel's own
picker-driven guard. Beneath it, the provisional list: date, group/category
display label, title, signed amount (negative when `income`), sorted newest
first. Placeholder furniture, same as Fuel's own list — AF7 replaces both.

**3 — `ui/screens/CostFormScreen.kt`, the one adaptive form.**

Date, a group dropdown (`CostGroup.entries`), a category control that
*changes shape* with the group — a dropdown sourced from
`pickableCategories(group)` for İLK ALIŞ/TEKRAR EDEN, a plain text field for
MANUAL — title, amount, the income checkbox, a payment-method dropdown
(`PAYMENT_METHODS`), bank, instalment, note. Changing the group clears
whatever category was already chosen, picked or typed, since a category
token from one tree does not belong in another. `entryId == null` adds;
otherwise updates, pre-filled from `CostViewModel.entry(id)`.

**4 — `ui/nav/Destinations.kt` grows two routes.**

`CostsRoute`, `CostFormRoute(entryId: String? = null)` — no `slug` parameter,
same reasoning `FuelFormRoute` already gives: the active vehicle is read
live from `CostViewModel`, not pinned into the route. `COSTS` joins
`TopLevelDestination`.

**5 — `ui/TritiumApp.kt`.** Costs joins the bottom nav; it hides — the same
way it already hides for `VehicleFormRoute` and the Fuel form routes — while
`CostFormRoute` is open.

**6 — Category and group display labels.**

Every token (`kapora`, `arac-bedeli`, `ilk-alis`, …) is a storage slug, not
display text — XTRITIUM never shows a raw slug to the maker. A small lookup
in `CostFormScreen`/`CostScreen` maps each token to the desktop's own
`costs.groups.*`/`costs.categories.*` string, ported into `strings.xml`
alongside the field labels.

### 2.2 What is written

| Path | What it is |
|---|---|
| `ui/CostViewModel.kt` | **new** |
| `ui/screens/CostScreen.kt`, `CostFormScreen.kt` | **new** |
| `ui/nav/Destinations.kt` | **modified** |
| `ui/TritiumApp.kt` | **modified** |
| `res/values{,-tr}/strings.xml` | **modified** — every `costs.*` key ported verbatim from the desktop's own i18n, including every group and category label |
| `androidTest/.../CostFlowTest.kt` | **new** |

No storage-layer file changes — `Records.kt`, `CostFile.kt`,
`VehicleRepository`'s cost methods are AF2's, already correct, already
tested by AF2's own suite.

---

## 3. SCOPE — OUT

No service (AF6). No dense table, no filters, no deletion of cost entries —
AF7's, the list here is placeholder furniture exactly as F4's fuel list was.
No running-cost/true-cost statistics, no charts, no summary cards — those
read costs and fuel together and belong with AF7's own summary work. No
palette or visual design — still deferred to before AF7. No payment-method
settings UI (removing/adding methods) — AF9. `VehicleRepository`'s existing
cost methods are reused untouched; nothing about AF2's storage layer changes.

---

## 4. ACCEPTANCE CRITERIA

AF5 is done when every line below is true:

1. `./gradlew check` is green: every prior milestone's suite untouched.
   `./gradlew assembleDebugAndroidTest` compiles `CostFlowTest`.
2. Selecting İLK ALIŞ or TEKRAR EDEN shows a category dropdown restricted to
   `pickableCategories(group)` — Periyodik Bakım never appears in it.
3. Selecting MANUAL shows a typed category field instead, and Save stays
   disabled until `slugify(typed)` is non-empty — a category of `"!!!"`
   alone never saves as any category, let alone `"vehicle"`.
4. Switching group after a category was already chosen clears it; the old
   token from the previous tree is never carried into the new group.
5. The income checkbox does not change what is written to `amount` — the
   figure on disk stays positive; only its sign in the list changes.
6. The form edits an existing entry in place, by id, without changing any
   other entry, the same way `FuelFormScreen` already does.
7. A cost added through the form appears in the list, sorted newest date
   first, with its group/category shown as a real label, never a raw slug.
8. AF1–AF4's own test suites and the manifest guardian stay green.
9. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme: untagged by default, sideloaded from the
maker's own build. `AF6.md` is written after AF5 exits.
