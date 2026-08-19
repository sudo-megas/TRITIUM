# TRITIUM — AF2 · versionName 0.2 · «Storage Layer»

Repo path of this file: `~/REPO/build/docs/AF2.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF1 gave the phone one settings key and a shell around it. AF2 gives it the
whole data layer of XTRITIUM §4 — every record shape, on disk, exactly as
§4.4 draws it, matching the desktop's own `F2.md` in scope and the desktop's
actual code in behaviour wherever the two genuinely share a concern. No
screen shows any of it yet; AF3 is the first thing that reads what AF2
writes.

Where AF1 checked its decisions against `sudo-megas/SAAT`, AF2 checks
against **both** siblings: SAAT for the platform (tomlkt's document model,
backups, slugs), and **TRITIUM's own desktop** (`src/main/storage/`,
`src/shared/records.ts`, `src/shared/scaled.ts`, `src/shared/slug.ts`) for
the actual shapes — since AF2's whole job is to be the same data, on a
second platform, not a reinterpretation of it.

---

## 1. WHERE AF2 SITS

AF1.md §1.2's provisional AF-map is confirmed for this milestone, with one
correction: its one-line description said "in-memory index." **The desktop's
own F2 carries no such thing** — `repository.ts` reads a record file fresh
on every mutation, deliberately, because a save built from a document a form
window has held open for an hour would silently drop whatever a different
window wrote meanwhile. AF2 matches that: the repository is a set of
stateless functions over files, not a cached collection. What "index" meant
is the vehicle **listing** — every slug on disk, and the display name behind
each, built by scanning `vehicles/` the way the desktop's `listVehicleSlugs`
and `vehicleNames` do. Corrected here rather than carried forward wrong,
`issues.md`-style: AF1.md's map is left as it stands, since a provisional
sketch being refined by the milestone it describes is what §1.2 says will
happen, not a defect in the earlier document.

The design phase (deferred, AF1.md §1.2) still gates AF7, not AF2 — nothing
here decides how anything looks.

---

## 2. SCOPE — IN

### 2.1 The record shapes — a direct port, not a reinterpretation

`src/shared/records.ts`, `scaled.ts` and `slug.ts` are the source of truth.
AF2 ports each to Kotlin field-for-field:

- **`Vehicle`** — `name`, `make`, `model`, `year`, `engine`, `fuel_spec`,
  `plate`, `vin`, `tank_capacity_l`, `purchase_date`, `purchase_price`,
  `registration_date`, `inspection_due`. No photo field — never, on either
  platform (XTRITIUM §4.4).
- **`FuelEntry`**, **`CostEntry`**, **`ServiceEntry`** — `[[entry]]` per
  record, exactly §4.4's keys. `total` is a *known* key on the fuel side
  specifically so it can be **dropped**, not carried: derived values are
  never stored (§3 principle 7), and a file that arrives with one loses it
  on the next save — the desktop's own reasoning, unchanged.
- **Vocabularies as data**: `FUEL_TYPES`, `COST_GROUPS`,
  `COST_CATEGORIES`, `SERVICE_CATEGORY`, `PAYMENT_METHODS` — the same lists,
  the same slugs, so a category typed on the phone and one typed on the
  desktop are the same string when AF8 brings them together.
- **Ids** — `f-0001`, `c-0001`, `s-0001`, allocated from the highest id
  already present in the file, never from a count. A hand-edited file with a
  gap cannot produce a duplicate; deleting the highest entry frees its
  number, which is correct and is F2's own settled answer (`issues.md` I-07),
  not a bug for AF2 to "fix."

### 2.2 Scaled integers — `Scaled.kt`

XTRITIUM §4.3, ported from `scaled.ts` exactly: money ×100, pump figures
×1000, tank capacity ×10. TOML holds the human figure as entered; every
arithmetic runs on the scaled integer, converted once at load. The rounding
step is not optional — `19.99 × 100` is `1998.9999999999998` in IEEE
doubles on the JVM exactly as it is in a JS engine, and truncating loses a
cent. `formatScaled` builds the text from the integer, never from a
`Double.toString()`, so `amount = "11746.00"` survives a round trip instead
of degrading to `11746`.

### 2.3 Schema versioning

XTRITIUM §4.2, unchanged from AF1's `settings.toml` precedent: every file
carries `schema_version = 1` first. An older version is upgraded **in
memory** on read and written back at the current version on the next save.
No migration framework — a version check, nothing more.

### 2.4 The TOML layer — hand-written, not tomlkt's serializer

The desktop's `toml.ts` states the reason and it transfers unchanged:
XTRITIUM §4.4 fixes the *exact text* of every record file, and a
general-purpose serialiser cannot meet it — it drops the trailing zero that
makes `11746.00` read as `11746`, and orders keys however a data class
happens to declare them. So **reading** goes through tomlkt's document model
(`Toml.parseToTomlTable`, `TomlTable`, `TomlElement` — the same API
`WatchToml.kt` uses in SAAT, for the identical reason: `@Serializable`
decoding throws on a single mistyped hand-edited field and costs the whole
file, where reading the tree costs one field), and **writing** emits its own
text, key by key, in §4.4's order. `TomlKit.kt` ports `toml.ts` function for
function: `readString`/`readInteger`/`readNumber`/`readBoolean`/`readDate`
(permissive — a wrong type reads as the zero value, matching the desktop's
own leniency, not SAAT's warning-collecting one), `basicString`/
`inlineValue`/`line`/`dateLines`/`carriedLines`/`unknownKeys` for writing.

**Unknown keys are preserved, not dropped.** This is the one place AF2
cannot follow AF1's `ConfigStore` precedent (a typed DTO decode that keeps
only what it recognises) — a vehicle's record files are the maker's
irreplaceable data, not a settings cache, and `issues.md` I-35 is what
happens when a milestone's own unknown-key mechanism is bypassed by
accident. Every reader extracts known fields and carries the rest in a
`rest: Map<String, TomlElement>`; every writer emits the known fields in
order and appends whatever `rest` holds, unrendered, as inline values — the
same reason the desktop renders unknowns inline rather than as a table
header: an unknown key can appear inside `[[entry]]`, where a nested header
would be a syntax error.

### 2.5 `EntryDocument<T>` / `EntrySpec<T>` — one generic pattern, three record files

A direct port of `entry-file.ts`. `fuel.toml`, `costs.toml` and `service.toml`
are the same document shape — a schema stamp, then a run of `[[entry]]`
tables — so the parsing, the id allocation, the unknown-key bookkeeping and
the emitting live once in `EntryFile.kt`, and `FuelFile.kt`/`CostFile.kt`/
`ServiceFile.kt` each supply only their own field handling, mirroring
`fuel-file.ts`/`cost-file.ts`/`service-file.ts` line for line. `vehicle.toml`
is not an entry list — one file, one flat table — and gets its own
`VehicleFile.kt`, porting `vehicle-file.ts`.

**A corrupt record file is reported and left exactly as it is.** This is
the one deliberate departure from AF1's `ConfigStore`, and the desktop
states why: a corrupt `settings.toml` falling back to defaults costs a
palette choice; a corrupt **data** file falling back to "no entries" and
then being saved would erase the maker's records. `CorruptRecordException`
carries the parse failure out; nothing downstream is permitted to treat it
as empty.

### 2.6 Slugs — `Slug.kt`, ported from `slug.ts`, not from SAAT's `Slugs.kt`

Two siblings answer the same question differently, and AF2 follows its own
desktop rather than SAAT's, because §4.1's directory has to match: a
vehicle's slug is how AF8's export finds "the same vehicle" on both sides of
the bundle (F16 §2.2 — "a vehicle is matched by `slug`"), so the two
platforms must produce byte-identical slugs from byte-identical input. SAAT
solves the Turkish dotless-i trap with locale-independent `lowercase()`,
which fixes the casing bug but does not transliterate `ğ ş ö ç ü` to ASCII at
all. The desktop's `slug.ts` does both, with an explicit table
(`ı→i, İ→i, ğ→g, ş→s, ö→o, ç→c, ü→u`) precisely so the answer never depends
on locale — that table is what AF2 ports, character for character, plus
Kotlin's own locale-independent `lowercase()` for everything the table
doesn't touch (identical guarantee to the desktop's non-locale-aware
`toLowerCase()`). `slugFor` (with the `"vehicle"` fallback) and the bare
`slugify` (no fallback, for AF5's manual cost categories later) both port;
`categorySlug`'s `issues.md` I-17 lesson — no fallback for a category, ever —
carries with it.

**Collision resolution** — `uniqueSlug`, case-insensitive, `-2`/`-3`
suffixes — ports from `repository.ts`, not from SAAT's version: the two are
the same algorithm, and the desktop's is the one whose behaviour AF8 must
match.

### 2.7 Backups — armed now, ahead of the UI that will need them

`Backup.kt` ports the desktop's `backup.ts` (`backupsDir`, `stampFor`,
`backupFiles`, `prune`, `BACKUPS_KEPT = 20`) — SAAT's rule, in the desktop's
own words: *"Before any destructive change the previous version is copied
into `backups/`."* The desktop only wired this in at F16, because until
import nothing overwrote a file the maker did not have open in front of him.
AF3–AF6 give the phone forms that edit and delete entries directly, so AF2
wires the utility into the repository's `update*`/`remove*` functions now,
even though no screen calls them yet — the same reasoning AF1 gave for
taking `androidx.appcompat` early: cheap now, and the alternative is
retrofitting it once the UI exists to make it visible when it's missing.
`backups/` sits beside `vehicles/` at the data root; nothing in the loader
can mistake one for the other, since a vehicle slug requires a
`vehicle.toml` and a backup round never has one at that level.

### 2.8 `VehicleRepository.kt` — the orchestration layer

Ports `repository.ts` function for function: `vehicleDir`/`vehicleFiles`,
`listVehicleSlugs` (a directory without `vehicle.toml` is not a vehicle),
`vehicleNames` (a record that will not parse is absent from the map, not a
crash — the caller shows the slug, which is the truth about where the file
is), `loadVehicle` (whole files in, at once — XTRITIUM §4.1), `save*` per
record type, and `add*`/`update*`/`remove*` per entry kind — each a
read-modify-write **against the file as it stands right now**, per §1's
correction, not against a cached copy. `update*`/`remove*` call `Backup.kt`
first. `allocateId` delegates to `Records.kt`'s `nextId`.

### 2.9 What is written

| Path | What it is |
|---|---|
| `android/app/src/main/kotlin/.../storage/Records.kt` | **new** — the four record data classes, vocabularies, id allocation |
| `android/app/src/main/kotlin/.../storage/Scaled.kt` | **new** — scaled-integer arithmetic |
| `android/app/src/main/kotlin/.../storage/Slug.kt` | **new** — the transliteration table, `slugFor`/`slugify`/`uniqueSlug` |
| `android/app/src/main/kotlin/.../storage/TomlKit.kt` | **new** — the hand-written read/write helpers over tomlkt's document model |
| `android/app/src/main/kotlin/.../storage/EntryFile.kt` | **new** — `EntryDocument<T>`/`EntrySpec<T>`, the generic `[[entry]]` reader/writer |
| `android/app/src/main/kotlin/.../storage/{Vehicle,Fuel,Cost,Service}File.kt` | **new** — one module per record type |
| `android/app/src/main/kotlin/.../storage/Backup.kt` | **new** — timestamped rounds, newest 20 kept |
| `android/app/src/main/kotlin/.../storage/VehicleRepository.kt` | **new** — the orchestration layer |
| `android/app/src/main/kotlin/.../storage/TritiumPaths.kt` | **new** — `vehiclesDir`/`backupsDir`, injected root, mirrors AF1's `ConfigStore` pattern |
| `android/app/src/test/kotlin/.../storage/*Test.kt` | **new** — §4 below |

---

## 3. SCOPE — OUT

No UI of any kind — no vehicle picker, no entry forms, no lists; AF3 opens
that. No first-run currency question (AF3). No consumption engine (AF4). No
cost or service forms (AF5, AF6). No export or import — AF8, and F16's
bundle format is what AF8 must produce, not AF2's business. No migration
framework. No design decisions. `settings.toml` is untouched — AF1's
`ConfigStore` stands as it is; `currency`/`units`/`format` arrive with the
milestones that give them meaning, exactly as the desktop deferred them
past its own F1.

---

## 4. ACCEPTANCE CRITERIA

AF2 is done when every line below is true:

1. `./gradlew check` is green: all units below, the manifest-policy
   guardian, `LicenceAssetParityTest`.
2. Writing each of the four record types produces a file that matches its
   XTRITIUM §4.4 sample exactly — same keys, same order, same decimals —
   plus the `schema_version` header. Verified by parsing the desktop's own
   literal §4.4 samples in a test fixture and asserting the round trip.
3. `schema_version = 1` is the first line of every file written.
4. A file carrying an older `schema_version` is upgraded in memory on read
   and written back at the current version on the next save.
5. Unknown keys in any record file — including inside an `[[entry]]` —
   survive a read-modify-write untouched.
6. A corrupt record file is reported (`CorruptRecordException`) and left
   byte-for-byte unchanged on disk.
7. Money and pump arithmetic is exact: summing a hundred entries in scaled
   integers matches the expected total to the cent, with no floating-point
   drift — the same walk-the-whole-range discipline `issues.md` I-15 and
   I-16 already required of the desktop.
8. `total` never appears in a written `fuel.toml`, and is discarded if
   present in one read.
9. A kill-mid-write simulation against a record file leaves the previous
   version intact — AF1's `AtomicWrite` torn-write test, pointed at a
   record file instead of `settings.toml`.
10. A vehicle named with Turkish letters (`ı ğ ş ö ç ü İ`) produces the
    **same slug** the desktop's `slug.ts` would produce from the identical
    name, with no locale-aware call — proved by flipping the JVM default
    locale in the test, the way SAAT's own `SlugTest` proves the
    independence rather than trusting the comment.
11. `uniqueSlug` resolves a collision case-insensitively with `-2`, `-3`.
12. `update*`/`remove*` on any entry kind leave a fresh backup round in
    `backups/`, pruned to the newest 20; `add*` and a plain `save*` do not.
13. Zero permissions still holds — AF1's guardian is unaffected by this
    milestone and still passes.
14. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme (as AF1.md §5 records the maker's explicit
exception for AF1 itself): AF2 builds up **untagged** by default, sideloaded
from the maker's own build, unless the maker signals otherwise the way he
did for AF1. `AF3.md` is written after AF2 exits.
