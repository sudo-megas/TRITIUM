# F4b-niri — niri + Noctalia platform compatibility

This supplements F4b-draft.md's Wayland section (§4) with a dedicated pass on the
maker's actual desktop: niri, a scrollable-tiling Wayland compositor, with
Noctalia as the shell. That this is the real target, not a generic
"Linux/Wayland" case, is already visible in the codebase — `noctalia` is one of
the eleven ids in `PALETTES` (`src/shared/settings.ts`) — and in the maker's own
dev logs. Two claims already sitting in F4b-draft.md turned out to be wrong or
overstated once checked against primary sources; both are corrected here by name
rather than left as a silent contradiction (§1.6, §4.9).

**Method note.** This machine is not the target platform. `printenv` shows
`XDG_CURRENT_DESKTOP=KDE`, `XDG_SESSION_TYPE=wayland`, `XDG_SESSION_DESKTOP=KDE`,
`DESKTOP_SESSION=/usr/share/wayland-sessions/plasma.desktop` — a KDE Plasma
Wayland session, not niri. Neither `niri` nor `quickshell` is installed here
(`which niri`, `which quickshell`, and `pacman -Q niri quickshell` all fail).
Nothing in this report was run under niri or Noctalia. Every niri- and
Noctalia-specific claim below comes from documentation and source code read
directly — not from local observation. Section 2 lists what to run once on the
maker's real machine to close that gap.

**Web search note.** The session's WebSearch budget (200/200) was already
exhausted before this task's research began — spent by other work running
concurrently in the same session. Stated plainly per instructions, not silently
worked around: every finding below came from direct `WebFetch` against URLs
found by walking documentation trees (GitHub repos and wikis, GitHub's REST API,
`raw.githubusercontent.com`, `chromium.googlesource.com`, docs sites), not from
search snippets. This did not prevent reaching primary sources — everything
tagged VERIFIED below was fetched and read directly, including Chromium source
files and GitHub issues fetched by number — but it did rule out casting a wide
net for secondhand reports, so REPORTED-tier findings are thinner than they
would otherwise be, and a small number of items are recorded as gaps in §5
rather than chased further.

---

## 1. What must change in the code, now

Ranked by severity first, then by cost-to-fix. A window that can silently fail
to appear at all outranks a window that appears but behaves wrong, which
outranks a defensive improvement against something not currently observed to be
broken.

### 1.1 Add a fallback timer before `show()` — every window depends on a Wayland bug that is still open

**File:** `src/main/windows.ts`, `createMainWindow` and `openFormWindow` — both
currently do only:

```ts
window.once('ready-to-show', () => window.show())
```

**Why:** `electron/electron#48859`, "Event ready-to-show not triggering /
inconsistent trigger on wayland," is open as of this writing — filed
2025-11-09, last activity 2026-07-23, 18 comments, labeled `38-x-y`, `39-x-y`,
`wayland`, `bug`, `component/BrowserWindow`. It reproduces across NVIDIA, AMD,
and ARM Mali GPUs — not a single vendor's driver bug — and one commenter traced
it to Chromium/Blink itself (`DidMeaningfulLayout` never firing when
`--disable-gpu` is in effect), filing it upstream. TRITIUM is on Electron
43.4.0, inside the affected range this issue documents, and every window it
opens — the main window and all four form kinds — relies exclusively on
`ready-to-show` with no fallback. If the event fails to fire on a given launch,
that window never calls `show()` and never appears: not a visual glitch, a
window that silently does not exist from the user's point of view, with nothing
in the log to explain why.

**Fix:** keep `ready-to-show` as the primary path — it avoids the flash that
showing immediately would reintroduce — but add a bounded fallback so a stuck
window still recovers:

```ts
const showOnce = once(() => window.show())
window.once('ready-to-show', showOnce)
setTimeout(showOnce, 3000)
```

(The exact timeout is a judgment call: long enough to essentially never fire in
the healthy case, short enough that a stuck window recovers quickly.) Pair this
with `backgroundColor` (below), so if the fallback path is the one that fires,
the window that appears is painted the right color instead of flashing white or
black first.

**Also do:** set `backgroundColor` on every `BrowserWindow` at construction,
using the palette already read via `settingsNow()` before any window is
created. Electron's own docs recommend exactly this pairing: "it is recommended
to show the window immediately, and use a `backgroundColor` close to your app's
background" for cases where `ready-to-show` is late — TRITIUM's case is worse
than "late" (it can not fire at all), which makes the pairing more warranted,
not less.

**Confidence:** high that the bug is real, current, and applies directly to
TRITIUM's exact pattern (sourced from the issue itself, fetched by number).
Medium on the specific mitigation shape — a timeout is the standard defensive
pattern for this class of bug, not something Electron documents as *the* fix,
because the underlying issue is still open and unresolved upstream.

### 1.2 Give every form window a `parent`, not just `currency`

**File:** `src/main/windows.ts`, `openFormWindow`.

**What:** `parent` is currently attached to the `BrowserWindow` constructor only
when `modal` is true, and `modal` is only true for the `currency` kind:

```ts
...(modal && parent !== undefined ? { parent, modal: true } : {})
```

`vehicle`, `fuel-quick`, and `fuel` windows are built with no `parent` at all —
even though `openFormWindow` already receives `mainWindow` from `index.ts` and
simply discards it for these three kinds.

**Why:** niri auto-floats a new toplevel only if it has a parent window, or
fixed (non-resizable) dimensions — verified directly from niri's own wiki: "New
windows automatically float if they meet either condition: They have a parent
window (e.g., dialogs); They possess fixed dimensions (e.g., splash screens)."
None of TRITIUM's three non-modal form kinds set `parent`, and none are
constructed with `resizable: false`, so neither condition is met. Under niri
they will not float — they will open as an ordinary tiled column in the scroll,
next to or displacing the main window. That is the opposite of what the
constitution says forms are: XTRITIUM describes entry forms as "movable,
non-anchored popup windows... draggable outside the main one," and
`windows.ts`'s own comment says a form the maker "cannot push aside to look at
the list behind it would be a worse form." A tiled column is not
push-asideable the way a floating window is — it is a peer the user has to
scroll away from, and opening one can visually shove the main window aside.

**Fix:**

```ts
...(parent !== undefined ? { parent, ...(modal ? { modal: true } : {}) } : {})
```

`parent` without `modal` is a normal, common Electron combination — it
establishes ownership and stacking without blocking input to the main window,
matching the non-blocking-but-related relationship the constitution describes.

**Confidence:** high. The niri mechanism is a direct quote from its own wiki.
The code change is mechanical and low-risk. One caveat: niri's floating layer
is itself a feature added in niri 25.01 — on an older niri there is no floating
layer to opt into, and this fix has nothing to attach to. Verify the maker's
niri version (§2).

### 1.3 Give every window a distinct title

**Files:** `src/renderer/index.html` (one static `<title>TRITIUM</title>`
shared by every window and every form kind today); the renderer already knows
which form it is via `FormRequest`/`FORM_ARG` (`src/shared/forms.ts`), so
setting `document.title` per kind on mount is a small, local change.

**Why:** every TRITIUM window — main and all four form kinds — currently
renders the identical title "TRITIUM", and the app has no Wayland app-id
configured (no electron-builder config exists in the repository yet, so the app
presents Electron's own default app-id, not one specific to TRITIUM). Together
this means no niri `window-rule` can currently distinguish the main window from
a form window, or one form kind from another. This is not just a missed
nicety: niri issue #3895 documents that a rule matched only on `app-id` sizes
*every* window sharing that app-id identically, including dialogs. Until titles
differ, a maker's window-rule aimed at "the main window" silently also grabs
every form window, and vice versa.

**Fix:** set `document.title` on mount, keyed off the form kind — e.g. "TRITIUM
— Vehicle", "TRITIUM — Quick Fill-up", "TRITIUM — Fill-up", "TRITIUM —
Currency" — leaving the main window's title as plain "TRITIUM". Useful
independent of niri too: window switchers, alt-tab previews, and `niri msg
windows` output (§2) are all currently indistinguishable across TRITIUM's five
window kinds.

**Confidence:** high on the niri mechanics (sourced, §4.4). The exact title
strings are a naming choice, not a technical one.

### 1.4 Document a niri `window-rule` block for the maker

Once 1.2 and 1.3 land, a concrete rule becomes possible to write. Pattern
lifted from Noctalia's own shipped niri config for itself — `match
app-id="dev.noctalia.Noctalia" open-floating true; default-column-width {
fixed 1080; } default-window-height { fixed 920; }` (docs.noctalia.dev,
Compositor Settings: niri) — adapted to TRITIUM's current (pre-packaging)
app-id and the title scheme from 1.3:

```kdl
// TRITIUM main window — comfortable default column width. Matches nothing
// else once form windows carry distinct titles (see 1.3).
window-rule {
    match app-id="electron" title="^TRITIUM$"
    default-column-width { proportion 0.62; }
}

// TRITIUM form windows — floating is already automatic once every form sets
// `parent` (see 1.2). This rule is belt-and-suspenders: it fixes the open
// position explicitly instead of trusting the automatic default alone.
window-rule {
    match app-id="electron" title=r#"^TRITIUM — "#
    open-floating true
    default-floating-position x=48 y=48 relative-to="top-left"
}
```

**Caveat to hand the maker along with this:** `app-id="electron"` matches *any*
unpackaged Electron app running in dev mode on the same machine, not only
TRITIUM. Safe for now; revisit once TRITIUM ships its own `appId` via
electron-builder (a packaging-time concern, not urgent) so a rule pasted into a
permanent config today doesn't surprise the maker later when some other
Electron app is being developed on the same box.

**Confidence:** high on syntax (sourced directly from niri's Window Rules wiki
page, §4.4). Medium on `proportion 0.62` as a specific default — that is a
design choice, not a technical constraint.

### 1.5 Pin `nativeTheme.themeSource` explicitly

**File:** `src/main/index.ts` — no current reference to `nativeTheme` anywhere
(confirmed by search of `src/`).

**Why:** TRITIUM's own palette CSS never queries `prefers-color-scheme`
(confirmed by search) — the eleven palettes cannot be silently overridden by
the OS/portal color-scheme signal, and that part is already safe, by omission.
But `nativeTheme.themeSource` defaults to `'system'`, and Chromium's own
default UA stylesheet for native, unstyled form controls (checkboxes,
`<select>`, any scrollbar chrome the app doesn't explicitly restyle) still
resolves `prefers-color-scheme` from the live OS/portal signal under that
default, independent of what the app's own CSS does. Today the isolation works
only because no such unstyled native control happens to be visible — it is
incidental, not guaranteed, and won't survive the UI growing a control the
design didn't think to restyle.

**Fix:** set `nativeTheme.themeSource` explicitly — a fixed value, or
dynamically alongside the palette-change handler in `settings:write` if the
eleven palettes carry (or gain) a light/dark classification. Either closes the
gap on purpose instead of leaving it to accident. This is not about reading the
OS preference — it's the opposite: decouple from it deliberately, so the
decision is explicit.

**Confidence:** medium-high on the mechanism (`nativeTheme.themeSource`'s
effect is documented directly in Electron's own API docs). Medium on priority
— this is a latent risk that grows with the UI, not a currently-visible bug.

### 1.6 No action needed: Ozone/Wayland platform selection

**Why this is here at all:** F4b-draft.md recommends setting the Ozone
platform explicitly and states "whether Wayland is default at all is disputed
inside Electron's own tracker." Electron's own `docs/breaking-changes.md` says
the opposite, directly: `ELECTRON_OZONE_PLATFORM_HINT` was removed as of
Electron 38.0, `--ozone-platform` now defaults to `auto`, and "Electron now
defaults to running as a native Wayland app when launched in a Wayland session
(when `XDG_SESSION_TYPE=wayland`)." This is not a disputed, need-to-force-it
situation — it is Electron's documented, current, automatic behavior, and
TRITIUM (Electron 43.4.0) is well past the version where this became default.
No `app.commandLine.appendSwitch` call, environment variable, or desktop-file
flag is needed for normal operation. Recorded here so this isn't "fixed" later
based on outdated advice.

**Confidence:** high — direct quote from Electron's own current documentation.

---

## 2. What must be verified by running it

Everything here needs the maker's actual niri + Noctalia session — nothing in
this list was run as part of this research.

1. **`niri --version`.** Expected-good: **25.01 or newer** (floating windows
   exist as a concept at all — needed for §1.2 to have any effect), ideally
   **25.11 or newer** (true per-window maximize; §4.3). Expected-bad: older
   than 25.01 — §1.2's fix has nothing to attach to until upgraded.

2. **`niri msg windows` after opening each form kind**, once §1.2 and §1.3 are
   in. Expected-good: form windows report as floating, with distinct titles
   visible. Expected-bad: form windows show as tiled columns, or titles are
   still identical.

3. **Launch the app repeatedly (20-30 cold starts) under real niri, before and
   after §1.1's fallback timer.** Expected-bad (before the fix): at least one
   launch where a window — main or a form — never appears, with nothing in
   `stderr`. Expected-good (after the fix): every window always appears, worst
   case slightly delayed on a run where the fallback timer is the one that
   fires. If a window still never appears even with the fallback in place, that
   points at something more specific than #48859 and needs its own follow-up.

4. **Open TRITIUM on a short output** — the maker's actual laptop panel if it
   is anywhere near 768px tall, or a virtual output configured to that height.
   Expected-bad, per §4.1/§4.16: the bottom portion of the 720px-tall window is
   rendered off-screen and unreachable by any niri scroll gesture — niri has no
   vertical scroll within an output. Expected-good: not observable on a
   1080px-tall or taller output — confirm the actual monitor is tall enough
   before treating this as resolved.

5. **Check for the exact `wayland_wp_color_manager.cc` errors from the dev log
   under a real niri session** (not this machine's KDE session, where they were
   presumably produced). Expected-good, per §4.10: the errors don't appear at
   all under niri, because niri's documentation is silent on the
   color-management protocol across every surface checked — consistent with
   niri not advertising it, in which case Chromium's color-manager client
   should never attempt the negotiation that fails. Expected-bad: the errors
   appear anyway — the "niri doesn't advertise this" inference would need
   revisiting. Supplement with `wayland-info` (if available) under the niri
   session to check directly whether a color-management protocol global is
   listed at all.

6. **Type â, î, û into a text field** (e.g. "kâğıt", "rüzgâr") under niri +
   Noctalia. Expected-good: the dead-key circumflex composes correctly.
   Expected-bad, matching electron/electron#46823 and #29345's documented
   symptom: wrong character, no diacritic, or a double character. Turkish's
   direct keys (ğ, ş, ç, ı, İ, ö, ü) are not at risk — only the circumflex
   dead-key path is (§4.12). If this reproduces, the documented (if drastic)
   workaround is forcing XWayland — `app.commandLine.appendSwitch('ozone-platform',
   'x11')`, or `XDG_SESSION_TYPE=x11` in the environment — which trades away
   native Wayland integration for the whole app and should only be considered
   if this specific check actually fails, not preemptively.

7. **Run TRITIUM at a fractional scale factor (1.25x or 1.5x) under niri** and
   inspect the monospace numeric tables at the pixel level. Expected-good, per
   §4.8: crisp text — both niri ("Fractional scaling: yes, plus all niri UI
   stays pixel-perfect," per its own README) and Chromium 150's unconditional
   `wp_fractional_scale_v1` support point this way. Expected-bad: visible blur,
   which would contradict both primary sources and warrant its own follow-up.

8. **Read the maker's actual `~/.config/niri/config.kdl` for the `gaps`
   line**, or whatever niri provides to print the effective config. §4.16's
   arithmetic uses niri's documented example value (`gaps 16`) because no
   confirmed compiled-in default could be sourced — the maker's real config may
   already override it, and that number decides how much of the 14px margin
   computed in §4.16 for a 1366×768 panel actually survives.

9. **Confirm the maker's actual screen resolution(s).** §4.16 computes both
   1920×1080 (safe) and 1366×768 (tight-to-failing) as illustrative cases —
   only the maker's real hardware settles which applies.

10. **Basic cursor check** — correct size, correct theme, at whatever scale
    factor the maker runs. No specific defect is sourced for this stack (§4.11),
    but it's commonly reported anecdotally for Electron-on-Wayland in general,
    so it's cheap to look at directly rather than assume.

---

## 3. What is out of the app's control

- **`electron/electron#48859` (the `ready-to-show` bug) is Chromium/Blink-side
  and currently open upstream.** Not fixable from TRITIUM's code — only
  mitigable, which §1.1 does.
- **niri's no-vertical-scroll behavior on a short output.** If the available
  output height (screen height minus panel minus gaps) is under 720px, the
  bottom of TRITIUM's window is inaccessible — this is how niri's
  scrollable-tiling model works by design (horizontal scroll only; oversized
  windows/popups are aligned top-left and the rest is off-screen — niri's own
  Design Principles document, §4.1). No window-rule and no app-side code change
  creates vertical scroll room that isn't there. The only real levers are the
  maker's screen choice, Noctalia's bar height/visibility, and niri's gap
  settings — none of them this codebase's.
- **niri's compiled-in default gap value.** Not confirmed from documentation
  (niri's docs show `gaps 16` as an illustrative example, not stated as the
  built-in default). Whatever it actually is, and whatever the maker's own
  config sets, is their niri config, not TRITIUM's.
- **Noctalia's bar height and exclusive zone.** Documented default is 34px,
  top, reservation on by default (§4.16) — configurable in Noctalia itself, not
  in TRITIUM.
- **Decoration mode is negotiated automatically by Chromium, per-compositor, at
  runtime** — `ShouldUseCustomFrame()` returns true (draw CSD) only when the
  compositor does not advertise `xdg_decoration_manager_v1` at all (§4.7). niri
  does advertise xdg-decoration (§4.2), so TRITIUM's existing, unmodified
  `frame: true` default should already receive genuine compositor-drawn
  decorations under niri — validating the constitution's "the compositor draws
  the decorations" as written, for this specific compositor. The same is not
  true under GNOME (confirmed via a corroborating Electron issue, §4.7) — but
  that's not the maker's platform. No code change indicated; this is recorded
  as a checked assumption, not a fix.
- **The color-manager negotiation failure and its fallback.** A
  Chromium-vs-compositor protocol-support gap (§4.10), not an app-fixable item
  — and per the evidence gathered, not one that needs fixing, since it does not
  appear to affect rendered color for standard sRGB content.
- **Dead-key/compose handling on native Wayland** (electron/electron#46823,
  #29345) — open, cross-app Chromium/Electron-family issues, not fixable from
  TRITIUM's own code beyond the documented XWayland escape hatch, which is a
  whole-app trade-off, not a targeted fix.
- **GPU-acceleration blocklist entries and exact software-rendering fallback
  triggers** for this Wayland/Ozone stack — not determined this session (§5),
  compositor/driver territory regardless.
- **The window-rule in §1.4** is the concrete, cheap mitigation available for
  the floating/sizing items above — already written out, ready to hand to the
  maker once §1.2/§1.3 land.

---

## 4. Findings in detail

### 4.1 Minimum size under niri's column model

- **[VERIFIED]** niri design principle: "Opening a new window should not affect
  the sizes of any existing windows." —
  `raw.githubusercontent.com/YaLTeR/niri/main/docs/wiki/Development:-Design-Principles.md`
- **[VERIFIED]** "If a window or popup is larger than the screen, it should be
  aligned in the top left corner." — same source.
- **[VERIFIED]** niri's README: windows wider or taller than the monitor
  "simply extend beyond the visible area — you scroll horizontally to bring
  hidden portions into view" — scrolling is explicitly horizontal. —
  `raw.githubusercontent.com/YaLTeR/niri/main/README.md`
- **[VERIFIED]** On window-rule size clamps (`min-width`/`max-width`/etc.):
  "Keep in mind that the window itself always has a final say in its size." —
  `raw.githubusercontent.com/YaLTeR/niri/main/docs/wiki/Configuration:-Window-Rules.md`
- **[INFERRED]**, from the above plus standard `xdg_toplevel` semantics: a
  compositor's `configure` event is a size *suggestion*; the client commits
  whatever size it chooses. Electron enforces `minWidth`/`minHeight`
  internally (TRITIUM sets both to 1280×720 on the main window,
  `src/main/windows.ts`), so it will commit at least that size regardless of
  what column width niri proposed.
- **[INFERRED]**, combining the above: **width** overflow is handled
  gracefully — if niri would have given a narrower column, the window commits
  at 1280 anyway, the column becomes that wide, and the user scrolls
  horizontally to see what's beside it. No clipping, no reflow break.
  **Height** is different, because niri's scrolling is horizontal-only. If the
  available output height is under 720px, the window still commits at 720 (its
  stated minimum), is aligned top-left per niri's own design principle, and the
  portion below the available height is rendered **off-screen and unreachable
  by any niri scroll gesture** — not clipped inside the app, not scrollable,
  just not visible. This is the real risk for TRITIUM's fixed 720px minimum
  height, and it is a compositor behavior, not an app bug (§3). See §4.16 for
  whether this is realistic on the maker's actual screen.
- **[INFERRED]**, separately and more speculatively: TRITIUM's own `body {
  overflow: hidden }` (`src/renderer/styles/base.css`) has no scroll fallback
  at all. This only matters if something can force Chromium's actually
  committed viewport under 720px height on Wayland — distinct from the
  "off-screen bottom" case above, where the window genuinely is 720px tall but
  partly outside the visible output. Nothing found in this research (§4.6–4.13)
  points at Chromium ever being forced below a declared `minHeight` on
  Wayland — treat this as a smaller, unconfirmed, conditional hazard layered on
  top of the primary one above, not the same failure mode.
- **[VERIFIED]** Floating windows (a niri 25.01+ feature) form a separate
  per-workspace layer that "does not scroll" —
  `github.com/YaLTeR/niri/wiki/Floating-Windows`. TRITIUM's main window is
  never parented, so it will not auto-float under niri's own heuristic (§4.5)
  — it always tiles, so the height-overflow risk above applies to it
  specifically, not to the form windows (which, once §1.2 lands, float and are
  governed by different, app-controllable sizing).

### 4.2 Server-side decorations

- **[VERIFIED]** niri implements the xdg-decoration protocol. The
  `prefer-no-csd` config setting "requests that applications omit client-side
  decorations... applications that negotiate server-side decorations through
  the xdg-decoration protocol will have focus ring and border drawn around them
  without a solid colored background." — `github.com/YaLTeR/niri/wiki/Configuration:-Miscellaneous`
- **[VERIFIED]** "Unlike most other options, changing `prefer-no-csd` will not
  entirely affect already running applications" — a restart is needed after
  toggling it. Same source.
- **[VERIFIED]** Even with `prefer-no-csd` set, a client that insists on CSD
  anyway still gets a compositor-drawn focus ring/border around its own
  self-drawn frame — the concrete mechanism by which double decoration
  (compositor border/ring plus the app's own CSD) becomes visible under niri.
  — `raw.githubusercontent.com/YaLTeR/niri/main/docs/wiki/FAQ.md`
- **[REPORTED — negative result]** No niri issue specifically reporting
  double-decoration with an Electron app was found in a search of niri's own
  issue tracker. Absence of evidence, not evidence of absence — though §4.7
  makes this largely moot for TRITIUM specifically: Electron requests SSD by
  default and niri supplies it, so Electron shouldn't be drawing CSD under niri
  at all in the first place.
- **[VERIFIED — negative result]** niri's `Application-Issues.md` wiki page,
  which documents known per-application Wayland quirks, has no Electron-specific
  decoration section as of this fetch (it documents an unrelated GTK3/Waybar
  rounded-corner artifact). — same repo, `docs/wiki/Application-Issues.md`

### 4.3 Maximize

- **[VERIFIED]** niri v25.11 (released 2025-11-29) added "true Wayland
  maximize... the normal 'maximize button next to the X button' or
  'double-click on the titlebar' maximize" — distinct from the older
  `maximize-column` (default `Mod+F`), which sets the focused column to full
  width but keeps gaps, borders, and panels visible. —
  `github.com/YaLTeR/niri/releases` and `github.com/YaLTeR/niri/wiki/Fullscreen-and-Maximize`
- **[VERIFIED]** Windows are "aware of their maximized-to-edges status."
  Window-rules like `open-maximized-to-edges` / `open-fullscreen` are only
  effective at the client's *initial* configure — a maximize request the user
  triggers later is not interceptable by those rules. Same source.
- **[VERIFIED]** `open-fullscreen true` is also documented, and can be set
  `false` to *prevent* a window from opening fullscreen — checked directly on
  the Window Rules wiki page. Relevant to XTRITIUM §7's "per-chart fullscreen
  button": whatever DOM element requests browser fullscreen for a chart, niri
  has first-class support for the resulting `xdg_toplevel` fullscreen state,
  including a way for the maker to override it via window-rule if it ever needs
  tuning.
- **[INFERRED]** Electron's `win.maximize()` sends `xdg_toplevel.set_maximized`.
  On niri ≥25.11 this should trigger real per-window maximize-to-edges unless a
  window-rule blocks it. What happened to the same request on niri <25.11
  (which had no true per-window maximize concept) is not documented in what
  could be fetched — most likely a no-op, not confirmed.
- **[INFERRED]** Persisted/restored window geometry is of limited value under
  niri's tiled placement — column width is governed by niri's own layout logic
  (`default-column-width`, interactive resize), not by whatever size the app
  last saved. It matters more for floating windows, where
  `default-floating-position` and size are set niri-side via window-rule, again
  not by the app restoring a remembered geometry. TRITIUM already does not
  persist window geometry (`src/main/index.ts`'s top comment states this
  explicitly: "no tray, no autostart, no remembered geometry") — this finding
  validates that existing decision rather than asking for a change.
- **Action for the maker:** check `niri --version` (§2, item 1). Maximize
  semantics are only predictable at ≥25.11; floating windows (needed for §1.2)
  require ≥25.01 at minimum.

### 4.4 Window rules

- **[VERIFIED]** Full syntax, from
  `raw.githubusercontent.com/YaLTeR/niri/main/docs/wiki/Configuration:-Window-Rules.md`:
  - Matching: `match app-id="..."` and `match title="..."` are regexes matched
    anywhere in the string; raw KDL strings are recommended for patterns with
    special characters, e.g. `match app-id=r#"^org\.telegram\.desktop$"#`.
    Additional predicates: `is-floating`, `is-window-cast-target`, `is-active`,
    `is-focused`, `is-active-in-column`, `is-urgent`, `at-startup`. Multiple
    matchers inside one `match` block are ANDed; multiple `match` blocks on one
    rule are ORed.
  - Sizing: `min-width`/`max-width`/`min-height`/`max-height` are config-side
    clamps in logical pixels — but "the window itself always has a final say
    in its size" (§4.1).
  - `default-column-width { fixed 1200; }` or `{ proportion 0.75; }` —
    documented as working for floating windows too, "despite the word
    'column.'"
  - `default-window-height`, same syntax.
  - `open-floating true|false`, `open-maximized true`, `open-fullscreen
    true|false`, `default-floating-position x=32 y=32
    relative-to="bottom-left"`.
- **[VERIFIED]** niri issue #3895: a rule matching only on `app-id` sizes
  *every* window sharing that app-id identically, including dialogs/file
  pickers/preferences windows — closed, no visible maintainer resolution in
  what could be fetched. — `github.com/YaLTeR/niri/issues/3895`
- **[INFERRED]**, concrete to this codebase: TRITIUM currently has one shared,
  unconfigured app-id (defaults to Electron's own, not a TRITIUM-specific one —
  confirmed by the absence of any electron-builder config in the repository)
  and one shared static title ("TRITIUM", `src/renderer/index.html`) across the
  main window and all four form kinds. Combined with #3895's behavior, no niri
  window-rule can currently single out the main window from a form window, or
  one form kind from another. §1.3 and §1.4 are the fix and the resulting rule.

### 4.5 Floating vs. tiled for secondary windows

The single highest-value finding in the niri-specific research.

- **[VERIFIED]**, direct quote: "New windows automatically float if they meet
  either condition: They have a parent window (e.g., dialogs); They possess
  fixed dimensions (e.g., splash screens)." —
  `github.com/YaLTeR/niri/wiki/Floating-Windows`
- **[VERIFIED]** `open-floating true|false` as a window-rule can force either
  state regardless of the automatic heuristic above.
- **[INFERRED]**, concrete to this codebase: TRITIUM's `currency` form sets
  both `parent` and `modal: true` (`src/main/windows.ts`) — satisfies the "has
  a parent" condition, so it already auto-floats under niri as the code stands
  today. The `vehicle`, `fuel-quick`, and `fuel` forms are built as plain `new
  BrowserWindow({...size, show: false, autoHideMenuBar: true,
  webPreferences})` with no `parent` and no `resizable: false` — they satisfy
  **neither** auto-float condition, and will tile like an ordinary window. This
  directly contradicts the constitution's own description of forms as movable,
  non-anchored, draggable-outside-the-main-window popups. §1.2 is the fix: a
  small change, already threading the `mainWindow` reference that is currently
  received and discarded.
- Floating windows as a concept require niri ≥25.01 (§4.3) — on an older niri,
  none of this applies because there is no floating layer at all.

### 4.6 Ozone platform selection

- **[VERIFIED]**, direct quote, Electron's own `docs/breaking-changes.md`:
  "Removed: `ELECTRON_OZONE_PLATFORM_HINT` environment variable... The default
  value of the `--ozone-platform` flag changed to `auto`. Electron now defaults
  to running as a native Wayland app when launched in a Wayland session (when
  `XDG_SESSION_TYPE=wayland`). Users can force XWayland by passing
  `--ozone-platform=x11`." This was a Planned Breaking Change for Electron
  38.0. — `raw.githubusercontent.com/electron/electron/main/docs/breaking-changes.md`
- **[VERIFIED — negative result]** Neither `ozone-platform`,
  `ozone-platform-hint`, nor `wayland` appear in Electron's own
  `docs/api/command-line-switches.md` or `docs/api/environment-variables.md`
  (both fetched in full) — these are Chromium-level switches Electron doesn't
  separately document. `app.commandLine.appendSwitch('ozone-platform', 'x11')`
  is the supported manual override path, if one is ever needed (e.g. as the
  XCompose workaround in §4.12).
- **Reconciliation with F4b-draft.md:** the draft's claim that the env var is a
  "silent no-op... disputed inside Electron's own tracker... set it explicitly
  rather than trusting auto-detection" is superseded by the above. The removal
  is a formal, documented breaking change, not merely a silent no-op, and
  Electron's own current docs describe automatic detection as settled behavior,
  not disputed. No code action needed (§1.6).

### 4.7 Decoration: what Electron actually does on Wayland

- **[VERIFIED]**, from Chromium source
  (`ui/ozone/platform/wayland/ozone_platform_wayland.cc`, read via
  `chromium.googlesource.com`): `ShouldUseCustomFrame()` returns
  `connection_->xdg_decoration_manager_v1() == nullptr`; comment: "Server-side
  decorations on Wayland require support of xdg-decoration or some other
  protocol extensions... Whether the environment has any support only gets
  known at run time, so we use the custom frame by default." Electron requests
  SSD and only falls back to drawing its own frame (CSD) when the compositor
  doesn't advertise xdg-decoration at all.
- **[VERIFIED]**, from `ui/ozone/platform/wayland/host/wayland_toplevel_window.cc`:
  `OnDecorationModeChanged()` sets server-side decoration when
  `use_native_frame_` is true and the compositor's `xdg_decoration_manager_v1`
  is present, client-side otherwise — decoration mode is negotiated
  automatically, per-compositor, at runtime; not a static or flag-gated choice.
- **[VERIFIED — negative result]** No `WaylandWindowDecorations`-style feature
  flag exists in `ui/base/ui_base_features.cc` (only `kWaylandTextInputV3`,
  `kWaylandSessionManagement`, `kWaylandExternalBeginFrameSource` appear under
  Ozone). **[INFERRED]** The `--enable-features=WaylandWindowDecorations` flag
  referenced in older forum discussion is obsolete — decoration mode is
  automatic now, not flag-gated, in Chromium 150.
- **[VERIFIED]** `electron/electron#45834` (closed) — reporter's own diagnosis
  for a GNOME-specific symptom (missing resize-cursor affordance at a window
  edge): "GNOME Mutter enforces client-side decorations (CSD) rather than
  server-side... KDE remains unaffected due to its server-side decoration
  support." Corroborates that decoration behavior genuinely varies by
  compositor, consistent with the automatic-negotiation mechanism above.
- **Cross-reference with niri (§4.2):** niri implements xdg-decoration and
  negotiates SSD for a client that accepts it. Combining both sides: TRITIUM's
  existing, unmodified `frame: true` default should receive genuine
  compositor-drawn decorations under niri specifically — satisfying the
  constitution's "the compositor draws the decorations" as written, for this
  compositor. This would not hold under GNOME (per #45834 above). No code
  change needed; recorded because it validates an existing assumption rather
  than leaving it unchecked (§3).
- Double-decoration search: no `electron/electron` issue found reporting
  compositor border/shadow stacking with Electron's own CSD frame. Not ruled
  out, not confirmed — and largely moot for niri specifically, since Electron
  won't be drawing CSD there unless niri stops advertising xdg-decoration.

### 4.8 Fractional scaling

- **[VERIFIED]**, from Chromium source
  (`ui/ozone/platform/wayland/host/wayland_surface.cc`): requests a
  `fractional_scale_v1` object
  (`wp_fractional_scale_manager_v1_get_fractional_scale`), processes the
  compositor's preferred-scale callback (divided by 120 per protocol spec),
  calls `UpdateWindowScale()`. Chromium 150's Wayland backend implements
  `wp_fractional_scale_v1` client-side, unconditionally — not behind a flag.
- **[VERIFIED]** Fallback when the protocol is unavailable rounds **up** to the
  next integer `wl_surface.set_buffer_scale`
  (`wl::ClampScale(std::ceil(state.buffer_scale_float))`) — standard Wayland
  behavior, not an Electron-specific defect.
- **[VERIFIED]**, direct quote from niri's own README: "Fractional scaling:
  yes, plus all niri UI stays pixel-perfect." —
  `raw.githubusercontent.com/YaLTeR/niri/main/README.md`
- Combined: both sides of the fractional-scaling pipeline are implemented and
  current. Low risk for TRITIUM specifically — no code action indicated. Worth
  a direct visual check regardless (§2, item 7), given how central crisp
  monospace numeric rendering is to the app.

### 4.9 Font rendering — issue #47502, fontconfig, local TTF

- **[VERIFIED]**, fetched directly via GitHub's API — **this corrects
  F4b-draft.md**: `electron/electron#47502` is **closed**, `state_reason:
  completed`, filed 2025-06-18, **closed 2025-06-20** — two days later, not
  "no maintainer response." Reporter's environment: Arch Linux, **GNOME on
  Wayland** (the draft's "GNOME" detail is accurate). Root cause, from the
  reporter's own final comment: a third-party GNOME Shell extension, "rounded
  window corners reborn," was adding rounded corners to windows that didn't
  have any; disabling the extension resolved the issue entirely. Maintainer's
  reply: "Glad you found the root cause." This was never an Electron,
  Chromium, or Wayland-protocol defect — it was a GNOME Shell extension on one
  reporter's machine. It has no bearing on niri (no GNOME Shell, no such
  extension ecosystem exists there) or on TRITIUM generally.
  F4b-draft.md's framing ("no maintainer response," implying an open
  regression that "must be looked at, not assumed") is superseded by this;
  restate to whoever maintains that document.
- **[INFERRED]**, well-established, not freshly re-sourced this session:
  Chromium/Electron on Linux resolves fonts via fontconfig regardless of
  Wayland vs. X11 — long-standing Chromium behavior.
- **Gap, not a finding:** no Chromium or Electron issue specific to a locally
  vendored TTF loaded via `@font-face` over `file://` (TRITIUM's actual setup
  — `src/renderer/styles/base.css` loads `CaskaydiaCoveNerdFontMono-*.ttf` by
  relative path, which resolves to `file://` via `loadFile()` in production)
  was found, positive or negative. No evidence of a defect; also no explicit
  confirmation of parity with a system-installed font. See §5.

### 4.10 The `wayland_wp_color_manager.cc` errors — the color question

- **[VERIFIED]**, from Chromium source
  (`ui/ozone/platform/wayland/host/wayland_wp_color_manager.cc`, read via
  `chromium.googlesource.com`): the class wraps the Wayland global
  `wp_color_manager_v1` — the `color-management-v1` staging protocol.
  `PopulateDescriptionCreator()`: if the requested color space's transfer
  function isn't in the supported set, and the compositor lacks the
  `SET_TF_POWER` feature, it logs exactly "Unable to set image transfer
  function." and returns `false`. The caller, `GetImageDescription()`, on that
  `false` result logs "Failed to populate image description for color space
  ..." and runs a `cleanup()` path that resolves all pending callbacks with
  `nullptr`, erases the pending entries, and returns early.
- **[INFERRED]**, source-grounded: the color space named in the log —
  `{primaries:BT709, transfer:SRGB, matrix:RGB, range:FULL}` — is plain,
  ordinary SDR sRGB. This is Chromium attempting an optional, more precise
  color-management negotiation (a protocol most compositors implement only
  partially, if at all, for ordinary SDR content), failing that negotiation
  against this particular compositor, and the surface proceeding without an
  explicit Wayland color-managed image description — which is how the
  overwhelming majority of Wayland clients render today, since untagged
  buffers are conventionally treated as sRGB by compositors regardless. No
  Chromium or Electron issue thread was found describing this error string as
  causing visible color inaccuracy. Given the source-level fallback path, this
  reads as harmless log noise for standard SDR content, not a color-accuracy
  defect — but this is inference from reading the fallback code, not a
  maintainer's explicit confirmation, and should be held at that confidence
  level, not overstated.
- **[VERIFIED — negative result]** niri's documentation is silent on any
  Wayland color-management protocol across every relevant surface checked:
  Outputs config (only plain hex `background-color`/`backdrop-color`, no
  color-management pipeline), Layout config, Miscellaneous config, FAQ, and
  GitHub Releases notes. niri has no `CHANGELOG.md` in its repository
  (confirmed via GitHub API — 404); Releases were checked instead, none
  mention color management.
- **[REPORTED — found nothing conclusive]** Two niri issues surfaced when
  searching for "color-management": #1533 (closed, a monitor bit-depth config
  enhancement) and #1197 (open, external-display background color wrong after
  suspend, tagged `area:visuals`/`area:session`) — neither confirms nor denies
  `wp_color_manager_v1` support.
- **[INFERRED]**, combining the above: niri most likely does not currently
  implement or advertise `wp_color_manager_v1`. Not a proven negative — niri's
  Rust source could not be searched directly (GitHub code search required
  authenticated access this session did not have).
- **Compositor attribution:** the errors in the task's dev log were captured on
  a machine whose actual session is confirmed KDE Plasma/KWin
  (`XDG_CURRENT_DESKTOP=KDE`, checked locally), not niri. Combined with niri's
  documentation silence above, both independent lines of evidence — Chromium
  source on one side, niri documentation on the other — point the same way: if
  niri never advertises this protocol, Chromium's color-manager client should
  never attempt the negotiation that fails, and the error should not appear
  under niri at all. Reasonably solid, but not yet empirically confirmed under
  an actual niri session (§2, item 5).
- **Net, for an app whose design rests on eleven contrast-tuned palettes:**
  this does not appear to be a color-accuracy defect. It's a failed attempt at
  an optional protocol-level refinement, with rendering falling back to
  standard, correct sRGB. Nothing to fix in TRITIUM's code either way.

### 4.11 Cursor

- **[VERIFIED]** `electron/electron#45344`, a Hyprland cursor-rendering issue,
  closed/self-resolved — narrow repro tied to pointer-lock state leaking from
  another app after alt-tab. Not applicable: TRITIUM never uses pointer-lock
  APIs.
- **[VERIFIED]** `electron/electron#45834` (also covered in §4.7) is nominally
  about a missing resize-cursor affordance at a window edge, but it's a
  symptom of GNOME Mutter's CSD enforcement, not a cursor-theme or HiDPI
  defect in its own right.
- **Gap:** no primary-source Electron issue specific to cursor theme not being
  picked up, or wrong cursor size at fractional/HiDPI scale, was found this
  session. Anecdotally one of the most commonly reported general
  Linux/Electron/Wayland complaints, but nothing citable turned up to confirm
  a specific, current defect. See §5; verify directly instead (§2, item 10).

### 4.12 Input — Turkish text and dead keys, not IME

- **[VERIFIED]** `electron/electron#46823`, "Electron not respecting
  diacritics and/or keyboard input method in Wayland sessions" — closed,
  `state_reason: not_planned`, auto-closed by a triage/stale bot rather than
  resolved by a maintainer ruling. Filed 2025-04-27, last updated 2025-11-30.
  Documents dead-key sequences composing incorrectly (example given: `'+m`
  should produce literal `'m`, instead silently composes to `ḿ`), reproduced
  across multiple unrelated Electron-family apps (Discord, Spotify, Obsidian,
  1Password, Vivaldi) on Wayland — a cross-app Chromium/Electron symptom, not
  specific to any one app.
- **[VERIFIED]** `electron/electron#29345`, "Electron ignores XCompose
  settings when running natively on Wayland" — closed `not_planned`/stale,
  filed 2021-05-26, still receiving updates as recently as 2026-01-02.
  Reporter's own finding: XCompose behaves correctly when Electron is forced
  to run without native Wayland (`--ozone-platform=x11`) — forcing XWayland is
  a documented, working escape hatch for this whole class of bug.
- **[VERIFIED — negative result]** `--enable-wayland-ime` does not appear
  anywhere in Electron's `electron_main_delegate.cc` or
  `ozone_platform_wayland.cc` source (both searched directly) under that exact
  name. IME (composition-window input, relevant to CJK-style entry) and
  dead-key/compose handling are different Chromium code paths — the flag some
  forum posts reference is not what governs the dead-key behavior above, and
  wouldn't be expected to fix it even if some differently-named equivalent
  exists.
- **[INFERRED]**, precisely scoped: Turkish's dotted/dotless I, ğ, ş, ç, ö, ü
  are direct keys on the Turkish-Q xkb layout — not composed, not IME, not
  implicated by either bug above. Only the circumflex dead-key combinations —
  â, î, û, used in a shrinking set of words (*kâğıt*, *rüzgâr*) — route through
  the same dead-key/compose machinery documented as broken in #46823/#29345,
  and are the actual, specific, sourced risk for a Turkish-language interface.
  Much narrower and more precise than "Turkish needs IME support," which is
  not the case at all — verify directly (§2, item 6) rather than build around
  a hypothetical.

### 4.13 Rendering performance

- **[VERIFIED]**, from `wayland_surface.cc`: explicit sync via
  `linux-drm-syncobj`
  (`wp_linux_drm_syncobj_surface_v1_set_acquire_point`/`set_release_point`) is
  used when the compositor's `linux_drm_syncobj_manager_v1` is present; falls
  back silently (`NOTIMPLEMENTED_LOG_ONCE`, returns `false`, normal implicit
  sync continues) when absent. Not a defect either way.
- **[VERIFIED — negative result]** No `wp_tearing_control_v1` implementation
  exists anywhere in Chromium's `ui/ozone/platform/wayland/host/` directory.
  **[INFERRED]** Irrelevant to TRITIUM regardless — that protocol targets
  latency-sensitive full-screen content (games), not a data-entry desktop app
  with no fullscreen video/game loop.
- **[INFERRED]**, not independently verified this session: given Ozone/Wayland
  auto-detection is Electron's unconditional default as of v38 (§4.6), the
  older `--enable-features=UseOzonePlatform` flag — from the years before
  Ozone was default — is very likely a no-op today on Electron 43. Not
  separately confirmed by a dedicated source.
- **Gap:** specific GPU-acceleration blocklist entries and exact
  software-rendering-fallback trigger conditions for this stack were not found
  this session. See §5.

### 4.14 What Noctalia is

- **[VERIFIED]** Noctalia is a native Wayland desktop shell — bars, widgets,
  dock, launcher, control center, notifications, wallpaper, lock screen,
  clipboard history, on-screen displays — "built directly on Wayland and
  OpenGL ES with no Qt or GTK dependency." — `github.com/noctalia-dev/noctalia-shell`
- **[VERIFIED]** **The premise that Noctalia is Quickshell-based is stale.**
  Noctalia's own docs state "v4 (Quickshell) is no longer maintained" — the
  current line was rewritten off Quickshell/QML/Qt entirely. —
  `docs.noctalia.dev`
- **[VERIFIED]** Confirmed by its build dependencies: meson, gcc/clang,
  wayland, wayland-protocols, libglvnd, cairo, pango, harfbuzz, freetype2,
  fontconfig, libxkbcommon, glib2, libsecret, libsodium, pipewire, wireplumber,
  polkit, pam — no Qt, no GTK, no QML anywhere in the list. —
  `raw.githubusercontent.com/noctalia-dev/noctalia-shell/main/BUILDING.md`
- **[VERIFIED]** Noctalia is **not niri-exclusive**: "Current compositor
  integrations include Niri, Hyprland, Sway, Scroll, Mango, Labwc, Triad, dwl,
  and other compatible Wayland compositors." — same `BUILDING.md`.
- **[VERIFIED]** Noctalia's cross-app theming mechanism is file-template
  rendering, not a live system push: "Noctalia can render the resolved theme
  colors into external app config files whenever the palette changes. This
  lets terminals, editors, browsers, launchers, and other apps follow the same
  colors as the shell," via user-configured `input_path`/`output_path` pairs
  targeting each app's own config file. — `docs.noctalia.dev/noctalia/theming/app-theming/`
- **[INFERRED]** Consequence for TRITIUM: Noctalia cannot silently push a
  color scheme into it. Doing so would require a hand-written template
  targeting a TRITIUM-specific config file, and there is no conventional
  external theme file for an Electron app the way there is for a terminal or
  GTK app — this channel does not apply here. No evidence was found of
  Noctalia setting `GTK_THEME`/`QT_QPA_PLATFORMTHEME` or writing a GTK
  `settings.ini`; treat this as a documentation-silence result, not a proven
  negative — its source tree was not directly searchable without
  authentication this session.

### 4.15 The color-scheme portal preference

- **[VERIFIED — negative result]** Noctalia's docs do not mention
  `xdg-desktop-portal`, `org.freedesktop.appearance`, or
  `org.freedesktop.impl.portal.Settings` anywhere on its installation page or
  either of its two theming pages. —
  `docs.noctalia.dev/noctalia/getting-started/installation/`,
  `docs.noctalia.dev/noctalia/theming/`, `docs.noctalia.dev/noctalia/theming/app-theming/`
- **[INFERRED]** Whether the `color-scheme` (light/dark) portal preference is
  actually served on a real niri+Noctalia desktop depends on whether some
  separate component implements `org.freedesktop.impl.portal.Settings` — niri
  itself ships no portal implementation of its own (background knowledge,
  not independently primary-sourced in this pass; flagged in §5). If nothing
  on the maker's system implements that portal interface, the preference
  isn't merely ignored by TRITIUM — nothing is broadcasting it, which makes
  the practical risk smaller than on a full GNOME or KDE session, though not
  something to rely on (a user could install `xdg-desktop-portal-gtk` or
  similar independently).
- **[VERIFIED]** Electron's own `docs/api/native-theme.md`: `themeSource` "can
  be `system`, `light` or `dark`. It is used to override and supersede the
  value that Chromium has chosen to use internally." Setting it makes
  `nativeTheme.shouldUseDarkColors` reflect that value **and** makes the
  `prefers-color-scheme` CSS query in the renderer match it. Default is
  `system`.
- **[VERIFIED, locally]** Zero matches for `prefers-color-scheme` or
  `nativeTheme` anywhere in `src/` (direct search of the source tree). The
  app's own palette CSS is already fully isolated from the OS/portal
  color-scheme signal by omission.
- **[INFERRED]** The isolation above is not complete: with `themeSource` left
  at its default `'system'`, Chromium's own default UA stylesheet for native,
  unstyled form controls (checkboxes, `<select>`, any scrollbar chrome the app
  doesn't explicitly restyle) still resolves `prefers-color-scheme` from
  whatever the live OS/portal signal reports — independent of the app's own
  CSS. This works today only because no such unstyled native control is
  currently visible; it is incidental, not guaranteed. §1.5 is the fix, and it
  is worth doing regardless of whether anything on the maker's system actually
  serves the portal preference today — it makes the decoupling deliberate
  rather than accidental.

### 4.16 Screen arithmetic

- **[VERIFIED]** Noctalia's default bar: thickness **34px**, position **top**
  (`position = "top"`), reserves a compositor exclusive zone via layer-shell
  by default (`reserve_space`, documented default `true`) — "the compositor
  exclusive zone grows so tiled and maximized windows stop further away" when
  additional margin settings are used. — `docs.noctalia.dev/noctalia/bar/`
- **[VERIFIED]** No other Noctalia layer-shell surface (notifications,
  launcher, wallpaper/backdrop) is documented as reserving exclusive space or
  overlapping normal window content areas on the pages fetched —
  wallpaper/backdrop is positioned via `layer-rule`, separately from the bar's
  exclusive zone.
- **[VERIFIED, hedged]** niri's `gaps` setting: "Set gaps around (inside and
  outside) windows in logical pixels," illustrated in the docs with `gaps
  16`. This is the documentation's **example value, not a confirmed
  compiled-in default** — niri's docs don't state what applies if the line is
  omitted. Treat 16px as "the number niri's own docs illustrate with," and get
  the maker's actual value from their `config.kdl` (§2, item 8) before relying
  on it.
- **Arithmetic, 1920×1080:** 1080 − 34 (bar) = **1046px** available before
  gaps. Even a generous gap allowance leaves well over 720px. **Safe**, by a
  wide margin.
- **Arithmetic, 1366×768** (a common small/older laptop panel, not an exotic
  case): 768 − 34 (bar) = **734px** available **before any gap is subtracted
  at all** — only **14px** of margin over the 720px minimum. Any nonzero gap
  value — the documented example of 16px alone, or any smaller real value —
  erases that margin entirely and pushes the available height under 720px.
  **This is not safe.** It connects directly to §4.1: on a panel in this size
  class, with a Noctalia top bar and any gap at all, TRITIUM's main window is
  a realistic candidate for having its bottom edge pushed below the visible
  output — not clipped inside the app, but genuinely unreachable, because
  niri has no vertical scroll. Whether this actually applies depends entirely
  on the maker's real screen (§2, item 9) — presented here as a real risk on a
  plausible panel size, not a hypothetical one, and not something the app can
  code its way around given the constitution fixes the minimum at 1280×720.

---

## 5. What I could not determine

- **Nothing in this report was run under real niri or Noctalia.** This machine
  runs KDE Plasma; niri and Noctalia are both absent from it. Every niri- and
  Noctalia-specific claim is doc- or source-sourced, not observed. §2 is the
  list of what changes that.
- **niri's actual compiled-in default gap value.** Only an illustrative
  example (`gaps 16`) was found in the documentation surfaces checked; whether
  that is also the built-in default when the setting is omitted was not
  confirmed.
- **Whether niri's Rust source implements or advertises any Wayland
  color-management protocol.** The conclusion in §4.10 that it likely does not
  rests on silence across every documentation surface checked — not on a
  source-code read. GitHub's code search required authenticated access this
  session did not have.
- **Whether niri ships or requires a separate `xdg-desktop-portal` backend,
  and which one is conventional in a niri+Noctalia setup.** Not independently
  primary-sourced in this pass (§4.15) — stated as background knowledge,
  flagged rather than presented as verified.
- **Whether Noctalia sets any GTK/Qt environment variables or writes a GTK
  `settings.ini`** that could reach an Electron app through a channel other
  than its documented template-rendering mechanism. Not proven absent —
  Noctalia's source tree was not directly searchable this session.
- **The upstream Chromium tracker issue for `electron/electron#48859`**
  (`issues.chromium.org/issues/479458083`, referenced by a commenter on the
  Electron issue) could not be independently fetched — it sits behind
  authentication this session did not have. That specific attribution (traced
  to `DidMeaningfulLayout` in Blink) stays at REPORTED, relayed via a verified
  GitHub comment, not independently confirmed at the source.
- **Whether double decoration (compositor border/shadow plus Electron's own
  CSD) has ever been reported for Electron specifically**, under any
  compositor. Searched, nothing surfaced. Not ruled out, and moot for niri
  specifically per §4.7's finding that Electron shouldn't be drawing CSD there
  in the first place.
- **Cursor theme/size behavior specifically under niri or under Noctalia.** No
  primary-source defect found either way (§4.11) — genuinely unresolved, not
  quietly assumed fine.
- **GPU-acceleration blocklist entries and exact software-rendering-fallback
  trigger conditions** for Electron 43 / Chromium 150 on this Wayland/Ozone
  stack. Not found this session.
- **Rendering parity between the vendored `file://`-loaded TTF and a
  system-installed equivalent.** No defect found, no explicit confirmation of
  parity either — a genuine gap, not a quiet assumption.
- **The maker's actual niri version and actual screen resolution(s).** Both
  materially change which findings in this report apply (§4.1, §4.3, §4.5,
  §4.16) — neither is known without asking or running the checks in §2.
