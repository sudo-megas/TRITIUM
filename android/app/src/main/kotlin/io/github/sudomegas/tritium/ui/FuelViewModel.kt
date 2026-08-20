package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.storage.FuelDraft
import io.github.sudomegas.tritium.storage.FuelEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.withContext

/**
 * Owns the active vehicle's fuel entries for the Fuel tab (AF4.md §1.1 —
 * "decided with you"). Mirrors [HomeViewModel]'s own shape deliberately:
 * `activeVehicleSlug` derived independently from `configState.config`
 * rather than shared from `HomeViewModel` — each screen's ViewModel stays
 * self-sufficient, the same independence `SettingsViewModel`/
 * `HomeViewModel` already have from each other (AF4.md §2.1 decision 5).
 *
 * [fuelEntries] is a snapshot taken on [refresh], never a cache — the same
 * reasoning AF2.md §1 already gave for `VehicleRepository` itself and
 * [HomeViewModel] already applies to the active vehicle's own record.
 */
class FuelViewModel(private val app: TritiumApplication) : ViewModel() {

    val activeVehicleSlug: StateFlow<String?> = app.configState.config
        .map { it.activeVehicleSlug }
        .stateIn(viewModelScope, SharingStarted.Eagerly, app.configState.config.value.activeVehicleSlug)

    private val _fuelEntries = MutableStateFlow<List<FuelEntry>>(emptyList())
    val fuelEntries: StateFlow<List<FuelEntry>> = _fuelEntries.asStateFlow()

    /**
     * Re-read the active vehicle's fuel entries from disk, highest odometer
     * first. `suspend`, dispatched to [Dispatchers.IO] — the repository does
     * synchronous file I/O and this is called from [FuelScreen]'s own
     * composition (`LaunchedEffect(Unit)`), which runs on the main thread
     * otherwise. AF12 audit finding.
     */
    suspend fun refresh() {
        val slug = activeVehicleSlug.value
        _fuelEntries.value = if (slug == null) {
            emptyList()
        } else {
            withContext(Dispatchers.IO) {
                runCatching { app.vehicleRepository.loadVehicle(slug).fuel.entries }.getOrDefault(emptyList())
            }.sortedWith(compareByDescending<FuelEntry> { it.odometerKm }.thenByDescending { it.id })
        }
    }

    /** The vehicle's own `fuel_spec` — quick-add's silent fuel-type default. */
    suspend fun activeVehicleFuelSpec(): String {
        val slug = activeVehicleSlug.value ?: return ""
        return withContext(Dispatchers.IO) {
            runCatching { app.vehicleRepository.loadVehicle(slug).vehicle?.vehicle?.fuelSpec }.getOrNull()
        } ?: ""
    }

    /**
     * The form's edit-mode load — a one-off read, not the [fuelEntries]
     * snapshot: this ViewModel may be freshly recreated (process death)
     * while a form sits on top of the back stack, with nothing in
     * [fuelEntries] yet because [FuelScreen]'s own `refresh()` never
     * composed. Falling back to "not found" there silently discarded a
     * real edit while [FuelFormScreen] still reported success. AF12 audit
     * finding — CRITICAL.
     */
    suspend fun entry(id: String): FuelEntry? {
        val slug = activeVehicleSlug.value ?: return null
        return withContext(Dispatchers.IO) {
            runCatching { app.vehicleRepository.loadVehicle(slug).fuel.entries }.getOrDefault(emptyList())
        }.firstOrNull { it.id == id }
    }

    /**
     * The highest odometer reading across both `fuel.toml` and
     * `service.toml` (AF6.md §1.2) — a one-off repository read at
     * form-open time, the same shape [activeVehicleFuelSpec] already uses
     * for a single derived field.
     */
    suspend fun previousOdometer(): Int? {
        val slug = activeVehicleSlug.value ?: return null
        val serviceEntries = withContext(Dispatchers.IO) {
            runCatching { app.vehicleRepository.loadVehicle(slug).service.entries }.getOrDefault(emptyList())
        }
        return FuelDraft.highestOdometer(fuelEntries.value, serviceEntries)
    }

    /** Add-only — quick-add's path. Allocates the id in the repository, as F4's own `fuel:add` does. */
    suspend fun addFuelEntry(entry: (id: String) -> FuelEntry): FuelEntry? {
        val slug = activeVehicleSlug.value ?: return null
        val added = withContext(Dispatchers.IO) { app.vehicleRepository.addFuelEntry(slug, entry) }
        refresh()
        return added
    }

    /** The full form's edit path — replaces one entry in place, by id. */
    suspend fun updateFuelEntry(entry: FuelEntry): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val updated = withContext(Dispatchers.IO) { app.vehicleRepository.updateFuelEntry(slug, entry) }
        refresh()
        return updated
    }

    /** One record at a time (AF7.md §3) — the list's own delete-with-confirm. */
    suspend fun removeFuelEntry(id: String): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val removed = withContext(Dispatchers.IO) { app.vehicleRepository.removeFuelEntry(slug, id) }
        refresh()
        return removed
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = FuelViewModel(app) as T
        }
    }
}
