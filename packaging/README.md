# TRITIUM — PACKAGING

Repo path of this file: `~/REPO/packaging/README.md`
Governing document: `~/REPO/XTRITIUM.md` §9.3.

Everything needed to build `tritium-<ver>.pkg.tar.zst`, and an honest note about
which of it has been run and which has not.

---

## 1. WHAT IS HERE

| File | What it is |
|---|---|
| `PKGBUILD` | the package, built **from a git tag** |
| `tritium.desktop` | the launcher entry — no MIME type, no field code |
| `../electron-builder.yml` | the `dir` target, and nothing else |

---

## 2. RELEASING

The version lives in four places and a unit test holds them in agreement:
`package.json`, `package-lock.json` (twice), and `src/shared/app-meta.ts`. The
PKGBUILD's `pkgver` is the fifth, and it is the only one in this directory.

```sh
# 1. In the repository root, with the version already rolled and tagged.
git tag v0.2.3

# 2. Set pkgver in packaging/PKGBUILD to match, and commit it.

# 3. Build in a CLEAN CHROOT — XTRITIUM §9.3. This fetches the tag, so the
#    package is built from what was tagged and not from the working tree.
cd packaging
extra-x86_64-build

# 4. Look at what came out before it goes anywhere.
namcap tritium-0.2.3-1-x86_64.pkg.tar.zst
pacman -Qlp tritium-0.2.3-1-x86_64.pkg.tar.zst | less

# 5. Install it and open it from the desktop, not from a terminal.
sudo pacman -U tritium-0.2.3-1-x86_64.pkg.tar.zst
```

**Signing and publishing are yours and are not scripted.** XTRITIUM §9.3: "The
maker signs packages himself and places them into `megas-xlr` himself. TRITIUM's
tooling never touches that repo." Nothing in this repository references a key, an
upload, or that repository's name — deliberately, and it should stay that way.

---

## 3. BUILDING WITHOUT A CHROOT

For a quick look at the tree the package installs, without `devtools` or root:

```sh
npm ci
npm run build                    # the seven audits, both tsconfigs, the bundle
npx electron-builder --linux dir # -> release/linux-unpacked/
./release/linux-unpacked/tritium
```

This is **not** a substitute for the chroot build. It resolves against whatever
is on the host, which is exactly what §9.3 uses a clean chroot to prevent.

---

## 4. WHAT F13 VERIFIED, AND WHAT IT DID NOT

Kept here rather than only in `build/docs/F13.md`, because this is the file
someone reads when they are about to build.

**Run and passing:**

- `npx electron-builder --linux dir` produces `release/linux-unpacked/` — the
  binary is `tritium`, beside `resources/`, `locales/`, `chrome-sandbox` and
  Electron's shared objects. Those are the paths `package()` copies.
- `desktop-file-validate packaging/tritium.desktop` — no output, which is what
  passing looks like.
- `makepkg --printsrcinfo` parses the PKGBUILD and resolves every variable.
- Every name in `depends` exists in the Arch repositories (`pacman -Si`).
- **The packaged binary launches.** `release/linux-unpacked/tritium`, run against
  a throwaway `XDG_DATA_HOME`: a GPU process on Wayland and two renderers — the
  main window and the first-launch currency question — with nothing on stderr.
- The whole suite: seven audits, both tsconfigs under `strict`, the units, the
  bundle, and the end-to-end run.

**NOT run, and yours to run:**

- ~~**`extra-x86_64-build`.**~~ **Run, at v0.2.6-2 — see §5.2.** The tag is on the
  remote, so it finally could be.
- ~~**`namcap`.** Not installed where F13 was built.~~ **Run, at v0.2.6-2, and
  it earned its place — see §5.**
- **Installing the package and launching it from a desktop.** TRITIUM has been
  run from a checkout in every milestone. Running it from `/usr/bin` after
  `pacman -U`, with the compositor drawing the decorations and the launcher
  matching `StartupWMClass=tritium`, is a different claim, and F13 does not make
  it.

---

## 5. WHAT v0.2.6 ACTUALLY BUILT, AND HOW

Recorded because §4 above was written at F13, and all three of its "not run"
items have since moved.

**A real `tritium-0.2.6-1-x86_64.pkg.tar.zst` exists.** Built on 19/08/2026 from
the pushed tag `v0.2.6`, 117.6 MiB compressed, 396.5 MiB installed. Verified:

- `pacman -Qip` — name, version, licence and the eight runtime `depends` are what
  the PKGBUILD declares.
- `pacman -Qlp` — `/usr/bin/tritium` is the two-line launcher (45 bytes),
  `/usr/lib/tritium/tritium` is the binary, `chrome-sandbox` carries its setuid
  bit (`-rwsr-xr-x`), five hicolor sizes are installed, and `LICENSE` is at
  `/usr/share/licenses/tritium/`.
- The desktop entry has **no `MimeType` and no field code**, which is §9.3's rule
  and the reason there is no file association to claim.
- **The packaged binary was extracted and run** against a throwaway
  `XDG_DATA_HOME`. It stayed up, wrote a valid `settings.toml`, and put nothing on
  stderr. That is the closest anything has come to F13's third item.

**That first round was built with `makepkg`, not `extra-x86_64-build`** —
`devtools` needs root and was not installed — so it resolved against the host's
own packages. Every dependency the PKGBUILD named happened to be present, which is
exactly the condition under which a missing `depends` entry stays invisible. §5.2
is where that stopped being true.

So the package is real and it runs.

### 5.1 namcap, and the dependency it was right about for the wrong reason

The maker installed `namcap` and ran it on `0.2.6-1`. Setting aside the noise —
`libpthread`/`libdl` "unused" on modern glibc, where both are empty compat stubs,
and twenty libraries "detected and implicitly satisfied" — it made exactly one
actionable finding, three times:

```
tritium W: Dependency included, but may not be needed ('libnotify')
tritium W: Dependency included, but may not be needed ('libxss')
tritium W: Dependency included, but may not be needed ('libxtst')
```

**All three are gone at `pkgrel=2`, and one of them namcap could not actually
see.**

- **`libxss`, `libxtst`** — not in the binary's `NEEDED` list, and the strings
  `libXss` and `libXtst` do not occur *anywhere in the packaged tree*. Arch's own
  `electron43` does not declare them. Four checks, one answer.
- **`libnotify`** — not linked either, but it is **`dlopen`'d**: the binary
  carries `libnotify.so.1`, `.so.4` and `.so.5` as strings. namcap reads ELF
  headers, so a `dlopen` is invisible to it, and on this one **its verdict was
  right by luck rather than by evidence.** Dropping it on namcap's word alone
  would have been the correct action taken for a reason that does not hold. It is
  dropped on a reason that does: TRITIUM never raises a notification — §7 has no
  tray and no autostart, and nothing anywhere calls the Notification API — and
  Chromium degrades quietly when the `dlopen` fails.

The twenty "implicitly satisfied" libraries are **deliberately not added**. Every
one arrives through `gtk3`, `nss`, `at-spi2-core` or `libcups`, and Arch does not
list transitively satisfied dependencies; taking namcap's advice literally would
also have meant declaring `glibc` and `bash`, which is declaring `base`.

`namcap` on `0.2.6-2` now reports **one** warning, and it is the deliberate one:

```
tritium W: File (usr/lib/tritium/chrome-sandbox) is setuid or setgid.
```

The rebuilt package was extracted and run again: still up, still writing a valid
`settings.toml`, still silent on stderr.

### 5.2 The clean chroot, finally

**`extra-x86_64-build` has run.** The maker ran it in his own terminal — it wants
a password and refuses a non-interactive one — and it built `0.2.6-2` from the
tag inside a chroot holding nothing but the declared `depends` and `makedepends`.

That is the sentence §4 has been carrying since F13, and it is the one that
mattered most. It proves two things this machine could never prove:

- **The `makedepends` are complete.** `git`, `nodejs` and `npm` were the whole of
  what the build needed. Nothing was quietly borrowed from a developer's host.
- **The trimmed `depends` survived.** Removing `libnotify`, `libxss` and `libxtst`
  at `pkgrel=2` did not break a build that has no other libraries to fall back on,
  and namcap inside the chroot reported the remaining dependencies as *detected
  and implicitly satisfied* — satisfied, not missing.

`checkpkg` was skipped with `error: target not found: tritium`, which is simply
what it says when the package is not yet in any configured repository. It has
nothing to compare against because nothing has been published. Expected on a
first build, and not a finding.

### 5.3 What is STILL not proved

**Installing the package and launching it from a desktop.** The binary has been
run from an extracted tree and from a checkout; running it from `/usr/bin` after
`pacman -U`, with the compositor drawing the decorations and the launcher matching
`StartupWMClass=tritium`, is a different claim and nothing has made it yet.

**And `0.2.6-3` has not been through the chroot.** The `!debug` change above is
newer than the chroot build, so the round that proved the dependency list was
`-2`. One more pass closes it:

```sh
cd packaging && extra-x86_64-build
namcap tritium-0.2.6-3-x86_64.pkg.tar.zst
```

There should be no `tritium-debug` package this time, and namcap should report the
setuid warning and nothing else that is actionable.

---

## 5. THINGS DELIBERATELY ABSENT

- **No AUR**, and no `.SRCINFO` committed. §1 — "No AUR. No CI."
- **No CI**, no workflow file, no runner.
- **No signing key, no upload, and no tooling that reaches `megas-xlr`.** §9.3.
  The name appears twice in this repository, both times in a comment saying that
  nothing here touches it.
- **No MIME type**, no file association, no `%f` or `%U` in the desktop entry.
  There is no custom file format to claim.
- **No AppImage, flatpak or snap.** On a distribution whose argument is that it
  tracks what it installs, bundling a second copy of a runtime is the wrong
  answer.
- **No tray, no autostart, no systemd unit.** §7.
