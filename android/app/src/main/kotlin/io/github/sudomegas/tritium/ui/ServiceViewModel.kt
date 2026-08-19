package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.storage.FuelDraft
import io.github.sudomegas.tritium.storage.ServiceEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/**
 * Owns the active vehicle's service entries for the Service tab (AF6.md
 * §2.1 decision 3). Mirrors [CostViewModel]'s own shape deliberately — each
 * screen's ViewModel stays self-sufficient, independent of every other one.
 *
 * [serviceEntries] is a snapshot taken on [refresh], never a cache — the
 * same reasoning AF2.md §1 gave for `VehicleRepository` itself.
 */
class ServiceViewModel(private val app: TritiumApplication) : ViewModel() {

    val activeVehicleSlug: StateFlow<String?> = app.configState.config
        .map { it.activeVehicleSlug }
        .stateIn(viewModelScope, SharingStarted.Eagerly, app.configState.config.value.activeVehicleSlug)

    private val _serviceEntries = MutableStateFlow<List<ServiceEntry>>(emptyList())
    val serviceEntries: StateFlow<List<ServiceEntry>> = _serviceEntries.asStateFlow()

    /** Re-read the active vehicle's service entries from disk, newest date first. */
    fun refresh() {
        val slug = activeVehicleSlug.value
        _serviceEntries.value = if (slug == null) {
            emptyList()
        } else {
            runCatching { app.vehicleRepository.loadVehicle(slug).service.entries }
                .getOrDefault(emptyList())
                .sortedWith(compareByDescending<ServiceEntry> { it.date }.thenByDescending { it.id })
        }
    }

    /** Looked up from the last [refresh] — the form's edit-mode load, no second disk read. */
    fun entry(id: String): ServiceEntry? = serviceEntries.value.firstOrNull { it.id == id }

    /**
     * The highest odometer reading across both `fuel.toml` and
     * `service.toml` (AF6.md §1.2) — a one-off repository read at
     * form-open time, the same shape [FuelViewModel.previousOdometer] uses.
     */
    fun previousOdometer(): Int? {
        val slug = activeVehicleSlug.value ?: return null
        val fuelEntries = runCatching { app.vehicleRepository.loadVehicle(slug).fuel.entries }
            .getOrDefault(emptyList())
        return FuelDraft.highestOdometer(fuelEntries, serviceEntries.value)
    }

    /** Add-only path. Allocates the id in the repository, as F6's own `service:add` does. */
    fun addServiceEntry(entry: (id: String) -> ServiceEntry): ServiceEntry? {
        val slug = activeVehicleSlug.value ?: return null
        val added = app.vehicleRepository.addServiceEntry(slug, entry)
        refresh()
        return added
    }

    /** The form's edit path — replaces one entry in place, by id. */
    fun updateServiceEntry(entry: ServiceEntry): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val updated = app.vehicleRepository.updateServiceEntry(slug, entry)
        refresh()
        return updated
    }

    /** One record at a time (AF7.md §3) — the list's own delete-with-confirm. */
    fun removeServiceEntry(id: String): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val removed = app.vehicleRepository.removeServiceEntry(slug, id)
        refresh()
        return removed
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = ServiceViewModel(app) as T
        }
    }
}
