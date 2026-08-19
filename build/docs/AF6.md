# TRITIUM — AF6 · versionName 0.6 · «Service»

Repo path of this file: `~/REPO/build/docs/AF6.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF6 is the desktop's own F6 milestone, ported. F6.md's own framing carries
over exactly: the evidence is the maker's PERİYODİK BAKIM sheet — four rows,
and the column headings are the record: TARİHİ · PARÇA · KM · TUTARI ·
ALINDIĞI LİNK / YER. That last heading is the milestone in five words — not
"link", but *the link **or** the place* — and the fourth row (`SERVİS`, no
part, no vendor, twelve thousand lira of labour) is what keeps `part`
optional and `vendor` a plain-text field rather than a URL field.

AF5 drew XTRITIUM §6.1's tree and left one branch of it unwritten: Periyodik
Bakım is a `TEKRAR EDEN` token but was withheld from the cost picker,
because its entries belong to `service.toml`, a different file with a
different shape (AF5.md §1.2). AF6 is that branch.

AF2 already built everything the storage side needs — confirmed by grep
before this document was written. `Records.kt` already carries the full
`ServiceEntry` shape (date, part, odometer, amount, vendor — `service.toml`
entire); `ServiceFile.kt` already reads and writes it, its own `vendor`
comment already flagging "never a link — enforced by the UI (AF6)";
`VehicleRepository.addServiceEntry`/`updateServiceEntry`/`removeServiceEntry`
already exist, untouched by this milestone. What is missing is the screen —
and one real cross-file fix AF4 left for this milestone to make (§1.2).

---

## 1. WHERE AF6 SITS

### 1.1 Decided from precedent

Service gets its own bottom-nav destination ("Service"), not a branch of the
cost form. AF4.md §1.1 named this outcome before AF5 or AF6 existed:
*"avoiding the unstacking question recurring at AF5 and AF6 when costs and
service arrive."* A form that wrote two files depending on a dropdown would
be two forms wearing one coat (F6.md decision 1) — the same reasoning AF5
already gave for keeping Costs and Fuel on separate tabs.

### 1.2 Decided from the desktop's own F6.md and XTRITIUM §5/§6

| Decision | Answer | Source |
|---|---|---|
| Fields | Exactly `service.toml`'s shape: date, part, odometer, amount, vendor. Nothing else | XTRITIUM §4.4, `Records.kt`'s own `ServiceEntry` |
| `part` | **Not required.** The maker's own fourth row (`SERVİS`, no part) would be rejected by a form that demanded one | F6.md §2.2, the sheet itself |
| `vendor` | Plain text — "where it came from", not a URL field. Stored as typed, rendered as selectable text, **never as a link, ever** | F6.md §2.1 decision 3, XTRITIUM §3.5. `ServiceFile.kt`'s own comment already says this; AF6 is where the UI half of that promise gets kept |
| Save gate | `amount` present and positive. That alone — the one figure without which the row records nothing | F6.md §2.2 |
| The odometer hint | The highest reading the vehicle knows, **from any file** — fuel and service both. AF4's hint read fuel entries alone because fuel was the only file carrying an odometer; a service entry carries one too, and a hint that ignored it would state the wrong number confidently | F6.md §2.1 decision 5. This is a real fix to AF4's own `FuelDraft.lastOdometer`, not new AF6-only logic — the same file, generalised, because a second caller now needs it |
| Backwards odometer | Warns, never blocks — same rule AF4 already established for fuel | XTRITIUM §5.1, §3 principle 8 |
| The cost form | Now says where Periyodik Bakım went, since the Service tab is no longer empty. One line of hint text, shown only when the group is `TEKRAR EDEN` | F6.md §2.1 decision 2; desktop's `costs.serviceElsewhere`, wired at `CostForm.tsx`'s own `draft.group === 'tekrar-eden'` check |
| Intervals, due dates, reminders | **Never.** Nothing computes, stores, or displays one — this is the milestone most tempted to add exactly that, and it is forbidden three separate times in the governing doc | XTRITIUM §3.3; F6.md decision 6 |
| The list | A provisional list (date, part, odometer, amount, vendor) — placeholder furniture, same as Fuel's and Costs' own. AF7 replaces it | F6.md §2.3 |
| Sort | Newest date first, id descending on ties — the same rule `CostViewModel.refresh()` already applies | F6.md §2.1 decision 8 |
| Deletion | Out of scope — `removeServiceEntry` exists in the repository and stays unexposed, same as Fuel's and Costs' own | F6.md decision 9 |
| The broadcast bug F5 flagged | `ipcMain.handle('service:save')` missing a broadcast after write — **desktop/Electron-specific, not applicable here.** Compose's `refresh()`-after-write pattern, already used by `FuelViewModel`/`CostViewModel`, has no equivalent gap; `ServiceViewModel` gets the same pattern from day one | F6.md §1.3; confirmed no multi-window/IPC concept exists on Android |

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**1 — `storage/FuelDraft.kt`'s odometer hint is generalised, in place.**

`lastOdometer(entries: List<FuelEntry>): Int?` becomes
`highestOdometer(fuel: List<FuelEntry>, service: List<ServiceEntry>): Int?`
— the highest reading across both lists, or null with neither. This is the
"second caller promotes a helper" pattern AF4/AF5 already named twice
(`slugify`, `todayIso`); the odometer hint is the third. `goesBackwards`
stays as it is — it only ever compared two integers and never cared which
file either came from.

**2 — `ui/FuelViewModel.kt` and `ui/ServiceViewModel.kt` both expose
`previousOdometer(): Int?`.**

A one-off repository read at form-open time — the same shape
`activeVehicleFuelSpec()` already established for a single derived field,
not a new `StateFlow`, since neither form displays the other file's entries,
only borrows their odometer column for the hint.

**3 — `ui/ServiceViewModel.kt`, mirroring `CostViewModel`'s own shape.**

`serviceEntries: StateFlow<List<ServiceEntry>>` for the active vehicle,
sorted newest-date-first (id-descending on ties) — `CostViewModel.refresh()`
is the precedent, not a fresh call. `refresh()`, `entry(id)`,
`addServiceEntry`, `updateServiceEntry`, `previousOdometer()`, `factory(app)`.

**4 — `ui/screens/ServiceScreen.kt`, the Service tab's content.**

One "Add service record" button, disabled with no active vehicle. Beneath
it, the provisional list: date, part (or nothing), odometer, amount,
vendor — vendor rendered with a plain `Text`, never a clickable/link
composable, matching §3.5 with no exception.

**5 — `ui/screens/ServiceFormScreen.kt`, the form.**

Date, part (optional), odometer (with the cross-file previous-reading hint
and backwards warning, `FuelQuickAddScreen`'s own pattern), amount (gates
save), vendor (plain text, with a hint that TRITIUM never opens it — the
desktop's own `service.vendorHint`, ported verbatim). `entryId == null`
adds; otherwise updates, pre-filled from `ServiceViewModel.entry(id)`.

**6 — `ui/screens/CostFormScreen.kt` gains one hint line.**

When `group == CostGroup.TEKRAR_EDEN`, a line of text appears beneath the
category control: the desktop's own `costs.serviceElsewhere`, ported
verbatim — *"Periyodik Bakım is entered on the SERVICE tab — its records
live in service.toml."* Shown regardless of which TEKRAR EDEN category is
picked, since the redirect is about the group, not any one category in it.

**7 — `ui/nav/Destinations.kt` grows two routes.**

`ServiceRoute`, `ServiceFormRoute(entryId: String? = null)` — no `slug`
parameter, the same reasoning `CostFormRoute`/`FuelFormRoute` already give.
`SERVICE` joins `TopLevelDestination`.

**8 — `ui/TritiumApp.kt`.** Service joins the bottom nav; it hides — the
same way it already hides for every other form route — while
`ServiceFormRoute` is open.

### 2.2 What is written

| Path | What it is |
|---|---|
| `storage/FuelDraft.kt` | **modified** — `lastOdometer` generalised to `highestOdometer(fuel, service)` |
| `storage/FuelDraftTest.kt` | **modified** — retargeted at the new signature |
| `ui/FuelViewModel.kt` | **modified** — `previousOdometer()` added |
| `ui/screens/FuelQuickAddScreen.kt` | **modified** — reads the hint from `viewModel.previousOdometer()`, cross-file |
| `ui/ServiceViewModel.kt` | **new** |
| `ui/screens/ServiceScreen.kt`, `ServiceFormScreen.kt` | **new** |
| `ui/screens/CostFormScreen.kt` | **modified** — the TEKRAR EDEN service-elsewhere hint |
| `ui/nav/Destinations.kt` | **modified** |
| `ui/TritiumApp.kt` | **modified** |
| `res/values{,-tr}/strings.xml` | **modified** — every `service.*` key ported verbatim from the desktop's own i18n, plus `costs_service_elsewhere` |
| `androidTest/.../ServiceFlowTest.kt` | **new** |

No storage-layer file changes beyond `FuelDraft.kt`'s generalisation —
`Records.kt`, `ServiceFile.kt`, `VehicleRepository`'s service methods are
AF2's, already correct, already tested by AF2's own suite.

---

## 3. SCOPE — OUT

No service intervals, no due dates, no reminders, no projection of future
maintenance, in any form — XTRITIUM §3.3, decision 6, three times over. No
dense table, no filters, no deletion of service entries — AF7's, the list
here is placeholder furniture exactly as Fuel's and Costs' own were. No
running-cost/true-cost statistics that fold service spending in with fuel
and costs — AF7's summary work. No charts (AF8), no settings UI for the
list's own display (AF9). No attachments, no receipts, no invoices — out of
scope entirely, not deferred to any later AF. `VehicleRepository`'s existing
service methods are reused untouched; nothing about AF2's storage layer
changes beyond the one generalisation named above.

---

## 4. ACCEPTANCE CRITERIA

AF6 is done when every line below is true:

1. `./gradlew check` is green: every prior milestone's suite untouched,
   `FuelDraftTest` retargeted and passing. `./gradlew
   assembleDebugAndroidTest` compiles `ServiceFlowTest`.
2. All four of the maker's own rows can be entered as they are — including
   `SERVİS` with no part and no vendor, and a vendor that is a bare shop
   name rather than an address.
3. A vendor holding a URL is stored and displayed as plain text — no
   clickable link, no anchor-equivalent composable, anywhere in the Service
   tab or form.
4. The odometer hint on both the Fuel quick-add screen and the Service form
   reflects the highest reading across `fuel.toml` and `service.toml`
   together; a lower reading warns and is then accepted, never blocked.
5. Save stays disabled until `amount` is present and positive; an empty
   `part` never blocks it.
6. The form edits an existing entry in place, by id, without changing any
   other entry — the same pattern `CostFormScreen`/`FuelFormScreen` already
   use.
7. A service entry added through the form appears in the list, sorted
   newest date first.
8. Selecting TEKRAR EDEN in the cost form shows the service-elsewhere hint;
   no other group does.
9. Nothing in the app computes, stores, or displays a future service date,
   interval, or reminder.
10. AF1–AF5's own test suites and the manifest guardian stay green.
11. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme: untagged by default, sideloaded from the
maker's own build. `AF7`'s design phase begins after AF6 exits, per
XTRITIUM's own note that a design phase sits before AF7's list/summary work.
