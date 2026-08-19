package io.github.sudomegas.tritium

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import io.github.sudomegas.tritium.config.ConfigState
import io.github.sudomegas.tritium.config.ConfigStore
import io.github.sudomegas.tritium.storage.TritiumPaths
import io.github.sudomegas.tritium.storage.VehicleRepository

/**
 * Holds the one [ConfigState] for the process, so the Activity and any future
 * ViewModel read the same `settings.toml`-backed flow rather than each
 * re-reading the file (AF1.md §2.1 decision 5). Holds the one
 * [VehicleRepository] for the same reason, from AF3.
 *
 * The stored language is applied to [AppCompatDelegate] here, in [onCreate],
 * rather than left for `MainActivity` — XTRITIUM §3 principle 6 forbids
 * reading the system locale, and the language must already be in force before
 * any screen inflates, not applied reactively after the fact. `settings.toml`
 * is a few bytes; loading it synchronously on the application's own `onCreate`
 * costs nothing an Android app would notice and avoids a visible flash of the
 * wrong language on a cold start.
 */
class TritiumApplication : Application() {

    lateinit var configStore: ConfigStore
        private set

    lateinit var configState: ConfigState
        private set

    lateinit var vehicleRepository: VehicleRepository
        private set

    override fun onCreate() {
        super.onCreate()

        configStore = ConfigStore(filesDir)
        val load = configStore.load()
        configState = ConfigState(configStore, load)
        vehicleRepository = VehicleRepository(TritiumPaths(filesDir))

        applyLocale(load.config.language)
    }

    /** Also called from Settings whenever the maker changes the language. */
    fun applyLocale(languageTag: String) {
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(languageTag))
    }
}
