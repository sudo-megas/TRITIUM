package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.storage.CostEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/**
 * Owns the active vehicle's cost entries for the Costs tab (AF5.md §2.1
 * decision 1). Mirrors [FuelViewModel]'s own shape deliberately — each
 * screen's ViewModel stays self-sufficient, independent of every other one.
 *
 * [costEntries] is a snapshot taken on [refresh], never a cache — the same
 * reasoning AF2.md §1 gave for `VehicleRepository` itself.
 */
class CostViewModel(private val app: TritiumApplication) : ViewModel() {

    val activeVehicleSlug: StateFlow<String?> = app.configState.config
        .map { it.activeVehicleSlug }
        .stateIn(viewModelScope, SharingStarted.Eagerly, app.configState.config.value.activeVehicleSlug)

    private val _costEntries = MutableStateFlow<List<CostEntry>>(emptyList())
    val costEntries: StateFlow<List<CostEntry>> = _costEntries.asStateFlow()

    /** Re-read the active vehicle's cost entries from disk, newest date first. */
    fun refresh() {
        val slug = activeVehicleSlug.value
        _costEntries.value = if (slug == null) {
            emptyList()
        } else {
            runCatching { app.vehicleRepository.loadVehicle(slug).costs.entries }
                .getOrDefault(emptyList())
                .sortedWith(compareByDescending<CostEntry> { it.date }.thenByDescending { it.id })
        }
    }

    /** Looked up from the last [refresh] — the form's edit-mode load, no second disk read. */
    fun entry(id: String): CostEntry? = costEntries.value.firstOrNull { it.id == id }

    /** Add-only path. Allocates the id in the repository, as F5's own `costs:add` does. */
    fun addCostEntry(entry: (id: String) -> CostEntry): CostEntry? {
        val slug = activeVehicleSlug.value ?: return null
        val added = app.vehicleRepository.addCostEntry(slug, entry)
        refresh()
        return added
    }

    /** The form's edit path — replaces one entry in place, by id. */
    fun updateCostEntry(entry: CostEntry): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val updated = app.vehicleRepository.updateCostEntry(slug, entry)
        refresh()
        return updated
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = CostViewModel(app) as T
        }
    }
}
