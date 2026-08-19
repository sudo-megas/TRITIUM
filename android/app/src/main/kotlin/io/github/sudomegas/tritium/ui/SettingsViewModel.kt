package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.config.AppConfig
import io.github.sudomegas.tritium.storage.Bundle
import io.github.sudomegas.tritium.storage.Format
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

    /**
     * Every vehicle the phone has, one bundle (AF8.md §1.2) — F16's own
     * format, unchanged, so the desktop's real `importBundle` reads it with
     * no Android-specific handling at all.
     */
    fun exportBundle(): String {
        val slugs = app.vehicleRepository.listVehicleSlugs()
        val vehicles = slugs.map { app.vehicleRepository.loadVehicle(it) }
        return Bundle.build(vehicles, Format.todayIso())
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                SettingsViewModel(app) as T
        }
    }
}
