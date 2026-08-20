package io.github.sudomegas.tritium.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.storage.Summary
import io.github.sudomegas.tritium.storage.Vehicle
import io.github.sudomegas.tritium.storage.VehicleDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The active vehicle's whole summary block (AF7.md §2.1 decision 5-6) — one
 * state object rather than eight separate flows, since every figure in it
 * is read from the same bundle at the same moment.
 */
data class HomeSummary(
    val latestOdometer: Int?,
    val averageConsumption: Long?,
    val lastConsumption: Long?,
    val lastPrice: Summary.LastPrice?,
    val lifetimeDistance: Int,
    val lifetimeLitres: Long,
    val lifetimeSpend: Long,
    val recentEntries: List<Summary.RecentEntry>,
)

private const val RECENT_LIMIT = 8

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

    private val _summary = MutableStateFlow<HomeSummary?>(null)
    val summary: StateFlow<HomeSummary?> = _summary.asStateFlow()

    /**
     * Re-read the vehicle listing, the active vehicle's own record, and its
     * summary from disk. `suspend`, dispatched to [Dispatchers.IO] — every
     * repository call here is synchronous file I/O and this is called from
     * [HomeScreen]'s own composition (`LaunchedEffect(Unit)`), which runs
     * on the main thread otherwise. AF12 audit finding.
     */
    suspend fun refresh() {
        val slug = activeVehicleSlug.value
        withContext(Dispatchers.IO) {
            val names = app.vehicleRepository.vehicleNames()
            val vehicle = slug?.let { runCatching { app.vehicleRepository.loadVehicle(it).vehicle?.vehicle }.getOrNull() }
            val summary = slug?.let(::loadSummary)
            Triple(names, vehicle, summary)
        }.let { (names, vehicle, summary) ->
            _vehicleNames.value = names
            _activeVehicle.value = vehicle
            _summary.value = summary
        }
    }

    /** Runs on [Dispatchers.IO] already, via [refresh]'s own `withContext` block. */
    private fun loadSummary(slug: String): HomeSummary? = runCatching {
        val bundle = app.vehicleRepository.loadVehicle(slug)
        val fuel = bundle.fuel.entries
        val costs = bundle.costs.entries
        val service = bundle.service.entries
        HomeSummary(
            latestOdometer = Summary.latestOdometer(fuel, service),
            averageConsumption = Summary.averageConsumption(fuel),
            lastConsumption = Summary.lastConsumption(fuel),
            lastPrice = Summary.lastPrice(fuel),
            lifetimeDistance = Summary.lifetimeDistance(fuel, service),
            lifetimeLitres = Summary.lifetimeLitres(fuel),
            lifetimeSpend = Summary.lifetimeSpend(fuel, costs, service),
            recentEntries = Summary.recentEntries(fuel, costs, service, RECENT_LIMIT),
        )
    }.getOrNull()

    /** Switching is instant and persisted — no confirmation, matching the desktop's own picker. */
    fun switchVehicle(slug: String) {
        viewModelScope.launch {
            app.configState.update { it.copy(activeVehicleSlug = slug) }
            refresh()
        }
    }

    /**
     * A vehicle's record by slug, or null when it has none / will not
     * parse — the form's edit-mode load. `suspend`, off the main thread
     * (AF12 audit finding).
     */
    suspend fun loadVehicle(slug: String): VehicleDocument? =
        withContext(Dispatchers.IO) { runCatching { app.vehicleRepository.loadVehicle(slug).vehicle }.getOrNull() }

    /**
     * Allocates a slug and writes `vehicle.toml` — AF3.md decision 7,
     * already true of [io.github.sudomegas.tritium.storage.VehicleRepository.saveVehicleRecord],
     * which never touches the other three files. Makes the new vehicle
     * active, since creating one with nothing else on the phone is the
     * obvious thing to switch to. `suspend`, off the main thread (AF12
     * audit finding).
     */
    suspend fun createVehicle(vehicle: Vehicle): String {
        val slug = withContext(Dispatchers.IO) {
            val allocated = app.vehicleRepository.uniqueSlugForNewVehicle(vehicle.name)
            app.vehicleRepository.saveVehicleRecord(allocated, VehicleDocument(1, vehicle, emptyMap()))
            allocated
        }
        switchVehicle(slug)
        return slug
    }

    /**
     * Renaming edits `name` only — the slug never changes (AF3.md decision
     * 5). Reads only `vehicle.toml` to recover what it is not replacing
     * ([VehicleDocument.rest]'s carried unknown keys) — an unrelated corrupt
     * fuel/costs/service file must not stop the maker from fixing a
     * vehicle's own name (AF12 audit finding). `suspend`, off the main
     * thread — the same finding.
     */
    suspend fun saveVehicle(slug: String, vehicle: Vehicle) {
        withContext(Dispatchers.IO) {
            val existing = app.vehicleRepository.loadVehicleRecord(slug)
            app.vehicleRepository.saveVehicleRecord(
                slug,
                (existing ?: VehicleDocument(1, vehicle, emptyMap())).copy(vehicle = vehicle),
            )
        }
        refresh()
    }

    companion object {
        fun factory(app: TritiumApplication) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = HomeViewModel(app) as T
        }
    }
}
