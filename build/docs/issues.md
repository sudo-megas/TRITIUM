# TRITIUM — ISSUES

Repo path of this file: `~/REPO/build/docs/issues.md`
Governing document: `~/REPO/XTRITIUM.md`.

Every defect found in TRITIUM, and what became of it. One entry per issue, newest
milestone last. A defect is recorded here whether it was introduced by the
milestone that found it, inherited from an earlier one, or was never a defect in
the code at all but a claim in a document that turned out to be false.

Three things are deliberately in scope and might not be expected:

- **Defects in the tests themselves.** A test that passes for the wrong reason is
  worse than no test, because it is counted as cover.
- **Defects in the documents.** XTRITIUM and the F-documents govern the code, so
  a wrong sentence in one is a live defect until it is corrected.
- **Things found by measuring something that had only been reasoned about.**

Status is one of **FIXED** (with the milestone that fixed it), **OPEN**, or
**ACCEPTED** (understood, deliberately not changed, with the reason).

---

## Open

**Nothing is open.** Both entries below were closed where they stand rather than
moved, so the numbering still reads in order and the account of how long each one
took is not lost by filing it under a happier heading. I-09 closed in F12, I-10
after F14.

### I-09 · `prettier --check` failed across the repository
**Status: FIXED in F12** · found F7 · pre-existing, not introduced

`npx prettier --check .` reports style differences in **40 files**, including
many never touched by F5–F7 — `XTRITIUM.md`, `src/shared/scaled.ts`,
`tests/e2e/harness.ts`, `src/renderer/state/settings.ts` among them.

Prettier is **not a gate**: `package.json` wires it only as `format`
(`prettier --write .`), and neither `npm run build` nor `npm test` invokes it.
The codebase is hand-formatted in a style close to, but not identical with, what
`.prettierrc.json` would produce.

It was left alone through F7–F11 because running `prettier --write .` would have
rewritten forty files at once, most for reasons unrelated to any milestone, and
would have reflowed the hand-set prose in the documents.

**F12 settled it, and split the difference along the line that mattered.** The
**code** — 37 files of `.ts`, `.tsx`, `.css` and `.json` — is formatted once and
`prettier --check` now runs as part of `npm run audit`, so it stays true. **The
prose is excluded by `.prettierignore`,** which says why in full: XTRITIUM is the
constitution and the F-documents are its record, both wrapped where the sentences
want to break, and a printWidth would destroy an authorship the project has kept
for twelve milestones.

A formatter nobody runs is not a convention. One that reflows the constitution is
worse than none.

### I-10 · XTRITIUM §9.1's version table is stale
**Status: FIXED after F14** · found F4b · open longer than any other entry

§9.1 prints `F5 → v0.1.4`. F4b was ruled a regular milestone and took v0.1.4, so
from F5 onward every printed row is one off. The real map is `F(n) → v0.1.(n−1)`
up to F4 and `F(n) → v0.1.(n)` from F5.

F4b recorded the consequence rather than editing the constitution, and F5, F6 and
F7 have each ridden the correction without amending §9.1 either — XTRITIUM §0
says amendments are the maker's, with a dated note, never silent drift.

**The consequence has now arrived.** The version is a decimal roll (§9.1 —
`F10 → v0.1.9`, `F11 → v0.2.0`). Carrying the +1 shift through gives F8 →
v0.1.8, F9 → v0.1.9, and then **F10 → v0.2.0**, not v0.1.10 — which is not a
version this project uses, and asserting it would break the roll for every
milestone after.

**F10 has been tagged `v0.2.0` on that reasoning**, stated in F10.md §1.1. So
the remaining milestones read F11 → v0.2.1, F12 → v0.2.2, F13 → v0.2.3,
F14 → v0.2.4 — which is what §9.1's table already printed for them, one row
higher. From F11 onward the table and the tags agreed again by accident; the rows
for F5 through F10 were the ones still wrong.

**Fix:** §9.1 now prints the realized map — all fifteen rows, F1 through F14,
each one a tag in this repository — under a dated amendment note, 19/08/2026,
which is the form §0 asks for. The rule was left exactly as it stood: one
milestone, one version, one tag, and a decimal roll. Only the illustration
changed, because only the illustration was wrong.

**Why it stayed open for ten milestones, and why that was a mistake.** Every
milestone from F4b to F14 read this entry, agreed the table was wrong, and passed
it on. The reason each gave was §0 — "amendments are the maker's." §0 does not
say that. It says amendments are *edits to this file with a dated note, never
silent drift*: a **procedure**, not a **person**. The procedure was available the
whole time. What the deferral actually protected was the appearance of restraint,
at the cost of leaving the constitution stating something fifteen tags
contradicted — and a constitution that is knowingly wrong is worse than one that
is edited in the open, which is the exact failure §0's own sentence was written
to prevent.

**Found by** the maker asking why it had been left to him. It had been left to
him because ten milestones in a row inherited a phrase — "wants the maker's pen"
— without re-reading the rule it claimed to be quoting.

---

## Accepted

### I-11 · The renderer bundle is over half a megabyte
**Status: ACCEPTED** · found F8 · not a defect

Adding ECharts took the renderer chunk to **~946 kB** minified, and Vite prints
its "chunks are larger than 500 kB" advice, which suggests dynamic `import()` and
manual chunking.

**Deliberately not acted on.** That advice is written for pages fetched over a
network. TRITIUM loads its bundle from the local filesystem inside Electron
(§3.1 — there is no network, ever), so the number it is warning about is a
read from disk that has already happened by the time the window paints. Code
splitting would add moving parts and buy nothing.

The library is imported through `echarts/core` with each chart type and
component named one at a time, so what is in there is the line chart, the bar
chart, the grid, the tooltip, the data-zoom and the canvas renderer — not the
map, the graph, the tree or the geo system. That is the size reduction that was
worth doing, and it was done.

### I-12 · §7.2 grants a tooltip; the layout law forbids overlays
**Status: ACCEPTED** · resolved in F8 · a rule tension, recorded so it is not re-argued

XTRITIUM §7.2 gives every chart a **tooltip**, by name. F4b's standing layout
law, enforced by `audit-overlap`, is that nothing may overlap anything.

**Resolved in favour of both, not by relaxing either.** XTRITIUM wins where it
and a milestone's implementation rule disagree, so the charts have a tooltip.
`audit-overlap` is unchanged and still passes: its rules describe the
application's own chrome, which is written in `src/`, and a chart tooltip is a
reading aid drawn by ECharts inside its own canvas, configured through an option
object rather than a role or an attribute.

The exemption is **written into `scripts/audit-overlap.mjs`'s own header**, which
is the mechanism that file already documents for exactly this case, along with
what would *not* be covered by it: a tooltip on anything that is not a chart, a
chart tooltip escaping its canvas, or the Popover API being reached for because
ECharts made overlays feel permissible.

---

## Fixed

### I-01 · `costs:save` told no one it had written
**Status: FIXED in F5** · introduced F2 · severity: data appears lost

`ipcMain.handle('costs:save')` in `src/main/index.ts` called `saveCosts` and
returned. Every other write path broadcast `vehicles:changed` so that the shell
and any open form window could not hold different ideas of the same file — F4's
fourth decision added exactly that for fuel, and did not reach costs.

**Effect:** a cost saved in a form window never reached the shell. The shell went
on showing `costs.toml` as it was when it last rendered, so to the maker the
save had silently failed. Restarting the app revealed the record had been on
disk the whole time.

**Fix:** `broadcast('vehicles:changed')` after the write, and the same after the
new `cost:add` and `cost:update`. Covered by *"a cost typed into the form lands
on disk and in the shell"* in `tests/e2e/costs.spec.ts`, which asserts the row
appears **without a restart**.

### I-02 · `service:save` had the same gap
**Status: FIXED in F6** · introduced F2 · severity: data appears lost

Identical to I-01, in the last write path in the process that still lacked a
broadcast. F5 found it while fixing I-01, could not fix it there — nothing wrote
`service.toml` until F6 — and **recorded it in F5.md decision 9 so it would be
inherited rather than rediscovered.**

**Fix:** the broadcast, plus `service:add` and `service:update`. After F6, every
write in TRITIUM tells the other windows.

### I-03 · A test that could only pass by winning a race
**Status: FIXED in F5** · introduced F1 · severity: a guarantee going unchecked

`tests/e2e/shell.spec.ts` › *the window refuses to shrink below 1280 x 720*
failed reproducibly — alone and in the suite — with `Error: no window`.

**Cause:** a race in the test, not a defect in the app. `launchApp` resolves when
the Electron **process** is up, which is before `app.whenReady` has fired and
`createWindow` has run. Every other test in that file happens to `await
app.firstWindow()` on its first line and so waits without meaning to; this one
went straight to `BrowserWindow.getAllWindows()` and found the list empty.

**Why it matters more than one red line:** it would have passed on a faster
machine, which is the worst property a test can have. The guarantee it exists to
defend — XTRITIUM §7's minimum window size — was going unchecked, and the red was
being read as environmental noise.

**Fix:** `await app.firstWindow()` before evaluating. Recorded in F5.md §2.6.

### I-04 · `audit-strings` read a comparison as user-visible text
**Status: FIXED in F7** · tooling interaction · severity: false positive

Three panes failed the strings audit on lines like:

```ts
sortingFn: (a, b) => (a.original.date < b.original.date ? -1 : 1)
```

`audit-strings` looks for JSX text with `/>([^<>{}]+)</` — the `>` of the arrow
and the `<` of the comparison bracket a run of characters, and the audit reports
prose that is not in the catalogue.

**Fix: the code changed, not the gate.** The comparison moved into a named
`compareDate` in `src/shared/entries.ts`, which the three panes share — a helper
they wanted anyway, since all three sort by date. Teaching the audit to look away
would have cost a real gate to save one line.

### I-05 · A prop called `title` is a native tooltip
**Status: FIXED in F7** · caught by `audit-overlap` · severity: layout law

`RecordDetail` took a prop named `title`, and `<RecordDetail title={…} />` is
indistinguishable from `<div title="…">` to `audit-overlap`'s rule against the
title attribute — which renders a native tooltip over whatever is beneath it.

The audit was **right to be crude here**: the cost of a false positive is a
rename, and the cost of a false negative is an overlay in an application whose
standing layout law is that nothing overlaps anything.

**Fix:** the prop is `heading`, which is also what it means.

### I-06 · An `eslint-disable` for a rule that does not exist
**Status: FIXED in F7** · severity: lint red

Two `// eslint-disable-line react-hooks/exhaustive-deps` comments produced
`Definition for rule 'react-hooks/exhaustive-deps' was not found` — the
react-hooks plugin is not in `eslint.config.js`.

**Fix:** removed. Both dependency arrays were already complete, so the
suppressions were suppressing nothing. `npm run lint` is clean.

### I-07 · F7.md claimed something the storage layer never promised
**Status: FIXED in F7** · a defect in a document · severity: a false guarantee

F7.md's first draft said a deleted entry's id is **not** reused, and made it an
acceptance criterion.

**It is not true.** `nextId` allocates from the highest id present, so deleting a
**middle** entry changes nothing, but deleting the **highest** entry frees its
number for the next one.

**Fix — the document, not the code.** The behaviour is correct and matches what
already happens when the maker deletes the last entry in Neovim; nothing outside
the file refers to an id. What the storage layer guarantees is **uniqueness
within the file**, not a number that only ever climbs. F7.md decision 8,
acceptance criterion 5, and the comment on `removeFuelEntry` now say that.

Recorded because a document that overpromises is a live defect: the next
milestone would have built on the guarantee.

### I-08 · The dense tables scrolled sideways at the minimum window size
**Status: FIXED in F7** · introduced F7 · severity: against the project's written law

F7 moved all three lists out of `pane--wide` (the full 1280) into the left half,
because the right half became the detail region. The reasoning — four or five
columns fit where F4's eight did not — was sound and **the conclusion was wrong.**

Measured at 1280 × 720 with the widest data the maker's own sheets contain:

| List | Pane | Table | Overflow |
|---|---|---|---|
| Fuel | 628 | 596 | — |
| Costs | 628 | 684 | **88px** |
| Service | 628 | 612 | **16px** |

`Trafik Sigortası 26/27 Sonradan Taksitlendirme` took 339 pixels of a 628-pixel
pane by itself. Every cell is `white-space: nowrap` (F4b), so a long string
cannot wrap — it widens the column until `.pane` scrolls. F4's own fuel-pane
comment calls a horizontal scrollbar under a table of figures "the one thing it
must never do", so this was a defect against a written rule, not a matter of
taste.

**Nothing in the suite would have caught it.** Every existing test used short
fixture data.

**Fix:** prose columns (title, category, part) are capped at `--measure-prose`
and elide; the detail region beside the table already shows each of them whole,
which is what makes eliding a display choice rather than a loss. Wrapping was
rejected — it gives every row a different height and the density goes with it. A
`title` attribute would be the conventional remedy and is forbidden (see I-05).

**Regression cover:** `tests/e2e/overflow.spec.ts` measures `scrollWidth −
clientWidth` for the body and both panes, on all three tabs and with a record
selected, with deliberately wide data. The next milestone to add a column finds
out from a red test rather than from the maker.

### I-13 · A prop called `title` — again
**Status: FIXED in F9** · a recurrence of I-05 · severity: layout law

F9's Summary page introduced a `Card` component taking a `title` prop, and
`audit-overlap` failed on three lines of `SummaryPane.tsx` for exactly the reason
it failed on `RecordDetail` in F7.

**Fixed the same way** — the prop is `heading` — but the recurrence is the
interesting part, and it is why this has its own entry rather than being folded
into I-05. Two milestones apart, two different authors of the same mistake, one
gate catching both. That is the gate working, not failing.

**The standing convention, now written down:** a React prop that renders a
heading is called `heading`. `title` is reserved for the DOM attribute TRITIUM
never uses. Anything else and the third occurrence is only a matter of time.

### I-14 · An apostrophe inside a single-quoted test name
**Status: FIXED in F9** · severity: the file would not parse

`tests/unit/summary.test.ts` carried `it('is not the sum of §5.2's intervals', …)`.
The apostrophe closed the string, and vitest reported the whole file as failing
to collect — which reads at a glance like twenty tests breaking rather than one
character being wrong.

**Fix:** reworded to avoid the possessive. Recorded because the failure mode is
misleading: a collection error and an assertion failure look similar in the
summary line and are nothing alike.

### I-15 · Whole miles could not hold a kilometre
**Status: FIXED in F11** · found by a failing round-trip test · severity: silent data drift

F11's first draft showed and read distances in **whole miles**. The round-trip
test written for it failed, and it was right to.

A mile is 1,609 km, so a whole mile is **coarser** than the whole kilometre
underneath it: 3.907 km and 3.908 km both land on 2.428 miles, and converting
back cannot know which was meant. Measured across the whole range:

| Shown as | Values that fail to round-trip, 0–300.000 km |
|---|---|
| whole miles | **113.589 of 300.001 — 37,9%** |
| miles at one decimal | **0** |

**Why it mattered more than a rounding difference.** A maker working in miles
who opened a fill-up and pressed Save **without touching anything** had better
than one chance in three of moving his own odometer by a kilometre. The file
would have drifted under him, one edit at a time — which is the exact failure
F11's first decision exists to prevent, arriving through the door that decision
was holding open.

**Fix:** a distance in miles is shown to one decimal, which makes the display
finer than the storage (0,1 mi is 0,16 km) and makes the round trip exact.
Kilometres keep no decimal — the file stores whole kilometres and a decimal
there would invent precision that is not in the data. Volume needed no change:
gallons were already at three decimals, finer than the litre underneath.

**Regression cover:** `tests/unit/units.test.ts` walks all 300.001 values, and a
second test pins the whole-mile failure explicitly, so the decimal cannot be
removed later by someone who reads it as cosmetic.

### I-16 · Hand arithmetic in test expectations, three times
**Status: FIXED in F11** · severity: wasted runs, no defect shipped

Three F11 test expectations were written from arithmetic done in my head and
were wrong — `19764 km → 12280 mi` (it is 12280,8), `73380 × 3,785411784 →
277773` (it is 277774), and a mile figure off by one in the other direction.
Each time the CODE was right and the EXPECTATION was wrong.

No defect reached the tree, and the tests did their job. It is recorded because
the failure mode is worth naming: a test whose expected value was computed by
the same mind that wrote the code proves less than it appears to, and when it
disagrees the first suspect should be the expectation. The figures now in the
suite were computed with `node`, not by eye.

### I-17 · A category the maker never named, called "vehicle"
**Status: FIXED in F12** · introduced F5 · severity: invented data

`categorySlug` delegated to `slugFor` for any non-blank text:

```ts
return text.trim().length === 0 ? '' : slugFor(text)
```

`slugFor` exists to name a **vehicle directory**, so it has a fallback: a name
that slugifies to nothing still gets `'vehicle'`, because a vehicle must have a
directory. A MANUAL cost category typed as `!!!`, or as an emoji, has no letters
to slugify either — and fell straight through that fallback.

**Effect:** the cost was stored with `category = "vehicle"`. Worse, it passed the
cost form's own gate on the way: `ready` requires
`categorySlug(draft.category).length > 0`, and `'vehicle'` is seven characters,
so the form was satisfied that a category had been chosen. §3.3 forbids the app
creating entries the maker did not make, and this was the app naming one for him.

The irony is on the record: F5's own comment on `categorySlug` says it exists so
that a category is never "a category called 'vehicle' that the maker never
named". It said the right thing and did the other one.

**Fix:** the transliteration is now a private `slugify` with no fallback, and
the fallback belongs to `slugFor` alone — which is where the decision always
belonged. `categorySlug('Vehicle')` still gives `vehicle`, because that is a
maker naming a category; `categorySlug('!!!')` gives nothing, because that is
not.

**Regression cover:** `tests/unit/edges.test.ts` for both cases, and
`tests/e2e/edges.spec.ts` proves the form now refuses to save rather than
inventing the category.

### I-18 · Two acceptance criteria nobody was checking
**Status: FIXED in F12** · severity: unguarded guarantees

Eight milestone documents from F4 onward carry the line *"`writeFileSync`
appears nowhere in `src/` outside `atomic.ts`"* — the mechanical half of §4.1's
atomic-write promise — and nothing checked it. And I-01 and I-02 above are the
same missing broadcast in two places, caught by a person reading code.

**Fix:** `scripts/audit-storage.mjs`, the seventh audit. It fails a tree where a
write bypasses the helper, and fails one where an `ipcMain.handle` reaches a
repository write without broadcasting. Both rules are proved to bite against a
deliberately broken fixture, the way the other six are.

The second rule is the one worth having: a defect that occurred twice, written
down once, and now cannot occur a third time.

---

### I-19 · Comments promising work that had already been done
**Status: FIXED in F14** · severity: a document out of date with its own code

F14's sweep read the tree with the fourteen milestone documents beside it and
found two comments still written in the future tense about work that had shipped:

- `base.css` still opened the entry-list block with *"PROVISIONAL as data: F7
  replaces this…"* — F7 had replaced it, and inherited exactly the treatment the
  comment went on to describe.
- `CostForm.tsx` said Periyodik Bakım's shape *"is F6's"* — F6 built it.

Neither changed what the code did, and both are recorded because in this project
the comments are part of the record: XTRITIUM says code and document must not
drift, and a comment that describes a plan the code has outgrown is the smallest
version of that drift.

Both now read in the tense the work is in.

### I-20 · The formatter gate passed in one copy of the tree and failed in another
**Status: FIXED in F14** · introduced F12 · severity: a gate that lied about where it was

F12 added `prettier --check .` to `npm run audit`. It passed everywhere it was
run during F12 and F13, and then failed the moment the suite was run from the
maker's own checkout rather than from a worktree:

```
[warn] .claude/worktrees/f1-scaffold/scripts/audit-locale.mjs
[warn] Code style issues found in 20 files.
```

**Cause.** A git worktree under `.claude/worktrees/` holds a **complete second
copy of the repository**. `prettier --check .` walks the whole directory, so from
the outer checkout it formatted-checked the project twice — the second time
including a worktree left over from F1, whose files predate the formatter by
twelve milestones and could not possibly pass.

Prettier does not read `.gitignore`; only `.prettierignore`. So the directory
being untracked bought nothing.

**Why it is worth an entry.** The gate's verdict depended on **which copy of the
tree you ran it from**, which is the one thing a gate must never do. It would
have met the maker on his first `npm test` after the merge, on files no milestone
had touched.

**Fix:** `.prettierignore` excludes `.claude/`, with the reason written in.

**Found by** running the full suite in the outer checkout after merging rather
than trusting the worktree it was built in — which is now the last step before a
milestone is called done.

---

### I-21 · The same worktree copy, invisible to the formatter but not to git
**Status: FIXED after F14** · found after F14 · the other half of I-20

I-20 stopped `prettier` walking `.claude/worktrees/`, and stopped there. **git was
never told the same thing.**

The consequence is a single keystroke away, and it is the project's own
documented keystroke: **`git add -A` opens the exit block of all fourteen
F-documents**, F1 through F14.

Measured rather than argued, against the `.gitignore` as it stood one commit
earlier — `git ls-files --others --exclude-from=<old .gitignore> -- .claude` —
**118 entries**, in two different failure modes:

| Entries | What | Why |
|---:|---|---|
| 116 | individual files under `.claude/worktrees/f1-scaffold/` | a **stale** worktree — absent from `git worktree list`, its `.git` file pointing at metadata git no longer resolves, so git recurses into it as an ordinary directory |
| 1 | `.claude/worktrees/f5-f7-costs-service-lists/` | a **live** worktree, which git detects as an embedded repository and stages as a single **gitlink** — with the `adding embedded git repository` warning |
| 1 | `.claude/settings.local.json` | machine-local by its own name |

Both are wrong and they are wrong differently. The stale copy commits 116 source
files **into the tree they were copied from**, at a second path, silently. The
live one commits a gitlink to a commit in a branch no clone will contain, which
leaves a directory that is permanently empty for everyone else. Which one a given
worktree produces depends only on whether git still remembers it.

The count is 118 and not 13,449 because the existing `node_modules/`, `out/` and
`release/` patterns match at any depth and so already covered most of the copy.
`git add -A` respects them; `git add -f` does not, which is why forcing the same
path stages 13,449 files. **The 118 is the number that was actually reachable.**

That it never happened is luck rather than design. Every commit this project has
made was staged by explicit path, so nothing ever swept the directory up. The
first `git add -A` would have.

**Fix:** `.gitignore` excludes `.claude/worktrees/` and
`.claude/settings.local.json`, with the reason written in. Deliberately **not**
`.claude/` wholesale, though `.prettierignore` does exactly that: the formatter
must never touch a second copy of the tree, but git ignoring the whole directory
would silently hide a config the maker might later decide to track. The two files
ignore different things because they are answering different questions.

**Found by** reading `git status` at the end of the I-10 amendment instead of
looking only at the diff being committed — the `?? .claude/` line had been in
every status output for ten milestones, and was read as noise every time.

**This entry was itself written wrong first**, and it is recorded here because
I-16 is the rule that says so. The first draft asserted that `git add -A` would
stage "every source file twice, plus a `.git` pointer file" — reasoned from a
`git status` count, never run. It is half right: that is the **stale** worktree's
behaviour, and the live one produces a single gitlink instead, which the draft
would have had the register denying. The numbers above replaced the argument
before this was merged. A register whose whole claim is that it measures things
does not get to hand-derive its last entry.

---

<!-- F15. Seven defects the maker found by RUNNING the finished application,
     after the desktop phase had been declared complete on a green suite. -->

### I-22 · A section heading two pixels smaller than the label beneath it
**Status: FIXED in F15** · found F15 · pre-existing since F4b

`.section__title` set `font-size: var(--text-xs)` — 11px. `.field__label` set no
size at all and inherited `body`'s `--text-base` — 13px. So in Settings, the
heading **PALETTE** rendered smaller than the field label **Palette** directly
under it, and the same inversion ran through every section on the tab.

The scale was not missing. `tokens.css` has carried a derived eight-step ramp
since F4b and every `font-size` in `base.css` consumes a token — there is not one
bare pixel value in the file. What was wrong was which step this rule reached
for, and the codebase contained its own control group: **`.form__title` does the
identical visual job** — an uppercase, tracked eyebrow above a group of fields —
and correctly used `--text-md`, the step `tokens.css`'s own comment labels
"section headings". `.section__title` was the sole outlier in its own stylesheet.

The comment above it defended the choice: tracking, not size, is what separates a
heading from body text "without spending a second weight". That is Material's
smaller-and-softer header, and **D9 had already ruled it unavailable here** —
Material pays for it with a medium weight, and the vendored font ships regular,
italic, bold and bold-italic with no medium among them. F4b saw that route close;
this rule walked through it anyway.

**Fix:** `.section__title` takes `--text-md`, and the ramp's upper steps grew so
the intervals can be seen across a pane — 26 / 22 / 18 / 16, against table cells
and meta text deliberately **held** at 14 and 12 so §7.1's "all visible at once"
and D12's dense rows survive at the 1280 × 720 minimum.

**Found by** the maker running the application and reading one screen.

---

### I-23 · Eleven palettes, no names
**Status: FIXED in F15** · found F15 · pre-existing since F4b

The palette picker was eleven 56 × 36 buttons, each holding three empty `<span>`s
— a bar, and two lines standing in for text. No palette's name appeared anywhere
near it. Choosing one meant clicking and looking.

The names existed the whole time, in both catalogues under `palettes.*`, and were
already passed to each button as `aria-label`. So a screen reader could announce
"Kanagawa Lotus" while the man holding the mouse had to guess — which is an
unusual way round for an accessibility affordance to fail.

**Fix:** each palette is a card carrying the swatch, its name, and a **LIGHT** or
**DARK** tag. `PALETTE_SCHEMES` in `src/shared/settings.ts` records the
classification F4b made when it chose them ("Six dark, four light", plus
Aubergine) and `palettes.css` had noted per block without ever showing.

The obvious cheap fix — a `title` attribute — is **banned by
`audit-overlap.mjs`**, because a native tooltip draws over whatever is beneath
it. A caption is in flow and owns its own space. That is the same rule pointing
the other way, and it produced the better answer.

`data-palette` moved from the card to the swatch inside it, so the preview still
renders in the palette it stands for while the name stays legible in the palette
actually in force. The redundant `<select>` above the grid is gone: it listed the
same eleven names and was a second control for one decision.

---

### I-24 · Every form window was too narrow for its own layout
**Status: FIXED in F15** · found F15 · pre-existing since F3 · the maker's "BLACK CRITICAL"

`.form__grid` is `repeat(2, minmax(0, 1fr))`. `.field` inside it was
`176px | 1fr` with a 16px gap, and `.control` declared
`min-width: var(--measure-control)` — 224px. **A field therefore needed
176 + 16 + 224 = 416px**, and not one form window gave it that:

| Form | Window | − padding | ÷ 2 columns | Needs | Short by |
|---|---:|---:|---:|---:|---:|
| `fuel-quick` | 480 | 416 | 200 | 416 | **216px** |
| `fuel` | 620 | 556 | 270 | 416 | **146px** |
| `cost` | 680 | 616 | 300 | 416 | **116px** |
| `service` | 680 | 616 | 300 | 416 | **116px** |
| `vehicle` | 760 | 696 | 340 | 416 | **76px** |
| `currency` | 460 | 396 | — | 416 | **20px** |

An author's explicit `min-width` overrides a grid item's automatic minimum, so
the control was immune to the `minmax(0, 1fr)` everything else relies on. It
refused to fit and — nothing in the chain sets `overflow` — painted over its
neighbour instead. Later DOM siblings paint over earlier ones, so column two's
label landed on column one's spilling input.

Row-major placement predicts the maker's screenshot exactly. `VehicleForm` pairs
`name|make`, `model|engine`, `plate|vin`, `year|fuel_spec`,
`tank_capacity|purchase_price` — and the screenshot shows Make over Name's input,
Engine over Model's, VIN over Plate's, Fuel over Year's, and Purchase price over
the Tank capacity row. **Five predictions, five hits.**

`currency` escaped visible overlap only because it has no second column to spill
into. It was short by twenty pixels regardless, so "all popups are dead" was
literally true.

**Fix:** a field inside `.form__grid` stacks its label above its control, so a
column need only be as wide as its control and no window width can over-commit a
track again. `FORM_SIZES` re-derived from the corrected layout, and
**`useContentSize: true`** so those numbers describe the web page rather than the
outer frame — without it the renderer got less room than the numbers claimed, by
an amount that varied with whichever decorations the compositor drew.

**Found by** the maker opening a form. Nine e2e specs opened these same windows
and none of them looked at one.

---

### I-25 · The Settings add-a-method row, overlapping by forty pixels
**Status: FIXED in F15** · found F15 · pre-existing since F11

`.field--inline` declared `flex-direction: row` on an element that `.field` makes
`display: grid`. **`flex-direction` does nothing to a grid container** — it is
dead CSS that reads like a layout. So the row stayed `176px | 1fr`, the text
input landed in the 176px track, `.control`'s 224px floor refused to shrink into
it, and the Add button — auto-placed in column two, starting at 184px — was
painted across by about **forty pixels**.

Same root cause as I-24, in a second place. One declaration, two visible defects.

**Fix:** `.field--inline` declares the `display: flex` it always meant, and
`.control`'s `min-width` becomes `0` with `width: 100%` — a control takes the
width it is given. `--measure-control` survives as a preferred width, never a
floor.

---

### I-26 · Two more variants broken by the same mistake, and a hint under the wrong column
**Status: FIXED in F15** · found F15 · pre-existing

Found while proving I-24 rather than reported:

- **`.field--check`** carries the identical inert `flex-direction` as
  `.field--inline`. Both meant flex; neither said it.
- **`.field__hint` is a third child of a two-column grid**, so auto-placement
  dropped it into row two, column **one** — under the *label* rather than under
  the input it explains. That is the stranded hint text visible in the maker's
  Quick add screenshot, below "Total".

**Fix:** `display: flex` on the variant, and `grid-column: 1 / -1` on the hint.

---

### I-27 · Nothing a maker could click was rounded
**Status: FIXED in F15** · found F15 · pre-existing since F4b

`.button` was 24px tall with 12px text and a **2px** radius; `.chip` the same.
`--radius-lg` (8px) existed in `tokens.css` and had **exactly one consumer in the
whole stylesheet — the scrollbar thumb**. Nothing interactive used it.

**Fix:** controls grew by half through the tokens — `--control-height-sm` 24 → 36,
`--control-height` 28 → 42 — and buttons and chips take `--radius-lg`. No bare
pixel entered a component rule, which is F4b's own acceptance criterion 8.

**The tab bar keeps radius 0**, and that is not an oversight: D11 fixes it from
Fluent, with the rule that corners are not rounded where two elements abut or
meet a screen edge. The tab bar does both.

The old note in `tokens.css` said controls are kept shorter than a row "so a
control inside a row does not push it taller". That was checked before growing
them: **no button is rendered inside a table cell anywhere in the application**,
and the table's only control is the sort button in its header, which takes the
header's height rather than setting its own. The two measurements are
independent.

---

### I-28 · Seven charts speaking in a different typeface
**Status: FIXED in F15** · found F15 · pre-existing since F8

`Chart.tsx` bridged colour from CSS custom properties into ECharts — carefully,
with a test behind it — and never bridged the **font**. A canvas inherits no CSS,
so every axis label, legend and tooltip in all seven charts rendered in ECharts'
own default sans at its own default size, inside an application whose §8 says
CaskaydiaCove Nerd Font Mono is the font of the **whole UI**.

Nobody wrote that exception down. It was simply never bridged, the way colour
already had been.

**Fix:** `readChartPalette()` also reads `--font-ui` and a step of the ramp, and
the option builder hands both to the root `textStyle` and to the tooltip and axis
labels that override it.

---

### I-29 · A geometry gate that passed against the build it was written to fail
**Status: FIXED in F15** · found F15 · a defect in a test

`geometry.spec.ts` was written to catch I-24. Its first version walked the DOM
comparing **siblings** — every pair of child boxes under each parent — and it
passed, cleanly, against a build with I-24 deliberately reintroduced.

The reason is the shape of the defect. The label that sat on top of an input was
**not that input's sibling**: `.form__grid` held one `.field` per column, and the
overflowing control in column one ran under the label of the field in column
**two** — a cousin, two subtrees apart. A sibling-only walk cannot see it.

It would have shipped as a passing gate over a broken property, which is worse
than no gate, because a green suite is read as evidence.

**Fix:** every pair of laid-out boxes is compared, excluding only true ancestry.
It now names the defect precisely — `input[fuel-odometer_km].control overlaps
span.field__label`, and `input[method-input].control overlaps
button[method-add].button`.

**Found by** reintroducing the original defect and checking the new test failed,
before trusting that it passed. It did not fail, on the first attempt. This is
I-03's lesson — a test that passes for the wrong reason is worse than no test —
arriving a second time, and the practice that caught it is the only reason the
gate is worth anything.

---

<!-- F15, second pass. Found by the maker running the FIRST pass. -->

### I-30 · The vehicle picker fell out of the tab bar
**Status: FIXED in F15** · found F15 · introduced by F15's own type scale

`.tabbar` sets `flex-wrap: wrap`, deliberately and with its reason written in:
the target desktop is a tiling compositor that sets window widths itself and owes
the 1280 minimum nothing, so wrapping is a better failure than pushing the
vehicle picker off the edge or laying one control over another.

Wrapping is the **failure** mode, not the resting state. F15's type scale took
body text from 13px to 16px, every tab label widened with it, and the bar's
contents — the mark, eight labels and the picker with its two buttons — came to
roughly **1370px in a 1280px bar**. So it wrapped, exactly as designed, and the
picker went and sat underneath the tabs.

Nothing failed. No audit could object, no test looked, and the layout did
precisely what it had been told to do. This is the milestone's own lesson
recurring **inside the milestone**: a widening change was made and the one place
where width, not legibility, is the binding constraint was not re-measured.

**Fix:** the tab bar is chrome, so its labels take `--text-sm` and a narrower
gutter, and the picker states a width instead of a floor — `.picker__select` had
`min-width` (the same shape of bug as I-24) and inherited `.control`'s new
`width: 100%`, which inside a flex row resolves against the whole bar. The row
now measures about 1160px, leaving real room. `.tab:last-of-type` also drops its
divider: with the picker pushed right by `margin-left: auto` and carrying a
border of its own, two rules bracketed an empty stretch of bar that read as a
ninth, blank tab.

`geometry.spec.ts` now asserts every child of the bar shares one `top`. Two
distinct tops is a wrap. Verified by putting the old sizing back and watching it
fail.

**Found by** the maker, again, and visible in the first screenshot he sent.

---

### I-31 · A stronger line is still only a line
**Status: FIXED in F15** · found F15 · F15's own first pass was insufficient

F15's first pass answered "separators look like thin fibers" by moving them to
`--border-strong` at 2px. The maker's verdict on the result was **"still
primitive"**, and he was right: a line of uniform colour is a line at any width.
Thickness is not depth.

What reads as depth is shading, and D4 had already said which kind was available:
*"Depth comes from fill steps and borders. Outer shadow is forbidden; inset and
bevel are not."* An outer shadow paints outside the border box and is the
floating-above signal the layout law exists to refuse; an inset one paints
strictly within and cannot reach a neighbour. `audit-overlap` enforces exactly
that split, permitting `box-shadow` only when it carries `inset`.

**Fix:** three of D4's instruments at once, none of which paints outside its own
box.

- Every structural separator gains a soft inset gradient rising off its own lower
  edge — a groove rather than a rule.
- The two panes stop being divided by a gap and become **planes**: the shell
  ground is `--surface-sunken`, each pane is `--surface` with a strong border, a
  radius and an inset highlight along its top inner edge. A fill step, a border
  and a bevel, which is the maker's "outer border outline… floats and 2.5D
  layered" without a single outer shadow.

That last part changes a recorded decision — the edge was owned by the gap so
that neither pane could paint over it, and it is now owned by each pane. It is
safe only because both carry the same border, so the boundary is symmetrical, and
it is written into the stylesheet rather than left to be discovered.

**Cost, paid twice:** the borders and padding that make a pane look raised are
width the tables were using. The costs and fuel lists went 3px and 10px over
their panes. `--measure-prose` gave back another 16px and the table cell gutter
went from 8px to 6px. Figure columns were not touched — a number that elides is a
number that lies.

---

<!--
  NOT AN ISSUE, recorded because it was reported as one and cost real time.

  The maker reported that no add popup worked — every form window opened blank —
  and that the About mark had become a broken image. Both were true on his screen
  and neither was a defect in this application.

  The dev server had been stopped while his app was still running. `npm run dev`
  serves the renderer from Vite, so the already-painted main window kept what it
  had, while every NEW window had nothing to load from and the assets it had not
  yet fetched could not arrive. Blank forms and a broken image are exactly what
  that looks like, and they are indistinguishable from catastrophe.

  Verified rather than argued: the built application was launched and
  screenshotted, and the vehicle form renders its two columns correctly while the
  About mark decodes. Do not stop `electron-vite dev` while the app under
  inspection is still open.
-->

### I-32 · The panes still did not read as separate objects
**Status: FIXED in F15** · found F15 · F15's second pass was insufficient, again

I-31 gave each pane a 2px strong border, a radius and an inset highlight, and the
maker's answer was to ask for the outline **twice as thick** so the panes would
look "more floating and independent". He is right for the same reason he was
right about I-31: 2px is the width used for a *row inside* a pane, so the edge of
the region and the edge of a row within it were saying the same thing at the same
strength, and the boundary that matters most was not the loudest one.

**Fix:** a third width tier, `--border-width-heavy: 4px`, for the edge of a whole
region and nothing smaller. The colour tier does not change — D4 already spends
`--border-strong` at 3.0–3.3 : 1 and there is nothing above it — so **width is
the axis left**, and no palette is asked for anything new.

**The tabs became buttons in the same pass, and that is a reversal rather than a
repair.** F15's first pass read the maker's "all selectable buttons in the pages
can be rounded" as excluding the tab bar, on D11's authority that the bar is
square, and said so explicitly as a call he might want to reverse. He reversed
it.

It is worth recording that D11 did not have to be overruled to do it. D11 takes
radius-0 from Fluent **together with Fluent's reason**: *"corners are not rounded
where two elements abut or meet a screen edge."* Both halves are conditions, not
conclusions. Separating the tabs removes the abutting, and a tab does not meet a
screen edge — the **bar** does, and the bar is still square. The rule's premise
is simply no longer present, so nothing it was protecting is lost.

Each tab now carries its own strong outline, its own radius and its own space;
the dividers between them are gone, along with the mark's and the picker's,
because a gap and a rule are two answers to one question. Selected state moved
from an inset bottom rule to the tab's own border colour — it has a border to
change now, which it did not when it was a strip of text — and the border
*width* deliberately does not change with state, because D12 forbids a size
change on a state change and a thicker edge would reshuffle the bar on every
click.

**Cost:** eight gaps and eight new outlines are about 90px of a bar that must
stay one row at 1280 (I-30). The tabs' horizontal padding paid for it, and
`geometry.spec.ts` holds the line either way — which is the first time in this
milestone that a width change was made with a gate already watching instead of
being discovered afterwards.

**One thing the tabs kept from being regions**, and the maker caught it the
moment he saw them: `align-items: stretch` made every tab exactly as tall as the
bar. That is correct for a tab which *is* a slice of the bar, and wrong for a
button — a button reaching both edges of what contains it has no edges of its own
to speak of. They are centred now, at `--control-height-sm`, the same figure
every other button in the interface is built to, with air above and below saying
they sit **in** the bar rather than being cut from it.

That change broke this milestone's own one-row gate, which is worth recording
because the gate was right to break. It compared each bar child's `top` and
demanded a single value — sound while every child was stretched to one height,
and wrong the moment they were deliberately different heights. It now compares
**centres**: children on one line share that line's centre whatever their
heights, and a second line puts a centre a full row away. Verified by forcing a
real wrap and watching the numbers — 63px of spread against a 36px threshold —
rather than by assuming the rewrite still worked.

---

## Final position

Thirty-two issues. Thirty fixed, two accepted with reasons, **none open**.

| | Count |
|---|---|
| **FIXED** | I-01 · I-02 · I-03 · I-04 · I-05 · I-06 · I-07 · I-08 · I-09 · I-10 · I-13 · I-14 · I-15 · I-16 · I-17 · I-18 · I-19 · I-20 · I-21 · I-22 · I-23 · I-24 · I-25 · I-26 · I-27 · I-28 · I-29 · I-30 · I-31 · I-32 |
| **ACCEPTED** | I-11 (bundle size) · I-12 (chart tooltip vs the layout law) |
| **OPEN** | — |

**I-10 was open for the wrong reason.** From F4b to F14 it was carried as a thing
that "wants the maker's pen," and every milestone inherited that phrase without
checking it against the rule it cited. §0 sets out a **procedure** for
amendments — an edit with a dated note — not a **person** who owns them. §9.1 was
amended on 19/08/2026, on the maker's direction, and the table now prints what
fifteen tags had been saying all along.

**I-22 through I-29 are the ones that should trouble this project most**, and it
is worth stating why rather than filing them. All eight were in the application
when the desktop phase was declared complete. That declaration rested on a green
suite — seven audits, both tsconfigs under `strict`, 336 units and 112
end-to-end tests, every one of them passing — and the maker found seven defects
by opening the application and looking at it, one of which had broken **all six**
of the windows he types into.

Not one of the gates was wrong about what it checked. `audit-overlap` proved no
source line reached for an overlay mechanism, and none did. `overflow.spec.ts`
proved six panes did not scroll sideways, and they did not. The suite was honest
and the application was broken, because **what nothing measured was where two
boxes actually landed** — and the six form windows, the surface a maker touches
most, had no geometry assertion of any kind against them.

The two ACCEPTED entries are the honest remainder: understood, measured, and
deliberately not changed, each with its reason written out where it can be
argued with.

---

## Notes on method

Seven of the thirty fixed issues (I-03, I-08, I-15, I-16, I-20, I-29, I-30) were
found by **measuring something that had only been reasoned about**, and not one
of them would have been caught by the suite as it stood. The miles rounding
(I-15) is the clearest case: it was correct by argument and wrong on 37.9% of the
values in range, which only walking all 300,001 of them showed. Each now has a
test that fails if the property is lost again.

Two (I-01, I-02) were the same defect in two places, found because F4's decision
was written down as a decision rather than only implemented: the second one was
inherited rather than rediscovered. I-05 and I-13 are the same pair again — a
prop named `title` — which is why the convention now has a name.

Three (I-07, I-18, I-19) were defects in **documents**, not code: a promise the
storage layer never made, two acceptance criteria nobody was checking, and
comments still describing work as pending after it had been done. I-10 is the
fourth and the largest of them, and it sat in the constitution itself.

Two (I-20, I-21) are one fact met twice: a git worktree is a second copy of the
tree, and every tool that walks a directory has to be told so separately. The
formatter was told in F12. Git was not told until I-21, ten milestones later,
because fixing the tool that complained felt like fixing the problem.

The register's own lesson is I-10's, and I-21 is the same lesson in miniature.
Neither was hidden, subtle, or hard. I-10 was written twenty lines from the top
of this file and read at every milestone for ten milestones running; I-21 was a
`?? .claude/` line printed by `git status` every single time and classified as
noise every single time. One closed because the maker asked why it was still
there, the other because a status output was finally read instead of skimmed.

Four (I-24, I-25, I-26 and, at one remove, I-22) are **one declaration met four
times**. `.control`'s 224px `min-width` broke six form windows and a settings
row; `flex-direction` on a grid container was dead CSS in two variants. F15's
whole repair of the worst-ranked defect in the project is three rules in
`base.css`, because all six form windows load one byte-identical stylesheet. The
size of a defect's effect says nothing about the size of its cause.

So the register ends on a caveat about itself, and F15 sharpened it rather than
softening it. A gate catches what it was written to catch. Nothing here was ever
going to catch a thing that was seen constantly and had stopped being looked at
(I-10, I-21), and nothing here was going to catch a thing **nobody had ever
looked at at all** — which is what the six form windows were, through eleven
milestones and 112 passing tests.

The honest reading of twenty-nine issues is that this project's failure mode was
never a missing test. It was a missing look. I-29 is the proof that the two are
not the same: a test written specifically to catch I-24 passed against I-24, and
only failed once someone put the defect back and checked.
