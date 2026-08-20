package io.github.sudomegas.tritium.config

import dev.eav.tomlkt.Toml
import dev.eav.tomlkt.TomlElement
import dev.eav.tomlkt.TomlTable
import dev.eav.tomlkt.buildTomlTable
import io.github.sudomegas.tritium.storage.Units
import io.github.sudomegas.tritium.storage.unknownKeys
import io.github.sudomegas.tritium.storage.writeAtomically
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import java.io.File

/** The outcome of a load: always a usable config, plus whatever went wrong. */
data class ConfigLoad(
    val config: AppConfig,
    /**
     * Non-null when the file existed but could not be read or parsed. The
     * config is the default in that case — the app stays usable — but the
     * failure is carried out to the UI rather than logged and forgotten,
     * matching how the desktop's own storage layer treats a malformed record
     * file.
     */
    val error: String? = null,
)

/**
 * Reads and writes `settings.toml` on the phone.
 *
 * Takes its root directory by injection rather than a `Context` so the tests
 * are plain JVM JUnit against a temp directory — no Robolectric, no device.
 *
 * The shape mirrors the desktop's own `settings.toml` exactly where the two
 * genuinely share a concern: `schema_version` at the top (XTRITIUM §4.2), and
 * `[general] language` matching the desktop's key precisely (XTRITIUM §4.4).
 * That parity is deliberate, not incidental — XTRITIUM §3 principle 4, as
 * amended for AF1, describes the phone's copy as "TOML, parsed the same way"
 * as the desktop's, and a settings file with a different shape for the one
 * key both platforms already agree on would make that sentence false. The
 * `[units]` and `[format]` arrive with AF9, keyed exactly as the desktop's
 * own `settings-file.ts` keys them (`distance`/`volume`/`consumption`,
 * `decimals_consumption`) — minus `decimals_cost_per_km`, which AF9.md §1
 * records has no Android feature to read it. `[appearance]` arrives too, but
 * diverges on purpose: `theme_mode`/`dynamic_color`, not `palette` — AF6b.md
 * §1's own answer for what this setting means once native Material 3 is the
 * premise.
 */
class ConfigStore(root: File) {

    private val file = File(root, FILE_NAME)

    // explicitNulls = false is required, not a preference: TOML has no null
    // literal, and tomlkt's default emits `key = null` for an absent optional —
    // a file no TOML parser, including this one, will read back.
    private val toml = Toml {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    // currency and active_vehicle match the desktop's own settings-file.ts
    // key names exactly (AF3.md §2.1) — both optional, matching
    // src/shared/settings.ts's own "declared optional on purpose."
    @Serializable
    private data class GeneralSection(
        val language: String? = null,
        val currency: String? = null,
        val active_vehicle: String? = null,
    )

    @Serializable
    private data class UnitsSection(
        val distance: String? = null,
        val volume: String? = null,
        val consumption: String? = null,
    )

    @Serializable
    private data class FormatSection(
        val decimals_consumption: Int? = null,
    )

    @Serializable
    private data class AppearanceSection(
        val theme_mode: String? = null,
        val dynamic_color: Boolean? = null,
    )

    @Serializable
    private data class SettingsDto(
        val schema_version: Int = SCHEMA_VERSION,
        val general: GeneralSection? = null,
        val units: UnitsSection? = null,
        val format: FormatSection? = null,
        val appearance: AppearanceSection? = null,
    )

    /**
     * Every key the last [load] read that this build does not model, so
     * [save] can carry it forward — a settings.toml written by a different
     * build (a newer Android release, or restored from one) must not lose
     * `[format] decimals_cost_per_km` or a future `[appearance] palette`
     * the moment the maker changes any other setting. `EntryFile.kt`/
     * `VehicleFile.kt` already keep this promise for the record files; this
     * mirrors it for the one file that did not, and mirrors the desktop's
     * own `settings-file.ts` (`restOf`/`unknown`) doing the same.
     *
     * Refreshed on every [decode] — including the one [setAsideIfUnreadable]
     * runs internally before every [save] — so this stays correct even for
     * a caller that only ever calls [save] (there is exactly one in this
     * app, `ConfigState.update`): the file is re-read immediately before it
     * is rewritten, not assumed from whatever an earlier [load] once saw.
     */
    private data class CarriedUnknown(
        val top: Map<String, TomlElement> = emptyMap(),
        val general: Map<String, TomlElement> = emptyMap(),
        val units: Map<String, TomlElement> = emptyMap(),
        val format: Map<String, TomlElement> = emptyMap(),
        val appearance: Map<String, TomlElement> = emptyMap(),
    )

    private var carried = CarriedUnknown()

    fun load(): ConfigLoad {
        if (!file.exists()) return ConfigLoad(AppConfig())

        return try {
            ConfigLoad(decode(file.readText()))
        } catch (e: Exception) {
            // Defaults so the app still starts, and the message intact so the
            // UI can show it. Never a silent fallback.
            ConfigLoad(AppConfig(), "${file.name}: ${e.message ?: e::class.simpleName}")
        }
    }

    /** @throws Exception if the write fails; the caller surfaces it. */
    fun save(config: AppConfig) {
        setAsideIfUnreadable()

        val dto = SettingsDto(
            general = GeneralSection(
                language = config.language,
                currency = config.currency,
                active_vehicle = config.activeVehicleSlug,
            ),
            units = UnitsSection(
                distance = config.distanceUnit.token,
                volume = config.volumeUnit.token,
                consumption = config.consumptionUnit.token,
            ),
            format = FormatSection(decimals_consumption = config.decimalsConsumption),
            appearance = AppearanceSection(
                theme_mode = config.themeMode.token,
                dynamic_color = config.dynamicColor,
            ),
        )

        // Through the document model, not straight to text: the typed
        // encode alone has no room for a key this build does not declare,
        // so the carried-forward ones are merged into the table it would
        // have produced, section by section, before that table is rendered.
        val base = toml.encodeToTomlElement(SettingsDto.serializer(), dto) as TomlTable
        val merged = buildTomlTable {
            for ((key, value) in base) {
                val withCarried = when (key) {
                    "general" -> mergeSection(value, carried.general)
                    "units" -> mergeSection(value, carried.units)
                    "format" -> mergeSection(value, carried.format)
                    "appearance" -> mergeSection(value, carried.appearance)
                    else -> value
                }
                element(key, withCarried)
            }
            for ((key, value) in carried.top) element(key, value)
        }
        writeAtomically(file, toml.encodeToString(TomlTable.serializer(), merged))
    }

    /** [section]'s own entries, plus whatever [extra] carries — [extra] never overrides a known key. */
    private fun mergeSection(section: TomlElement, extra: Map<String, TomlElement>): TomlTable {
        val known = (section as? TomlTable)?.entries?.associate { it.key to it.value } ?: emptyMap()
        return buildTomlTable {
            for ((key, value) in known) element(key, value)
            for ((key, value) in extra) if (key !in known) element(key, value)
        }
    }

    /** A sub-table's unrecognised keys, or empty when the table is absent entirely. */
    private fun sectionRest(document: TomlTable, name: String, known: Set<String>): Map<String, TomlElement> =
        (document[name] as? TomlTable)?.let { unknownKeys(it, known) } ?: emptyMap()

    private fun decode(text: String): AppConfig {
        // The BOM is stripped rather than tolerated: this parser rejects a
        // leading U+FEFF outright, and a settings.toml that gains one from an
        // editor is otherwise valid and would be set aside as broken when it
        // is not.
        val cleaned = text.removePrefix(BOM)
        val dto = toml.decodeFromString<SettingsDto>(cleaned)

        // A second, independent parse purely to see what the typed decode
        // above discarded — parseToTomlTable never throws on a key
        // decodeFromString already accepted, so this cannot turn a
        // previously-successful load into a failure.
        val document = toml.parseToTomlTable(cleaned)
        carried = CarriedUnknown(
            top = unknownKeys(document, TOP_KNOWN),
            general = sectionRest(document, "general", GENERAL_KNOWN),
            units = sectionRest(document, "units", UNITS_KNOWN),
            format = sectionRest(document, "format", FORMAT_KNOWN),
            appearance = sectionRest(document, "appearance", APPEARANCE_KNOWN),
        )

        return AppConfig(
            language = dto.general?.language ?: AppConfig.DEFAULT_LANGUAGE,
            // No fallback for either — an absent currency is the signal
            // the first-run question fires on (AF3.md §2.1), and a
            // stray active_vehicle from a deleted vehicle is simply not
            // there for the picker to find.
            currency = dto.general?.currency,
            activeVehicleSlug = dto.general?.active_vehicle,
            // An unrecognised or missing token falls back to the metric
            // default (AF9.md §4 acceptance criterion 6) — Units.*Of mirrors
            // the desktop's own isDistanceUnit/isVolumeUnit/isConsumptionUnit
            // type guards, which do the same rather than raising.
            distanceUnit = Units.distanceUnitOf(dto.units?.distance),
            volumeUnit = Units.volumeUnitOf(dto.units?.volume),
            consumptionUnit = Units.consumptionUnitOf(dto.units?.consumption),
            decimalsConsumption = validDecimals(dto.format?.decimals_consumption),
            themeMode = ThemeMode.of(dto.appearance?.theme_mode),
            dynamicColor = dto.appearance?.dynamic_color ?: true,
        )
    }

    /** A small non-negative integer, or the default — mirrors `readDecimals` (`settings.ts`). */
    private fun validDecimals(value: Int?): Int =
        if (value != null && value in 0..6) value else AppConfig.DEFAULT_DECIMALS_CONSUMPTION

    /**
     * Move a `settings.toml` this app cannot read out of the way, rather than
     * writing defaults over it.
     *
     * [load] answers a broken file with defaults so the app still starts — and
     * the next setting the maker touches would otherwise write those defaults
     * straight over the file, taking whatever it held with it. Moving aside
     * instead of deleting matches the desktop's own storage discipline: never
     * erase, put it somewhere it can still be read.
     *
     * Asked at save time rather than remembered from [load], so it holds
     * however this store is called, including without a load first.
     */
    private fun setAsideIfUnreadable() {
        if (!file.exists()) return
        if (runCatching { decode(file.readText()) }.isSuccess) return

        val rescued = rescuePath()
        // A rename is one syscall and keeps no second copy. If it fails, a copy
        // is enough — the write below replaces the original either way. If BOTH
        // fail this throws, and not writing is the right outcome: the caller
        // surfaces it, and nothing was destroyed to get there.
        if (!file.renameTo(rescued)) file.copyTo(rescued)
    }

    /** `settings.toml.broken`, then `-2`: a second break never lands on the first. */
    private fun rescuePath(): File {
        var candidate = File(file.parentFile, "$FILE_NAME$BROKEN_SUFFIX")
        var n = 2
        while (candidate.exists()) {
            candidate = File(file.parentFile, "$FILE_NAME$BROKEN_SUFFIX-$n")
            n += 1
        }
        return candidate
    }

    companion object {
        const val FILE_NAME = "settings.toml"

        /** Matches the desktop's own settings.toml (XTRITIUM §4.2, §4.4). */
        const val SCHEMA_VERSION = 1

        /** What an unreadable `settings.toml` is renamed to instead of being replaced. */
        const val BROKEN_SUFFIX = ".broken"

        /** Escaped rather than typed: a literal BOM in this file would be invisible. */
        private const val BOM = "\uFEFF"

        /** Every key each section's own `@Serializable` DTO declares \u2014 [SettingsDto]'s field names, by hand, since annotation reflection is not worth pulling in for four small sets. */
        private val TOP_KNOWN = setOf("schema_version", "general", "units", "format", "appearance")
        private val GENERAL_KNOWN = setOf("language", "currency", "active_vehicle")
        private val UNITS_KNOWN = setOf("distance", "volume", "consumption")
        private val FORMAT_KNOWN = setOf("decimals_consumption")
        private val APPEARANCE_KNOWN = setOf("theme_mode", "dynamic_color")
    }
}
