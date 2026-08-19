package io.github.sudomegas.tritium.ui.nav

import androidx.annotation.StringRes
import io.github.sudomegas.tritium.R
import kotlinx.serialization.Serializable

/**
 * The two bottom-navigation destinations AF1 ships, and both their count and
 * their names are provisional (AF1.md §2.1 decision 7) — TRITIUM's actual
 * Android information architecture is deliberately undecided until the design
 * phase before AF7 (AF1.md §1.2), the same deferral XTRITIUM §11 made for the
 * desktop before F3.
 *
 * Type-safe navigation routes: each is a @Serializable object rather than a
 * string, so a typo is a compile error instead of a silent no-op at runtime.
 */
@Serializable
object HomeRoute

@Serializable
object SettingsRoute

enum class TopLevelDestination(
    val route: Any,
    @param:StringRes val labelRes: Int,
) {
    HOME(HomeRoute, R.string.nav_home),
    SETTINGS(SettingsRoute, R.string.nav_settings),
}
