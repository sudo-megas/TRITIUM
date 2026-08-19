# TRITIUM — AF6b · rides on versionName 0.6 · «Design phase»

Repo path of this file: `~/REPO/build/docs/AF6b.md`
Governing document: `~/REPO/XTRITIUM.md` — where this file and XTRITIUM disagree, XTRITIUM wins.

AF6b is not a numbered AF milestone in AF1.md §1.2's own map. It is the thing
that map already named without giving it a number: *"the design phase must
conclude before AF7."* AF1.md §2.1 decision 7 deferred one fork explicitly —
*"Material 3 against the desktop's CaskaydiaCove-and-eleven-palettes identity
or something native"* — and `TritiumTheme.kt`'s own doc comment has carried
that same open question, unanswered on purpose, since AF1. AF6b closes it.

It takes its name and its slot from the desktop's own precedent: F4b, an
inserted milestone between the F-number before it and the one it had to
finish ahead of. Nothing else about F4b carries over — F4b is 656 lines of
CSS custom properties, `box-shadow` bans, Wayland window-placement bugs and
OKLCH-derived desktop palettes, none of which has a Compose counterpart.
AF6b is the Android-shaped answer to the same question F4b answered for the
desktop, not a port of F4b's own content.

---

## 1. THE DECISION

**TRITIUM Android goes native Material 3** — dynamic/tonal colour where the
platform offers it, the standard M3 type scale, system light/dark. Not the
desktop's CaskaydiaCove-monospace-everywhere identity, not its eleven
hand-picked palettes.

This was a maker decision, not an inferred one — the fork AF1.md deferred is
exactly the kind of hard-to-reverse identity call XTRITIUM §11 always routed
back to the maker on the desktop, and AF6b routes it back here the same way.

### 1.1 What this settles, and why each part is small

| Decision | Answer | Why it doesn't need more than this |
|---|---|---|
| Colour | `dynamicLightColorScheme`/`dynamicDarkColorScheme` (API 31+, `Build.VERSION_CODES.S`) — the wallpaper-derived tonal palette. Below API 31 (minSdk 26 reaches back five versions further), the M3 baseline `lightColorScheme()`/`darkColorScheme()` — no custom seed colour, no brand colour picked here, since the fork just closed was "native," not "native, but branded" | Android's own answer to "what colour should this app be" once dynamic colour is the premise. Inventing a seed colour would be re-opening the fork one layer down |
| Light/dark | `isSystemInDarkTheme()` — already how `PlaceholderLightScheme`/`PlaceholderDarkScheme` switched | Unchanged mechanism, only the schemes themselves were ever placeholder |
| Typography | The M3 default type scale, unchanged | Every screen already reads `MaterialTheme.typography.headlineSmall`/`bodyMedium`/`bodySmall` — AF1 through AF6 were already writing to the real type scale, just under placeholder colour. There is nothing here to design |
| Spacing | The `24.dp`/`16.dp`/`12.dp`/`8.dp` figures already used across every form and list screen, unchanged | Same reasoning — AF3 through AF6 already settled this by precedent, screen by screen, without a name for it |
| Nav destinations | Home, Fuel, Costs, Service, Settings — final, not provisional. AF1.md §2.1 decision 7 called the count and names provisional pending this decision; AF6 has now shipped a fifth tab without incident and no sixth is named anywhere in the AF-map before AF9 | The count was only ever uncertain because the identity fork was open. It is closed |
| Dense-table/list visual spec | Out of scope — AF1.md's own AF-map already calls AF7 *"a mobile-appropriate view, not a port of the desktop's dense tables,"* a decision made before AF6b and not this document's to revisit | F4b's own dense-table spec (32–36px rows, chevron sort states, no zebra) answers a question AF7-Android was never going to ask |
| What AF9's "palette" setting means | A light/dark/system toggle, and whether to allow dynamic colour, is the true shape once native M3 is the premise — not a picker over the desktop's eleven palettes | Recorded here so AF9 inherits the answer instead of re-opening the fork; AF9 itself still builds the setting, AF6b only names what it will be |

### 1.2 Precedent this follows

F1.md's own reasoning for the desktop's provisional tab bar — *"placeholder
palettes carry obviously-wrong colours on purpose so nobody mistakes them for
the design phase's output"* — is exactly why `PlaceholderMagenta`/`Lime`/
`Mustard` existed from AF1 onward: so that closing this fork would be a
visible, deliberate act, not a colour someone forgot to change.

AF6b also takes F4b's precedent on the one thing this title line got wrong on
first push: F4b rode between F4 and F5 without ever claiming a version number
of its own. AF6b's first commit briefly bumped `versionName` to `0.7` —
AF1.md's own map already promises that number to AF7, not to a design pass
sitting in front of it — and the mistake was caught and corrected before AF7
existed to collide with it. AF6b rides on **0.6**, AF6's own number; AF7 is
the one that moves the version forward.

---

## 2. SCOPE — IN

**1 — `ui/theme/TritiumTheme.kt` rewritten.** The placeholder schemes are
deleted outright, not deprecated or left dead. `dynamicLightColorScheme`/
`dynamicDarkColorScheme` on API 31+, `lightColorScheme()`/`darkColorScheme()`
(M3 baseline, no custom seed) below it, switched on `isSystemInDarkTheme()`
exactly as the placeholder version already did.

**2 — Nothing else changes.** No screen's typography or spacing calls
change — they were already correct, only ever painted in placeholder
colour. No new settings UI — that is AF9's, this document only names the
shape it will take. No new destination — five stays five.

### 2.1 What is written

| Path | What it is |
|---|---|
| `ui/theme/TritiumTheme.kt` | **modified** — the only file this milestone touches |
| `build/docs/AF6b.md` | **new** — this document |

---

## 3. SCOPE — OUT

No AF9 settings UI for theme/palette — this document only fixes what that
setting will mean, AF9 still builds it. No custom seed colour, no brand
mark, no app icon work. No desktop-identity assets (CaskaydiaCove, the
eleven palettes) touched, ported, or referenced from Android code. No
dense-table spec — AF7 was already scoped away from the desktop's table
before this document existed. No change to any screen's layout, spacing,
or component structure — AF6b is a colour-and-typography-engine decision,
not a redesign of AF1–AF6's already-shipped screens.

---

## 4. ACCEPTANCE CRITERIA

AF6b is done when every line below is true:

1. `./gradlew check` is green: every prior milestone's suite untouched.
2. `TritiumTheme.kt` contains no reference to `PlaceholderMagenta`,
   `PlaceholderLime`, or `PlaceholderMustard` — deleted, not renamed.
3. On a device running API 31+, the app's colour scheme visibly follows the
   device wallpaper (dynamic colour) rather than a fixed placeholder hue.
4. On a device below API 31, the app renders the M3 baseline colour scheme
   — no crash, no placeholder colour, no reference to an unavailable API.
5. Dark mode still follows the system setting, exactly as it did under the
   placeholder scheme.
6. Every existing screen (AF1–AF6) renders unchanged in layout and
   typography — only the colours actually painted differ.
7. No AI attribution anywhere in the tree or the history.

---

## 5. EXIT

Per §9.1's resolved scheme: untagged by default, sideloaded from the
maker's own build. AF7 begins after AF6b exits — its own design fork is now
closed, and nothing else was deferred to block it.
