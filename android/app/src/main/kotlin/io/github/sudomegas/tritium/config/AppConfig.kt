package io.github.sudomegas.tritium.config

/**
 * Everything `settings.toml` holds, on the phone, for AF1.
 *
 * [language] is the only field this milestone needs (AF1.md §2.1 decision 8),
 * but it is owned from AF1 rather than left for later for the same reason the
 * desktop's own settings.toml owns it from F1: XTRITIUM §3 principle 6
 * forbids reading the system locale, and on Android that is not a default
 * inherited for free — resource resolution follows the system locale the
 * moment a values-tr/ directory exists. The English default has to be
 * recorded explicitly on first run and re-applied at every process start, or
 * the app silently speaks Turkish on a Turkish phone the instant values-tr/
 * is added, which is exactly what principle 6 forbids.
 *
 * `currency`, `units`, `format` and `appearance` — the rest of the desktop's
 * own settings.toml shape (XTRITIUM §4.4) — arrive with the milestones that
 * give them meaning: currency and units with vehicles (AF3), appearance with
 * the design phase before AF7. Adding empty placeholders for them now would
 * be exactly the kind of feature this app does not build ahead of the
 * milestone that needs it.
 */
data class AppConfig(
    val language: String = DEFAULT_LANGUAGE,
) {
    companion object {
        const val DEFAULT_LANGUAGE = "en"
    }
}
