package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.storage.CostEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.withContext

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

    /**
     * Re-read the active vehicle's cost entries from disk, newest date
     * first. `suspend`, dispatched to [Dispatchers.IO] — the repository
     * does synchronous file I/O and this is called from [CostScreen]'s own
     * composition (`LaunchedEffect(Unit)`), which runs on the main thread
     * otherwise. AF12 audit finding.
     */
    suspend fun refresh() {
        val slug = activeVehicleSlug.value
        _costEntries.value = if (slug == null) {
            emptyList()
        } else {
            withContext(Dispatchers.IO) {
                runCatching { app.vehicleRepository.loadVehicle(slug).costs.entries }.getOrDefault(emptyList())
            }.sortedWith(compareByDescending<CostEntry> { it.date }.thenByDescending { it.id })
        }
    }

    /**
     * The form's edit-mode load — a one-off read, not the [costEntries]
     * snapshot: this ViewModel may be freshly recreated (process death)
     * with nothing in it yet, and falling back to "not found" there would
     * make a real edit save as a silent no-op. AF12 audit finding.
     */
    suspend fun entry(id: String): CostEntry? {
        val slug = activeVehicleSlug.value ?: return null
        return withContext(Dispatchers.IO) {
            runCatching { app.vehicleRepository.loadVehicle(slug).costs.entries }.getOrDefault(emptyList())
        }.firstOrNull { it.id == id }
    }

    /** Add-only path. Allocates the id in the repository, as F5's own `costs:add` does. */
    suspend fun addCostEntry(entry: (id: String) -> CostEntry): CostEntry? {
        val slug = activeVehicleSlug.value ?: return null
        val added = withContext(Dispatchers.IO) { app.vehicleRepository.addCostEntry(slug, entry) }
        refresh()
        return added
    }

    /** The form's edit path — replaces one entry in place, by id. */
    suspend fun updateCostEntry(entry: CostEntry): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val updated = withContext(Dispatchers.IO) { app.vehicleRepository.updateCostEntry(slug, entry) }
        refresh()
        return updated
    }

    /** One record at a time (AF7.md §3) — the list's own delete-with-confirm. */
    suspend fun removeCostEntry(id: String): Boolean {
        val slug = activeVehicleSlug.value ?: return false
        val removed = withContext(Dispatchers.IO) { app.vehicleRepository.removeCostEntry(slug, id) }
        refresh()
        return removed
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = CostViewModel(app) as T
        }
    }
}
