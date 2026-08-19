package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.storage.Vehicle
import io.github.sudomegas.tritium.storage.VehicleDocument
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Owns the vehicle listing and the active-vehicle switch that live in Home's
 * top app bar (AF3.md — "decided with you: top app bar dropdown").
 *
 * Deliberately stateless over [io.github.sudomegas.tritium.storage.VehicleRepository]'s own
 * data, matching AF2.md §1's correction of AF1's original "in-memory index"
 * sketch: the repository reads files fresh on every call. [vehicleNames] and
 * [activeVehicle] are snapshots taken on [refresh] and after every mutation
 * below, never a cache the UI could be left holding stale — editing the
 * active vehicle and returning to Home must show what was just saved, not
 * what was loaded before the edit.
 */
class HomeViewModel(private val app: TritiumApplication) : ViewModel() {

    val activeVehicleSlug: StateFlow<String?> = app.configState.config
        .map { it.activeVehicleSlug }
        .stateIn(viewModelScope, SharingStarted.Eagerly, app.configState.config.value.activeVehicleSlug)

    private val _vehicleNames = MutableStateFlow<Map<String, String>>(emptyMap())
    val vehicleNames: StateFlow<Map<String, String>> = _vehicleNames.asStateFlow()

    private val _activeVehicle = MutableStateFlow<Vehicle?>(null)
    val activeVehicle: StateFlow<Vehicle?> = _activeVehicle.asStateFlow()

    /** Re-read the vehicle listing and the active vehicle's own record from disk. */
    fun refresh() {
        _vehicleNames.value = app.vehicleRepository.vehicleNames()
        _activeVehicle.value = activeVehicleSlug.value?.let { loadVehicle(it)?.vehicle }
    }

    /** Switching is instant and persisted — no confirmation, matching the desktop's own picker. */
    fun switchVehicle(slug: String) {
        viewModelScope.launch {
            app.configState.update { it.copy(activeVehicleSlug = slug) }
            refresh()
        }
    }

    /** A vehicle's record by slug, or null when it has none / will not parse — the form's edit-mode load. */
    fun loadVehicle(slug: String): VehicleDocument? =
        runCatching { app.vehicleRepository.loadVehicle(slug).vehicle }.getOrNull()

    /**
     * Allocates a slug and writes `vehicle.toml` — AF3.md decision 7,
     * already true of [io.github.sudomegas.tritium.storage.VehicleRepository.saveVehicleRecord],
     * which never touches the other three files. Makes the new vehicle
     * active, since creating one with nothing else on the phone is the
     * obvious thing to switch to.
     */
    fun createVehicle(vehicle: Vehicle): String {
        val slug = app.vehicleRepository.uniqueSlugForNewVehicle(vehicle.name)
        app.vehicleRepository.saveVehicleRecord(slug, VehicleDocument(1, vehicle, emptyMap()))
        switchVehicle(slug)
        return slug
    }

    /** Renaming edits `name` only — the slug never changes (AF3.md decision 5). */
    fun saveVehicle(slug: String, vehicle: Vehicle) {
        val existing = app.vehicleRepository.loadVehicle(slug).vehicle
        app.vehicleRepository.saveVehicleRecord(
            slug,
            (existing ?: VehicleDocument(1, vehicle, emptyMap())).copy(vehicle = vehicle),
        )
        refresh()
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = HomeViewModel(app) as T
        }
    }
}
