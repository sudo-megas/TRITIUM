# AF9 — TRITIUM Android · «Settings complete»

## Context

AF1.md's own AF-map line: *"Settings complete + hardening — units, precision,
palette (post-design-phase), heavy test pass."* Every milestone since AF4 has
deferred to this one by name — AF4's `FuelFormScreen`, AF6's `ServiceFormScreen`,
AF7's list screens, AF8's export — all display and accept whole kilometres and
litres because AF9 is where units become real. F11.md, the desktop's own
milestone that did this first, states the rule this inherits whole: *"F11 owns
units whole — entry as well as display… half a unit system is worse than a
deferred one."*

Two open questions were recorded ahead of this milestone, by name, and both are
answered here rather than re-litigated:

- **AF6b.md §1**, "What AF9's palette setting means": *"A light/dark/system
  toggle, and whether to allow dynamic colour, is the true shape once native M3
  is the premise — not a picker over the desktop's eleven palettes."* AF6b
  closed the identity fork; this milestone builds the setting AF6b named.
- **AF7.md §1.4/§3**: no Android AF slot exists for F10's true-cost-per-km or
  projections. `decimals_cost_per_km` (`src/shared/settings.ts`) formats a
  figure Android does not compute and nowhere shows. A precision setting for a
  figure that never renders is a setting for nothing.

## §1 WHERE AF9 SITS

| Decision | Answer | Source |
|---|---|---|
| Units | The full boundary — distance (km/mi), volume (l/gal), consumption (l/100km, km/l, mpg) — ported function-for-function from `src/shared/units.ts` and paired with settings the same way `src/renderer/state/units.ts`'s `useUnits()` hook does | F11, both files quoted below |
| Precision | `decimals_consumption` only, default 2 (`DEFAULT_SETTINGS.decimals_consumption`) | `settings.ts` |
| `decimals_cost_per_km` | Cut. No Android feature reads a cost-per-km figure | AF7.md §1.4/§3, this doc's Context |
| Palette | `theme_mode` (system / light / dark) + `dynamic_color` (on/off), replacing the desktop's eleven-palette picker outright, not offering it alongside | AF6b.md §1, quoted above |
| `payment_methods` editing | Cut — the fixed three-item list (`Records.kt:PAYMENT_METHODS`) is unchanged | Not named in AF1.md's own one-line AF9 description; `costPaymentMethodLabel` looks up a fixed, translated token per entry, and making the list free-text would mean redesigning that lookup, not just unlocking it — a second milestone's shape, not this one's |
| `settings.toml` shape | `[units]` mirrors the desktop's table and keys exactly (`distance`/`volume`/`consumption`); `[format]` carries `decimals_consumption` alone; `[appearance]` diverges on purpose — `theme_mode`/`dynamic_color`, not `palette` | `settings-file.ts`'s own `TABLES`/`OWNED` shape; `ConfigStore.kt`'s established precedent that a section's shape follows the feature, not desktop parity for its own sake |
| Tank capacity | Volume-converted like litres, but always shown/read at `TANK_DECIMALS` (1), never `PUMP_DECIMALS` (3) | `state/units.ts`'s own `tank`/`parseTank`, which apply `showVolume`/`readVolume` at `TANK_DECIMALS` — the conversion ratio is scale-agnostic, only the *decimal count differs* by field |
| Symbols (`km`, `mi`, `l`, `gal`, `l/100km`, `km/l`, `mpg`) | Plain Kotlin constants, not string resources | `units.ts`'s own explicit reasoning: *"notation, like ₺ and like the digits themselves"* — `audit-strings`'s Android counterpart must not be asked to police them |
| The engine boundary | `Consumption.consumptionById`/`consumptionPoints` keep taking raw, unfiltered, **unconverted** kilometre/litre entries — unit conversion happens only where a figure is displayed or a form is parsed, never inside the engine | AF4.md/AF7.md's own correctness rule, extended rather than reopened: a converted figure fed back into the engine would be exactly the "range decides what's shown, never what's computed" bug in a new unit |
| The discriminating test | *"Switching to miles and back leaves every file byte-identical, and a test asserts exactly that"* — a JVM test converting a wide spread of odometer readings to miles and back, asserting the round-tripped kilometre figure is unchanged | `units.ts`'s own stated invariant, quoted verbatim |

**The one figure worth stating precisely, because it is the whole reason miles
carry a decimal:** `DISTANCE_DECIMALS = { km: 0, mi: 1 }`. Kilometres store
whole; miles measured over 0–300 000 km round-trip incorrectly for 37.9% of
values at zero decimals, so miles are *shown* one decimal finer than the metre
underneath them. The Kotlin port keeps this comment, not just the constant.

## §2 SCOPE IN

| Path | What |
|---|---|
| `storage/Units.kt` | **new** — `DistanceUnit`/`VolumeUnit`/`ConsumptionUnit` enums, `KM_PER_MILE`/`LITRES_PER_US_GALLON`/`MPG_CONSTANT`, `DISTANCE_DECIMALS`, `show*`/`read*` for distance/volume/pricePerVolume, `showConsumption` (null at zero, ×1000-scaled like the engine's own figures — cut to display precision via the existing `Consumption.consumptionAt`), the three symbol maps |
| `config/AppConfig.kt` | **modified** — `distanceUnit`, `volumeUnit`, `consumptionUnit`, `decimalsConsumption` (default 2), `themeMode` (`ThemeMode.SYSTEM`/`LIGHT`/`DARK`), `dynamicColor` (default true) |
| `config/ConfigStore.kt` | **modified** — `[units]`, `[format]` (`decimals_consumption` only), `[appearance]` (`theme_mode`/`dynamic_color`) sections; unrecognised/missing tokens fall back to the metric default, mirroring `isDistanceUnit` et al. |
| `ui/theme/TritiumTheme.kt` | **modified** — reads `themeMode`/`dynamicColor` from `AppConfig` instead of always following the system and always allowing dynamic colour |
| `ui/screens/SettingsScreen.kt` | **modified** — a Units section (three pickers + a decimals stepper) and an Appearance section (theme-mode chips + a dynamic-colour switch), between Language and Export |
| `ui/screens/FuelScreen.kt`, `FuelFormScreen.kt`, `FuelQuickAddScreen.kt`, `ServiceScreen.kt`, `ServiceFormScreen.kt`, `HomeScreen.kt`, `VehicleFormScreen.kt` | **modified** — every displayed/typed distance, volume, price-per-volume, consumption and tank-capacity figure routes through `Units` at the config's current settings |
| `res/values{,-tr}/strings.xml` | **modified** — `fuel_previous_odometer`/`fuel_backwards` gain a unit-symbol format arg (were hardcoded to `km`); Settings section labels added |
| `test/.../storage/UnitsTest.kt` | **new** — the byte-identical round trip (a wide odometer spread, km → mi → km), `showConsumption` returning null at zero for `kml`/`mpg`, the F16-style worked examples for volume/price-per-volume/consumption conversion |
| `test/.../config/ConfigStoreTest.kt` | **modified** — `[units]`/`[format]`/`[appearance]` round-trip, malformed/missing tokens fall back to defaults, an AF1-era file with none of these sections still loads |
| `androidTest/.../UnitsFlowTest.kt` | **new** — switching to miles on a seeded vehicle changes the Fuel list's odometer display and does not touch the underlying record |

## §3 SCOPE OUT

- **`decimals_cost_per_km`** — no Android feature reads it (§1, Context).
- **Editable `payment_methods`** — the fixed three stay fixed (§1).
- **The eleven-palette picker** — superseded outright by AF6b.md's decision, not offered as an alternative.
- **True cost-per-km, projections, charts** — still no Android AF slot; unchanged by this milestone (AF7.md's own recorded gap).
- **Imperial gallon** — `units.ts` itself never added a second gallon setting; neither does this port.

## §4 ACCEPTANCE CRITERIA

1. Settings offers distance/volume/consumption pickers, a decimals-consumption control, a theme-mode choice, and a dynamic-colour toggle.
2. Switching a unit updates every screen's displayed figures immediately: Fuel/Service odometer, Fuel litres/price/consumption, Home's lifetime distance/litres/last price/consumption, the vehicle form's tank capacity.
3. `fuel.toml`/`service.toml`/`vehicle.toml` never change shape or value from a unit switch — proved by `UnitsTest`'s round trip, not just asserted.
4. Theme mode restyles the app; dynamic colour toggles Material You where the OS supports it (API 31+) and has no effect below it.
5. `settings.toml` round-trips `[units]`/`[format]`/`[appearance]`; a pre-AF9 file with none of them still loads to the metric/system defaults.
6. A malformed or unrecognised unit token in `settings.toml` falls back to its default rather than crashing the load.
7. `Consumption.consumptionById`'s engine input is never unit-converted — conversion happens only at display/parse.
8. Local build (`check assembleDebug assembleDebugAndroidTest`) green, CI green, on-device confirmation of a real unit switch against seeded data.

## §5 EXIT

Untagged (0.9). AF10 is signing, the release workflow, and the tag — the
maker's own standing instruction stops autonomous work here, before AF10
begins, for a plan-mode check-in rather than proceeding straight through.
