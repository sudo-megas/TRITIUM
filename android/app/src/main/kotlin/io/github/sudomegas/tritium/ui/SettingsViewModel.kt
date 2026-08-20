package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.config.AppConfig
import io.github.sudomegas.tritium.config.ThemeMode
import io.github.sudomegas.tritium.storage.Bundle
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.ImportResult
import io.github.sudomegas.tritium.storage.Units.ConsumptionUnit
import io.github.sudomegas.tritium.storage.Units.DistanceUnit
import io.github.sudomegas.tritium.storage.Units.VolumeUnit
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(private val app: TritiumApplication) : ViewModel() {

    val config: StateFlow<AppConfig> = app.configState.config
    val error: StateFlow<String?> = app.configState.error

    /**
     * XTRITIUM §3 principle 6: manual, instant, never inferred from the OS.
     * Persists to `settings.toml` and re-applies the AppCompat locale in the
     * same action, so the two can never drift apart from each other.
     */
    fun setLanguage(languageTag: String) {
        viewModelScope.launch {
            app.configState.update { it.copy(language = languageTag) }
        }
        app.applyLocale(languageTag)
    }

    /**
     * XTRITIUM §8: asked once, at first launch, fixed forever. `code`
     * absent-to-present is the only transition this ever makes — nothing
     * calls this a second time, because nothing offers to (AF3.md §2, item
     * 2 — no settings screen changes it either).
     */
    fun setCurrency(code: String) {
        viewModelScope.launch {
            app.configState.update { it.copy(currency = code) }
        }
    }

    fun clearError() = app.configState.clearError()

    // AF9 — units, precision, appearance. Each setter writes settings.toml
    // through the same configState.update the language/currency setters
    // above already use; the unit boundary itself (Units.kt) never touches
    // config, so a switch here only ever changes what a figure is SHOWN as.
    fun setDistanceUnit(unit: DistanceUnit) {
        viewModelScope.launch { app.configState.update { it.copy(distanceUnit = unit) } }
    }

    fun setVolumeUnit(unit: VolumeUnit) {
        viewModelScope.launch { app.configState.update { it.copy(volumeUnit = unit) } }
    }

    fun setConsumptionUnit(unit: ConsumptionUnit) {
        viewModelScope.launch { app.configState.update { it.copy(consumptionUnit = unit) } }
    }

    fun setDecimalsConsumption(decimals: Int) {
        viewModelScope.launch { app.configState.update { it.copy(decimalsConsumption = decimals.coerceIn(0, 6)) } }
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { app.configState.update { it.copy(themeMode = mode) } }
    }

    fun setDynamicColor(enabled: Boolean) {
        viewModelScope.launch { app.configState.update { it.copy(dynamicColor = enabled) } }
    }

    /**
     * Every vehicle the phone has, one bundle (AF8.md §1.2) — F16's own
     * format, unchanged, so the desktop's real `importBundle` reads it with
     * no Android-specific handling at all.
     *
     * One unreadable vehicle is skipped, not fatal to the whole export
     * (matches [io.github.sudomegas.tritium.storage.VehicleRepository.vehicleNames]'s
     * own precedent for the same failure). `loadVehicle` parses all four of
     * a vehicle's files eagerly and throws on any one of them; the moment a
     * file goes bad is exactly the moment the maker needs the OTHER
     * vehicles to still leave the device — `filesDir` is not reachable
     * without root, so export is the only way out at all. AF12 audit
     * finding — [io.github.sudomegas.tritium.storage.Bundle]'s own "a
     * vehicle this build cannot parse is skipped" guard could never fire
     * before this, since [loadVehicle] never returned to let it.
     */
    fun exportBundle(): String {
        val slugs = app.vehicleRepository.listVehicleSlugs()
        val vehicles = slugs.mapNotNull { slug ->
            runCatching { app.vehicleRepository.loadVehicle(slug) }.getOrNull()
        }
        return Bundle.build(vehicles, Format.todayIso())
    }

    /**
     * AF9b — the other direction. Throws [io.github.sudomegas.tritium.storage.BundleError]
     * for a refused bundle; the caller reports it, nothing here catches it.
     *
     * A fresh phone (no vehicle active yet) is left on the first vehicle
     * the bundle touches — [io.github.sudomegas.tritium.ui.HomeViewModel.createVehicle]'s
     * own precedent, "the obvious thing to switch to" when nothing else is
     * active — never overriding a vehicle already in use.
     */
    fun importBundle(text: String): ImportResult {
        val result = app.vehicleRepository.importBundle(text)
        if (app.configState.config.value.activeVehicleSlug == null) {
            result.vehicles.firstOrNull()?.let { first ->
                viewModelScope.launch { app.configState.update { it.copy(activeVehicleSlug = first.slug) } }
            }
        }
        return result
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                SettingsViewModel(app) as T
        }
    }
}
