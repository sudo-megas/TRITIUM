package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.config.AppConfig
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

    fun clearError() = app.configState.clearError()

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                SettingsViewModel(app) as T
        }
    }
}
