# TRITIUM — AF1 · versionName 0.1 (untagged) · «Scaffold & Shell»

Repo path of this file: `~/REPO/build/docs/AF1.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

F16 promised the Android phase a format and nothing else — "Getting it wrong
hands AF1 a format it cannot produce" was as far ahead as that document
looked. AF1 is where the promise starts being kept: not the fuel form, not
the vehicle picker, not a byte of `vehicles/` on a phone — a shell, armed
with the same discipline F1 gave the desktop before a single feature
existed, built against a working precedent this family already has rather
than a guess.

That precedent is `sudo-megas/SAAT`. Its Android port is real, shipped
(`android-v1.0`, `android-v1.1`), and close enough to this one — same
maker, same stack once chosen, the same storage philosophy — that AF1
checks against it before deciding anything it would otherwise have had to
invent from nothing. Three of AF1's own decisions turned out to disagree
with what `XTRITIUM.md` said before this document was written. All three
are amendments below, not silent overrides.

---

## 1. WHERE AF1 SITS

### 1.1 Three clauses recorded as decisions, and two of them undersold

`XTRITIUM.md` named the Android phase twice before this document existed —
§1's Platform row and §9.1's version paragraph — and both were written
without a working Android app to check against. A third clause, §3's fourth
hard principle, was written with no Android in view at all. AF1 is the
first thing to actually need all three, and two of the three turned out to
say less than the maker needed and the third turned out to say something
false.

**§1, Platform row.** Read "Android follows later as a full, separate
rewrite on its own branch." `sudo-megas/SAAT` — checked, not assumed — keeps
its `android/` Gradle project directly on `master`; nothing in its history
shows a surviving Android branch. AF1 follows that precedent: `android/` at
this repository's root, on `main`, from the first commit. A long-lived
branch would have bought disambiguation a tag prefix already buys for free.
Amended in `XTRITIUM.md` §1.

**§9.1, the version paragraph.** Named the phase and its milestones and
said "ends at v1.0" — no versioning scheme, no ordering constraint. AF1
resolves both, again against SAAT: `versionName` tracks the milestone
number as a decimal (this document is `0.1`), `versionCode` is a monotonic
integer bumped only on an actual tagged release, and no AF-milestone may be
called `v1.0` before the one that lets the phone write F16's bundle format
exists — SAAT's own rule about its ZIP bridge, in its own words: "releasing
an app that cannot export its data would betray everything [it] stands
for." Amended in `XTRITIUM.md` §9.1.

**§3, hard principle 4.** Said "Plaintext, hand-editable storage. A person
with Neovim can read and repair every byte of their data" — written when
"their data" meant files on an Arch machine, and literally impossible for
standard Android app-private storage on an unrooted phone. Not a preference
AF1 declined to honour; a fact about the platform the sentence had never
been tested against. Narrowed rather than dropped: the desktop copy and
every exported bundle keep the guarantee, the phone's own on-device copy
does not. Amended in `XTRITIUM.md` §3, recorded as `issues.md` I-36 — the
same shape of defect as I-33, a clause that predates the thing it turns out
to govern.

**None of the five F-documents that ever quote `XTRITIUM.md` by section
number** — checked directly — cite §1's Platform row, §9.1's version table,
or §3 principle 4 as binding scope the way F2/F3/F7/F8/F11 quote §4.1. There
is nothing here for §0's anti-drift rule to require leaving alone.

### 1.2 The provisional AF-map

Sketch only, exactly as F1.md §1 states for the F-map: confirmed as each
AF document is written. Reshaped from both F1's own map and SAAT's real
twelve-row table (`SAAT-ANDROID-milestones-AM1-AM12.md`) for TRITIUM's three
record kinds — fuel, costs, service, not SAAT's one collection — and the
fact that the phone's job, per F16's own framing, is fast entry, not
analytical depth. That stays the desktop's.

| AF | versionName | Working name |
|---|---|---|
| **AF1** | **0.1** | **Scaffold & Shell — this document** |
| AF2 | 0.2 | Storage layer — vehicle/fuel/costs/service TOML I/O, atomic writes, schema versions, backups, in-memory index |
| AF3 | 0.3 | Vehicles — records, picker, first-run currency question |
| AF4 | 0.4 | Fuel — quick-add, full form, full-tank consumption engine |
| AF5 | 0.5 | Costs — category tree, adaptive form |
| AF6 | 0.6 | Service — Periyodik Bakım shape |
| AF7 | 0.7 | Lists / summary — a mobile-appropriate view, not a port of the desktop's dense tables |
| AF8 | 0.8 | **Export** — writes F16's bundle format via `ACTION_CREATE_DOCUMENT`; round-trip test against the real desktop importer |
| AF9 | 0.9 | Settings complete + hardening — units, precision, palette (post-design-phase), heavy test pass |
| AF10 | 1.0 | Signing, GitHub Actions release workflow, README — **the public release** |

The design phase (XTRITIUM §11's own precedent, applied here) must conclude
before AF7. AF8 must land before any AF-milestone is tagged `v1.0` — §9.1's
ordering constraint, restated at §1.1 above. Only AF10 is expected to
produce an actual `android-v1.0` tag; every milestone before it is expected
to build up untagged.

---

## 2. SCOPE — IN

### 2.1 The decisions this milestone settles

**1 — `android/` at the repo root, on `main`, not a branch.**

Settled at §1.1. Gradle Kotlin DSL with a version catalog, matching SAAT's
own layout: `app/` for the application module, `buildSrc/` for build logic
that needs no AGP dependency, `gradle/` for the wrapper and the catalog.

**2 — The package name is fixed now, because it is permanent.**

`applicationId` and `namespace` are both `io.github.sudomegas.tritium` —
SAAT's own convention, reverse-domain from the maker's real GitHub
username, not a family-brand namespace invented for this app alone.
Android ties an installed app's identity to this string for the life of
every device it is ever installed on; changing it later is not a rename; it
is a new app that inherits nothing. Confirmed with the maker before a
single line of `android/` existed, the same discipline SAAT's own spec
names for its AM1.

**3 — Kotlin, Jetpack Compose, and `androidx.appcompat` taken now rather
than later.**

Compose because it is this decade's native, declarative Android toolkit —
the platform's own analogue of the React choice the desktop stack made in
§2. `androidx.appcompat` earns its place in the dependency budget for one
reason: XTRITIUM §3 principle 6 says the app never infers its language from
the system locale, and on Android that is not a default inherited for
free — resource resolution follows the system locale the instant a
`values-tr/` directory exists. The only mechanism that holds a per-app
locale across the whole `minSdk 26` range is
`AppCompatDelegate.setApplicationLocales`, which needs an
`AppCompatActivity` and a `Theme.AppCompat`-descended theme underneath the
Compose content. SAAT took this in its own AM1 rather than later,
naming the reason: the Activity base class and theme parent are expensive
to change once every screen exists. AF1 takes it for the same reason, with
no screens yet to make expensive.

**4 — One TOML library, chosen now while `settings.toml` is its only
consumer.**

`tomlkt` — the library SAAT already measured against a real fixture and
shipped, adopted directly rather than re-running that evaluation. Choosing
it while the only consumer is one settings file means that if it turns out
to be wrong, switching costs one file rather than the whole storage layer
AF2 is about to build on top of it — SAAT's own reasoning for moving its
TOML choice from AM2 to AM1, unchanged here.

**5 — Storage is app-private, TOML, atomic writes, no database.**

`filesDir/settings.toml`, holding exactly one key for AF1: `language`.
No `Room`, no `SQLite`, no ORM — XTRITIUM's storage philosophy (§4) is
"parse the whole file at launch, write the whole file back on change,"
which needs no query engine at TRITIUM's realistic scale, on the desktop or
the phone. Writes go through a single `writeAtomically` helper — temp file
in the same directory, `fsync`, `ATOMIC_MOVE` — a direct port of the
desktop's own atomic-write helper (§4.1) and of SAAT's, both of which exist
for the identical reason: a reader must see the whole previous file or the
whole new one, never a torn one.

**6 — Zero permissions, enforced by a build-time guardian, not remembered
by hand.**

The merged manifest declares no `<uses-permission>` at all — TRITIUM's
"Zero network. Ever." (§3 principle 1), at a stronger, OS-verifiable level
than the desktop's `audit-egress` grep: anyone can confirm it themselves
with `aapt dump permissions` on the APK. `buildSrc` carries
`ManifestPolicyScanner` (a pure function over the merged manifest XML,
unit-testable with no Gradle, no AGP, no device) and
`VerifyManifestPolicyTask`, which parses the **merged** manifest — after
the manifest merger runs, so a dependency cannot smuggle a permission in
underneath the hand-written one — and fails the build if any appears. Both
variants are wired into `check`, adapted directly from SAAT's own
`verifyDebugManifestPolicy` / `verifyReleaseManifestPolicy`, which already
proved the design against a real dependency (`androidx.work`, pulled in
transitively by a widget library) injecting exactly the permissions the
guardian exists to catch.

**7 — The shell ships placeholder, not a design.**

Two bottom-navigation destinations — Home and Settings — with colours and
layout that cannot be mistaken for a finished look, the same discipline
F1.md used for the desktop's provisional tab bar ("names and count are
design-phase property; the bar is F1's"). Committing to TRITIUM's actual
Android IA — how many destinations, what they are called, Material 3
against the desktop's CaskaydiaCove-and-eleven-palettes identity or
something native — is deliberately deferred to a design phase before AF7,
mirroring XTRITIUM §11's own deferral for the desktop before F3. Home is an
empty state; Settings is the one screen this milestone finishes.

**8 — Settings, working subset: language only.**

En ⇄ tr, manual, instant, persisted to `settings.toml` across a process
restart — the phone-side half of XTRITIUM §3 principle 6, "nothing read
from the OS." No units, no currency, no theme, no palette: those arrive
with vehicles (AF3) or the design phase (before AF7). About lives inside
Settings rather than as a separate destination, following SAAT's own
placement (§5.10) rather than inventing a third bottom-nav item for one
static screen: the mark, the maker, the version, the source address, the
licence — selectable text, never a clickable link, exactly as XTRITIUM §5
and §10 already require of the desktop's own About page.

**9 — CI armed from day one, not tacked on later.**

`android-ci.yml`, path-filtered to `android/**` so the desktop's own
`package.yml` is never triggered by an Android-only push and vice versa.
Unit tests, the manifest-policy check, `assembleDebug`, the debug APK
uploaded as a build artefact — matching SAAT's own AM1 scope line
("Scaffold: Gradle, Compose, shell, theme, zero-permission manifest, CI")
rather than treating CI as packaging-phase work the way the desktop's own
`package.yml` arrived late. No release workflow yet: that is AF10's, gated
on a signing key that does not exist until then.

CI compiles the one instrumented test (`ShellLanguageSwitchTest`,
§2.1 decision 8's language switch) with `assembleDebugAndroidTest` — a
compile-time check only, so a broken test file is a red build rather than a
silent gap — but does not run it. `ubuntu-24.04` provisions no emulator, and
adding one is real cost this milestone does not need to spend; §4's
acceptance criteria draw the line explicitly between what CI proves and
what running the debug APK on the maker's own device proves.

### 2.2 `android/.gitignore` — before there is anything to ignore

`*.keystore`, `*.jks`, `keystore.properties` excluded from the first
commit, before `tritium.jks` exists to be careless with — SAAT's own stated
reasoning, adopted verbatim: "in place from the first commit, before any
keystore existed to be careless with." `tritium.jks` will be a **new**
keystore when AF10 generates it, made the same way the maker already made
`saat.jks` — deliberately not a reuse of it, so a compromise of one app's
signing key can never reach the other's.

### 2.3 What is written

| Path | What it is |
|---|---|
| `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`, `android/gradle/libs.versions.toml` | **new** — the Gradle project root and its version catalog |
| `android/gradle/wrapper/`, `android/gradlew`, `android/gradlew.bat` | **new** — the Gradle wrapper, pinned |
| `android/.gitignore` | **new** — §2.2 |
| `android/app/build.gradle.kts`, `android/app/proguard-rules.pro` | **new** — the application module |
| `android/app/src/main/AndroidManifest.xml` | **new** — zero permissions, the AppCompat locale service |
| `android/buildSrc/` | **new** — `ManifestPolicyScanner`, `VerifyManifestPolicyTask`, and their own unit tests |
| `android/app/src/main/kotlin/.../storage/AtomicWrite.kt` | **new** — the atomic-write helper |
| `android/app/src/main/kotlin/.../config/{AppConfig,ConfigState,ConfigStore}.kt` | **new** — `settings.toml`, one key |
| `android/app/src/main/kotlin/.../MainActivity.kt`, `TritiumApplication.kt` | **new** — the AppCompat entry point |
| `android/app/src/main/kotlin/.../ui/theme/TritiumTheme.kt` | **new** — deliberately-wrong placeholder colours |
| `android/app/src/main/kotlin/.../ui/nav/`, `.../ui/TritiumApp.kt`, `.../ui/screens/{Home,Settings}Screen.kt` | **new** — the shell |
| `android/app/src/main/res/values{,-tr}/strings.xml`, `android/app/src/main/res/values/themes.xml`, `.../colors.xml`, launcher icon XML | **new** — catalogues, the AppCompat theme parent, a deliberately-placeholder adaptive icon |
| `android/app/src/main/assets/LICENSE` | **new** — a copy of the repository's `LICENSE`, held honest by `LicenceAssetParityTest` |
| `android/app/src/androidTest/kotlin/.../ShellLanguageSwitchTest.kt` | **new** — compiled by CI, run on a device (§2.1 decision 9) |
| `.github/workflows/android-ci.yml` | **new** — §2.1 decision 9 |
| `XTRITIUM.md` | §1, §3, §9.1 amended (§1.1) |
| `build/docs/issues.md` | I-36 |

---

## 3. SCOPE — OUT

No storage beyond `settings.toml`. No vehicles, fuel, costs, service,
export, or import — AF2 onward. No signing config, no release workflow:
AF10's, gated on AF8's export path existing first. No design decisions —
the placeholder colours are deliberately wrong, and the two-destination
shell is provisional in count and in name, not a ruling on TRITIUM's actual
Android IA. No distribution tooling of any kind beyond the plain debug-APK
artefact CI already uploads: GitHub Releases only, arriving at AF10 —
explicitly not IzzyOnDroid, not F-Droid, not Google Play, all of which SAAT
uses and TRITIUM deliberately does not. No cross-platform parity tooling in
CI: TRITIUM's desktop is TypeScript, not SAAT's Python, and F16's bundle
format is the parity contract between the two apps, not a shared loader CI
can invoke directly — that check belongs to AF8, against the desktop's own
importer, not to AF1, which has no bundle to check yet. No CI-run device
tests: `ubuntu-24.04` provisions no emulator, and `ShellLanguageSwitchTest`
is compiled by CI (§2.1 decision 9) but run by hand, on the maker's own
device or an emulator, until a milestone actually needs the emulator's cost.

---

## 4. ACCEPTANCE CRITERIA

AF1 is done when every line below is true:

1. `./gradlew assembleDebug` succeeds on a machine that has never seen
   `tritium.jks` or any keystore.
2. `./gradlew check` is green: `buildSrc`'s own unit tests, the app's unit
   tests (atomic-write torn-write simulation, `settings.toml` round-trip
   through `tomlkt`, `LicenceAssetParityTest`), and
   `verifyDebugManifestPolicy` + `verifyReleaseManifestPolicy`.
   `./gradlew assembleDebugAndroidTest` also succeeds, compiling
   `ShellLanguageSwitchTest` without requiring a device.
3. The merged manifest — debug and release variants both — declares zero
   `<uses-permission>` entries, confirmed independently with
   `aapt dump permissions` against the assembled debug APK.
4. The manifest-policy guardian is **proved to bite**: a permission
   reintroduced by hand fails the check, removing it turns the check green
   again — F16's own I-29 lesson, that a gate never seen to fail is not
   evidence.
5. Language toggles en ⇄ tr instantly in the running app and persists via
   `settings.toml` across a process restart — confirmed on the maker's own
   device or an emulator, since CI compiles `ShellLanguageSwitchTest` but
   does not run it (§2.1 decision 9).
6. About shows the maker, the version, the source address, and the full
   licence text — read from `assets/LICENSE`, not retyped — with every
   address selectable and none of it clickable: XTRITIUM §5 and §10,
   unchanged by platform. No release date: AF1 ships no tag, so there is
   none yet (§5, below).
7. `android-ci.yml` runs on a push to `android/**` and stays green; a push
   touching only `src/` (the desktop tree) does not trigger it. `package.yml`
   is untouched by any of this — it triggers only on a `v*` tag push or
   manual dispatch, never on an ordinary push, so there was never a path
   filter for the two to collide over in the first place.
8. `io.github.sudomegas.tritium` appears identically everywhere it is
   named — `namespace`, `applicationId`, this document, the CI workflow —
   and the `android-v*` tag scheme appears identically everywhere it is
   described — this document and `XTRITIUM.md` §9.1. The exact failure
   shape `issues.md` already records twice (I-10, I-34): a table saying one
   thing while the files say another.
9. `XTRITIUM.md` carries all three dated amendments from §1.1, and
   `issues.md` carries I-36.
10. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

§9.1's resolved scheme expected AF1 to build up untagged, sideloaded from
the maker's own build, the same way SAAT's own AM1 did. **The maker's
explicit signal overrode that default**, per XTRITIUM §9.2's own rule that
nothing is implicit and a milestone ends only when he says so: commit, tag
`android-v0.1`, push — explicitly **not** a release. No GitHub Release
exists for it, no APK is attached to anything, and no `android-release.yml`
runs — that workflow doesn't exist until AF10, and nothing in this milestone
would trigger it if it did.

The distinction the tag draws is real even though it is a deviation from
the general rule: `android-v0.1` marks a commit the maker chose to mark, not
a build he is telling anyone to run. §9.1's scheme still governs
AF2 onward — AF1 is the one milestone tagged by explicit exception, recorded
here rather than left for a reader to notice the tag and assume the general
rule had silently changed.

`AF2.md` is written after AF1 exits.
