package io.github.sudomegas.tritium.config

import io.github.sudomegas.tritium.storage.Units.ConsumptionUnit
import io.github.sudomegas.tritium.storage.Units.DistanceUnit
import io.github.sudomegas.tritium.storage.Units.VolumeUnit

/**
 * Everything `settings.toml` holds, on the phone.
 *
 * [language] is owned from AF1 for the reason recorded there: XTRITIUM §3
 * principle 6 forbids reading the system locale, and the English default has
 * to be recorded explicitly and re-applied at every process start.
 *
 * [currency] and [activeVehicleSlug] arrive with AF3, both nullable and both
 * absent by default — mirroring the desktop's own `Settings` interface
 * exactly (`src/shared/settings.ts`), where both are declared optional on
 * purpose. [currency] absent is not a placeholder waiting to be filled; it
 * is literally the signal the first-run currency question (XTRITIUM §8)
 * fires on. A stored default would answer the question before it was asked.
 *
 * [distanceUnit]/[volumeUnit]/[consumptionUnit]/[decimalsConsumption] arrive
 * with AF9, matching the desktop's own `[units]`/`[format]` defaults
 * (`DEFAULT_SETTINGS` — metric, `l100km`, 2 decimals). No
 * `decimalsCostPerKm`: AF7.md recorded no Android feature that would ever
 * read one (AF9.md §1). [themeMode]/[dynamicColor] answer AF6b.md's own
 * recorded question about what AF9's "palette" setting means once native
 * Material 3 is the premise — not the desktop's eleven-palette picker.
 */
data class AppConfig(
    val language: String = DEFAULT_LANGUAGE,
    val currency: String? = null,
    val activeVehicleSlug: String? = null,
    val distanceUnit: DistanceUnit = DistanceUnit.KM,
    val volumeUnit: VolumeUnit = VolumeUnit.L,
    val consumptionUnit: ConsumptionUnit = ConsumptionUnit.L100KM,
    val decimalsConsumption: Int = DEFAULT_DECIMALS_CONSUMPTION,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val dynamicColor: Boolean = true,
) {
    companion object {
        const val DEFAULT_LANGUAGE = "en"
        const val DEFAULT_DECIMALS_CONSUMPTION = 2
    }
}

/** AF6b.md §1's answer to what AF9's palette setting means — not a picker. */
enum class ThemeMode(val token: String) {
    SYSTEM("system"), LIGHT("light"), DARK("dark");

    companion object {
        fun of(token: String?): ThemeMode = entries.firstOrNull { it.token == token } ?: SYSTEM
    }
}
