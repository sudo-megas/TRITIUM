package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.storage.FuelEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

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

    /** Re-read the active vehicle's fuel entries from disk. */
    fun refresh() {
        val slug = activeVehicleSlug.value
        _fuelEntries.value = if (slug == null) {
            emptyList()
        } else {
            runCatching { app.vehicleRepository.loadVehicle(slug).fuel.entries }.getOrDefault(emptyList())
        }
    }

    /** The vehicle's own `fuel_spec` — quick-add's silent fuel-type default. */
    fun activeVehicleFuelSpec(): String {
        val slug = activeVehicleSlug.value ?: return ""
        return runCatching { app.vehicleRepository.loadVehicle(slug).vehicle?.vehicle?.fuelSpec }
            .getOrNull()
            ?: ""
    }

    /** Looked up from the last [refresh] — the form's edit-mode load, no second disk read. */
    fun entry(id: String): FuelEntry? = fuelEntries.value.firstOrNull { it.id == id }

    /** Add-only — quick-add's path. Allocates the id in the repository, as F4's own `fuel:add` does. */
    fun addFuelEntry(entry: (id: String) -> FuelEntry): FuelEntry? {
        val slug = activeVehicleSlug.value ?: return null
        val added = app.vehicleRepository.addFuelEntry(slug, entry)
        refresh()
        return added
    }

    /** The full form's edit path — replaces one entry in place, by id. */
    fun updateFuelEntry(entry: FuelEntry): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val updated = app.vehicleRepository.updateFuelEntry(slug, entry)
        refresh()
        return updated
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = FuelViewModel(app) as T
        }
    }
}
