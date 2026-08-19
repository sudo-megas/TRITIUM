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

## Final position

Twenty issues. Eighteen fixed, two accepted with reasons, **none open**.

| | Count |
|---|---|
| **FIXED** | I-01 · I-02 · I-03 · I-04 · I-05 · I-06 · I-07 · I-08 · I-09 · I-10 · I-13 · I-14 · I-15 · I-16 · I-17 · I-18 · I-19 · I-20 |
| **ACCEPTED** | I-11 (bundle size) · I-12 (chart tooltip vs the layout law) |
| **OPEN** | — |

**I-10 was the last of them, and it was open for the wrong reason.** From F4b to
F14 it was carried as a thing that "wants the maker's pen," and every milestone
inherited that phrase without checking it against the rule it cited. §0 sets out
a **procedure** for amendments — an edit with a dated note — not a **person** who
owns them. §9.1 was amended on 19/08/2026, on the maker's direction, and the
table now prints what fifteen tags had been saying all along.

The two ACCEPTED entries are the honest remainder: understood, measured, and
deliberately not changed, each with its reason written out where it can be
argued with.

---

## Notes on method

Five of the eighteen fixed issues (I-03, I-08, I-15, I-16, I-20) were found by
**measuring something that had only been reasoned about**, and not one of them
would have been caught by the suite as it stood. The miles rounding (I-15) is the
clearest case: it was correct by argument and wrong on 37.9% of the values in
range, which only walking all 300,001 of them showed. Each now has a test that
fails if the property is lost again.

Two (I-01, I-02) were the same defect in two places, found because F4's decision
was written down as a decision rather than only implemented: the second one was
inherited rather than rediscovered. I-05 and I-13 are the same pair again — a
prop named `title` — which is why the convention now has a name.

Three (I-07, I-18, I-19) were defects in **documents**, not code: a promise the
storage layer never made, two acceptance criteria nobody was checking, and
comments still describing work as pending after it had been done. I-10 is the
fourth and the largest of them, and it sat in the constitution itself.

The register's own lesson is I-10's. It was not hidden, not subtle, and not
hard — it was written down twenty lines from the top of this file and read at
every milestone for ten milestones running. It closed when the maker asked why it
was still there. A gate catches what it was written to catch; nothing in the
suite was ever going to catch a reason that had stopped being examined.
