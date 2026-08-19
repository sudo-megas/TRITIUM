<p align="center" width="100%">
    <img width="33%" src="build/icons/512.png">
</p>

<h1 align="center">TRITIUM</h1>

<p align="center">
  <img alt="Version"      src="https://img.shields.io/badge/version-v0.2.4-4A9D8E?style=for-the-badge">
  <img alt="Release date" src="https://img.shields.io/badge/released-19--08--2026-4A9D8E?style=for-the-badge">
  <img alt="Licence"      src="https://img.shields.io/badge/licence-GPL--3.0--or--later-6E7B8B?style=for-the-badge">
</p>

<p align="center">
  <img alt="Arch Linux"    src="https://img.shields.io/badge/Arch%20Linux-~136%20MiB-1793D1?style=for-the-badge&logo=archlinux&logoColor=white">
  <img alt="Android"       src="https://img.shields.io/badge/Android-planned-3DDC84?style=for-the-badge&logo=android&logoColor=white">
</p>

<p align="center"><strong>Fuel Logging / Maintenance Tracking for any ICE Vehicle</strong></p>
<p align="center"><strong>Her İçten Yanmalı Araç için Yakıt Kaydı / Bakım Takibi</strong></p>



## 1. DESCRIPTION

TRITIUM is a **local, offline** fuel and vehicle-cost journal for any
internal-combustion vehicle. It records what you actually spent and how far you
actually went, and it computes the figures that follow from those two things —
nothing else.

It is built on a small number of decisions that do not bend:

- **Zero network. Ever.** No lookup, no update check, no telemetry, no crash
  reporting. A build-time audit fails if a network primitive so much as appears
  in the source, and the end-to-end suite runs once more with the network
  severed to prove the application behaves identically.
- **Plaintext storage you can repair by hand.** Everything lives in TOML under
  `~/.local/share/tritium/`. Open it in Neovim, fix a digit, close it. Writes are
  atomic — a power cut leaves the old file whole or the new one complete, never a
  torn one.
- **Only realised data.** No estimates of entries you did not make, no
  recurrence engine, no reminders, no guessing at the level in your tank.
  Averages and statistics over what is already recorded are fine; inventing a
  record is not.
- **Derived values are never stored.** A fill-up's total, l/100km, cost per
  kilometre, monthly sums — all computed at read time from the figures you
  entered. One source of truth.
- **Everything is editable, always.** The application warns about a suspicious
  entry — a backwards odometer, a date that is not a date — and then accepts your
  word.
- **No encryption, no password, no lock.** A fuel log is not a secret. It opens
  straight into the data.
- **It opens no browser and follows no link.** Every address in it — the source
  address on the About page, a vendor you pasted onto a service record — is
  selectable text and never a link.

### What is in it

**Fuel** — quick-add for the three figures you have at the pump, and a full form
for everything else. Consumption is computed only between consecutive full tanks,
counting every partial fill in between.

**Costs** — the category tree of İLK ALIŞ, TEKRAR EDEN and MANUAL, with payment
method, bank and instalment as three separate fields rather than one remark
column.

**Service** — Periyodik Bakım: what was done, at what reading, for how much, and
where it came from.

**Lists** — dense tables with time-range chips, sortable columns, and a detail
region beside them.

**Charts** — seven of them: fuel consumption, monthly costs, gas price, fill-up
costs, odometer, cost per kilometre, monthly distance.

**Summary and Statistics** — the cards you open on, and a section of its own for
best and worst tank, distance per day, projected annual cost, and true cost per
kilometre including what the vehicle cost to buy.

**Eleven palettes**, English and Turkish, and units — km/miles, litres/gallons,
l/100km, km/l or mpg — each set independently of the others and of the language.



## 2. DEPENDENCIES

**To run**, from the Arch repositories:

```
alsa-lib  at-spi2-core  gtk3  libcups  libnotify  libxss  libxtst  nss
```

Electron ships inside the package; those are the desktop libraries it links
against.

**To build**, additionally: `git`, `nodejs`, `npm`.

TRITIUM targets **Arch Linux exclusively** in this phase. Android follows later
as a full, separate rewrite on its own branch.



## 3. INSTALLATION

Build the package in a clean chroot and install it:

```sh
git clone https://github.com/sudo-megas/TRITIUM.git
cd TRITIUM/packaging
extra-x86_64-build
sudo pacman -U tritium-*.pkg.tar.zst
```

`packaging/README.md` carries the full release procedure.

To run it from a checkout instead:

```sh
npm ci
npm run dev
```

**There is no AUR package and no CI.** Packages are signed by the maker and
placed in his own repository by hand.



## 4. HOW TO USE

**First launch** asks one question — your currency — and never asks again. There
are no exchange rates and no conversion between currencies, ever.

**Add a vehicle** from the picker in the tab bar. Name it, and give it whatever
else you know; every field but the name is optional and all of them are editable
later.

**Log a fill-up** on the FUEL tab. *Quick add* asks three things — odometer,
volume, price — and fills in the rest: today's date, the vehicle's own fuel, and
a full tank. *Full form* asks everything.

> The **full-tank flag is a real field, not decoration.** Consumption is measured
> between consecutive full tanks, so mis-flagging one shifts the figures on both
> sides of it. A partial fill is counted into the tank that follows it.

**Log a cost** on the COSTS tab: choose the group, then the category. Periyodik
Bakım is not there — it has its own tab, because its records have a different
shape and live in a different file.

**Read the figures** on SUMMARY for the shape of things, CHARTS for how they
moved, and STATISTICS for the lifetime numbers — each of which states the window
it was computed over, because a statistic without its span is a number without
units.

**Change units, precision, language or palette** on SETTINGS. The files always
hold kilometres and litres whatever you choose; a unit is a way of looking, not a
way of writing.

**Your data is yours.** It is in `~/.local/share/tritium/`, in TOML, one
directory per vehicle. Back it up by copying that directory. The application
ships no backup, export or import feature, because it does not need one.



## 5. LICENCE SUMMARY

TRITIUM is free software under the **GNU General Public License, version 3 or later**
(`GPL-3.0-or-later`).

In plain terms: you may use it for anything, study how it works, share it with anyone, and
change it to suit yourself. If you distribute a changed version, it must carry this same
licence (or a later version of it) so that whoever receives it has the freedoms you had. It
comes with **no warranty**.

That is a summary and nothing more — the text that actually governs is the full
[`LICENSE`](LICENSE) file in this repository, and the same full text is readable inside the
application from the **About** page.

Copyright © sudo-megas · <https://github.com/sudo-megas/TRITIUM>

*Built with Reason and Passion.*
