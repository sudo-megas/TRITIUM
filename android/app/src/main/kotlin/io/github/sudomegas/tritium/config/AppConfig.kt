package io.github.sudomegas.tritium.config

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
 * `units`, `format` and `appearance` — the rest of the desktop's own
 * settings.toml shape — still arrive later: units with the design phase,
 * appearance with the design phase before AF7. Adding empty placeholders for
 * them now would be exactly the kind of feature this app does not build
 * ahead of the milestone that needs it.
 */
data class AppConfig(
    val language: String = DEFAULT_LANGUAGE,
    val currency: String? = null,
    val activeVehicleSlug: String? = null,
) {
    companion object {
        const val DEFAULT_LANGUAGE = "en"
    }
}
