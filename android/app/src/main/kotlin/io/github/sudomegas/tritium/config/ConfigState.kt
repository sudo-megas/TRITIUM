package io.github.sudomegas.tritium.config

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * The one owner of `settings.toml` in the running app.
 *
 * AF1 has exactly one writer — the language switch — so the [writeLock] below
 * buys nothing yet. It is here anyway, cheaply, because the alternative is
 * retrofitting it once a second writer exists: XTRITIUM §3 principle 8 says
 * "all entries are editable at any time," and once vehicles arrive (AF3) a
 * `read-modify-write` on this same file with a suspension point in the middle
 * is a lost-update bug waiting for two settings to change close together. The
 * family's sibling Android port added exactly this class after that bug
 * shipped once; taking it now costs a `Mutex` and saves a repeat of it.
 *
 * Held by [TritiumApplication], so every reader — the Activity, any future
 * ViewModel — shares one flow rather than each re-reading the file.
 */
class ConfigState(
    private val store: ConfigStore,
    initial: ConfigLoad,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {

    private val _config = MutableStateFlow(initial.config)
    val config: StateFlow<AppConfig> = _config.asStateFlow()

    private val _error = MutableStateFlow(initial.error)
    val error: StateFlow<String?> = _error.asStateFlow()

    /** Serialises read-modify-write, so two concurrent updates cannot overwrite each other. */
    private val writeLock = Mutex()

    /**
     * Applies [transform] and persists the result.
     *
     * Memory first, disk immediately after. On failure the new value STAYS in
     * memory and the message goes to [error]: the maker asked for Turkish, and
     * refusing to show it because a file could not be written would be a
     * second failure stacked on the first.
     */
    suspend fun update(transform: (AppConfig) -> AppConfig) {
        writeLock.withLock {
            val current = _config.value
            val updated = transform(current)
            if (updated == current) return@withLock

            _config.value = updated
            try {
                withContext(io) { store.save(updated) }
            } catch (e: Exception) {
                _error.value = "${ConfigStore.FILE_NAME}: ${e.message ?: e::class.simpleName}"
            }
        }
    }

    fun clearError() {
        _error.value = null
    }
}
