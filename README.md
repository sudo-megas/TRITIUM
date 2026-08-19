<p align="center" width="100%">
    <img width="33%" src="build/icons/512.png">
</p>

<h1 align="center">TRITIUM</h1>

<p align="center">
  <img alt="Version"      src="https://img.shields.io/badge/version-v0.2.6-3A6B9C?style=for-the-badge">
  <img alt="Release date" src="https://img.shields.io/badge/released-19--08--2026-3A6B9C?style=for-the-badge">
  <img alt="Licence"      src="https://img.shields.io/badge/licence-GPL--3.0--or--later-6E7B8B?style=for-the-badge">
</p>

<p align="center">
  <img alt="Arch Linux"    src="https://img.shields.io/badge/Arch%20Linux-~136%20MiB-1793D1?style=for-the-badge&logo=archlinux&logoColor=white">
  <img alt="Android"       src="https://img.shields.io/badge/Android-planned-3DDC84?style=for-the-badge&logo=android&logoColor=white">
</p>

<p align="center"><strong>Fuel Logging / Maintenance Tracking for any ICE Vehicle</strong></p>
<p align="center"><strong>Her İçten Yanmalı Araç için Yakıt Kaydı / Bakım Takibi</strong></p>



## 1. DESCRIPTION

TRITIUM is an offline journal of what your vehicle costs to run — fuel, expenses and periodic
service, for as many vehicles as you own. Your data is plaintext TOML in your own home directory,
editable by hand. Nothing is estimated, and nothing leaves the machine: it contains no network code.



## 2. DEPENDENCIES

**To run** — from the official Arch repositories:

```
alsa-lib  at-spi2-core  gtk3  libcups  libnotify  libxss  libxtst  nss
```

Electron ships inside the package; the list above is the desktop stack it links against.

**To build** — additionally `git`, `nodejs` and `npm`.

TRITIUM targets **Arch Linux** in this phase. Android is planned as a separate rewrite.



## 3. INSTALLATION

### 3.A Build From Source

Runs it straight from the checkout, without root and without a package:

```sh
git clone https://github.com/sudo-megas/TRITIUM.git
cd TRITIUM
npm ci
npm run dev
```

To produce the unpacked application tree instead of running the dev server:

```sh
npm run build
npx electron-builder --linux dir
./release/linux-unpacked/tritium
```

### 3.B Arch Linux

Builds the real package in a clean chroot and installs it:

```sh
git clone https://github.com/sudo-megas/TRITIUM.git
cd TRITIUM/packaging
extra-x86_64-build
sudo pacman -U tritium-*.pkg.tar.zst
```

**There is no AUR package.** Packages are signed and published by hand.
`packaging/README.md` carries the full procedure.



## 4. HOW TO USE? WHAT IS THE APPLICATION SECTIONS?

The first launch asks one question — your currency — and never asks again. Add a vehicle from
the picker in the tab bar; only its name is required, and everything is editable afterwards.
The eight tabs below are the whole application.

### SUMMARY

The page you open on. Cards for the vehicle, this month against last month, lifetime totals,
and the most recent entries drawn from all three files at once. It shows and never asks:
there is nothing here to change.

### FUEL

Logs a fill-up. *Quick add* takes the three figures you have at the pump — odometer, volume,
price — and fills in the rest. *Full form* takes everything.

> The **full-tank flag is a real field, not decoration.** Consumption is measured between
> consecutive full tanks, so mis-flagging one moves the figures on both sides of it.

### COSTS

Everything that is not fuel and not periodic service. Pick the group, then the category: **İLK
ALIŞ** for buying the car (deposit, price, notary, plates), **TEKRAR EDEN** for what comes round
again (MTV, trafik sigortası, kasko), and **MANUAL** for a category you type yourself. Payment
method, bank and instalment are three separate fields rather than one remark column. Refunds and
payouts are entered as income and subtract from your totals.

### SERVICE

Periyodik Bakım, kept apart from costs because its records have a different shape: what was
done, at what odometer reading, for how much, and where it was done. The vendor is plain text —
type whatever the receipt says.

### CHARTS

Seven charts over a range you choose: fuel consumption, monthly costs, gas price, fill-up costs,
odometer, cost per kilometre and monthly distance. Each one is drawn from your entries only,
so a gap in the data is drawn as a gap.

### STATISTICS

The lifetime numbers: best and worst tank, distance per day, projected annual cost, and true
cost per kilometre including what the vehicle cost to buy. Every figure states the window it
was computed over, because a statistic without its span is a number without units.

### SETTINGS

Language (English or Turkish), eleven palettes, and units — km or miles, litres or gallons,
l/100km, km/l or mpg — each chosen independently of the others. The files always hold kilometres
and litres whatever you pick: a unit is a way of looking, not a way of writing.

**Import** is here too. Point it at a file the phone wrote and it brings the month across:
records you already have are skipped, so importing the same file twice changes nothing, and
whatever it is about to overwrite is copied into `backups/` first.

### ABOUT

The mark, the maker, the version and release date, the source address, and the full licence
text. Addresses here are selectable text and never links — TRITIUM opens no browser.

> **Your data is yours.** It lives in `~/.local/share/tritium/`, one directory per vehicle, in
> TOML. Back it up by copying that directory. TRITIUM imports but does not export — the phone
> is what writes a file, and this is what reads it.



## 5. LICENCE SUMMARY

TRITIUM is free software under the **GNU General Public License, version 3 or later**
(`GPL-3.0-or-later`).

In plain terms: use it for anything, study how it works, share it with anyone, and change it to
suit yourself. If you pass on a changed version it must carry this same licence, so whoever
receives it has the freedoms you had. It comes with **no warranty**.

This is a summary only. The text that governs is the full [`LICENSE`](LICENSE) file, readable
inside the application from the **ABOUT** page.

Copyright © sudo-megas · <https://github.com/sudo-megas/TRITIUM>

*Built with Reason and Passion.*
