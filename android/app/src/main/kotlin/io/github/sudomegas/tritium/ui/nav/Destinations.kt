package io.github.sudomegas.tritium.ui.nav

import androidx.annotation.StringRes
import io.github.sudomegas.tritium.R
import kotlinx.serialization.Serializable

/**
 * The two bottom-navigation destinations AF1 ships, and both their count and
 * their names are provisional (AF1.md §2.1 decision 7). AF3.md §1 corrects
 * an assumption AF1 made here: the desktop's own design phase did not gate
 * F3 either — it shipped its own narrow, local UI decisions first, on
 * placeholder styling, and the real design pass (F4b) came two milestones
 * later. AF3 follows that shape rather than waiting.
 *
 * Type-safe navigation routes: each is a @Serializable object (or data
 * class, where an argument travels with it) rather than a string, so a typo
 * is a compile error instead of a silent no-op at runtime.
 */
@Serializable
object HomeRoute

@Serializable
object SettingsRoute

/**
 * The add/edit vehicle screen — AF3.md decision 2. `slug == null` is add,
 * mirroring the family's sibling Android port's own `FormRoute` shape
 * (`slug` there, `null` meaning the same thing).
 */
@Serializable
data class VehicleFormRoute(val slug: String? = null)

@Serializable
object FuelRoute

/**
 * Both fuel entry screens act on the active vehicle, read live from
 * [io.github.sudomegas.tritium.ui.FuelViewModel]'s own `activeVehicleSlug`
 * (AF4.md decision 5) — no slug travels with these routes, unlike
 * [VehicleFormRoute]'s, which names a specific vehicle to edit rather than
 * "whichever one is active right now."
 */
@Serializable
object FuelQuickAddRoute

/** `entryId == null` is add, mirroring [VehicleFormRoute]'s own add/edit shape. */
@Serializable
data class FuelFormRoute(val entryId: String? = null)

enum class TopLevelDestination(
    val route: Any,
    @param:StringRes val labelRes: Int,
) {
    HOME(HomeRoute, R.string.nav_home),
    FUEL(FuelRoute, R.string.nav_fuel),
    SETTINGS(SettingsRoute, R.string.nav_settings),
}
