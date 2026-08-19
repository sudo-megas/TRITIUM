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

- **`extra-x86_64-build`.** It is `devtools`, needs root, and **fetches the tag
  from the remote** — so it cannot work until the tag has been pushed. That is
  §9.3's own procedure and it belongs on your machine, after `PUTAGREL`.
- **`namcap`.** Not installed where F13 was built. It is the tool that will tell
  you whether `depends` is over- or under-specified, and it is worth reading
  before the first release rather than after it.
- **Installing the package and launching it from a desktop.** TRITIUM has been
  run from a checkout in every milestone. Running it from `/usr/bin` after
  `pacman -U`, with the compositor drawing the decorations and the launcher
  matching `StartupWMClass=tritium`, is a different claim, and F13 does not make
  it.

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
