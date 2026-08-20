package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.github.sudomegas.tritium.storage.TritiumPaths
import io.github.sudomegas.tritium.ui.SettingsViewModel
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

/**
 * AF9b.md §4 criteria 2, 3, 6 and 7 on a real launch, not only against
 * [io.github.sudomegas.tritium.storage.ImportTest]'s own in-memory
 * repository: the whole sequence a maker actually lives — a fresh phone's
 * very first import (auto-activates, since nothing else is), then a later
 * import while a vehicle is already in use (must never switch away from
 * it) — read off the real files on disk, not only asserted against the
 * ViewModel's return value.
 *
 * The SAF picker chrome itself is out of Compose-test reach — a
 * cross-process system surface, the same boundary AF8.md drew and
 * verified by hand instead — so [SettingsViewModel.importBundle] is
 * called directly, exactly as AF9's own `UnitsFlowTest` seeds through
 * [io.github.sudomegas.tritium.storage.VehicleRepository] directly rather
 * than through a form.
 *
 * One test method, not two seeded independently: instrumented tests in
 * this project share one installed app's filesystem across methods with
 * no ordering guarantee between them (the established practice is a fresh
 * uninstall between test CLASSES, not between methods within one), so the
 * two scenarios are staged as one deterministic timeline instead.
 */
@RunWith(AndroidJUnit4::class)
class ImportFlowTest {

    private val composeRule = createAndroidComposeRule<MainActivity>()

    private val seedRule = TestRule { base, _ ->
        object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                val app = context.applicationContext as TritiumApplication
                // Currency answered, as it always is before Import is ever
                // reachable (AF9b.md §1.2) — but no vehicle, and no active
                // slug: a genuinely fresh phone.
                runBlocking { app.configState.update { it.copy(currency = "TRY") } }
                base.evaluate()
            }
        }
    }

    @get:Rule
    val rules: RuleChain = RuleChain.outerRule(seedRule).around(composeRule)

    @Test
    fun aFreshImportActivatesItselfAndALaterOneNeverSwitchesAway() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val app = context.applicationContext as TritiumApplication
        val viewModel = SettingsViewModel(app)
        val paths = TritiumPaths(app.filesDir)

        // 1 — a fresh phone's first import: nothing is active yet, so the
        // vehicle the bundle creates becomes active on its own.
        val first = viewModel.importBundle(
            """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "kia"
            name = "Kia Sportage"

            [[vehicle.fuel]]
            date = 2026-08-01
            odometer_km = 10000
            litres = 40.000
            price_per_litre = 45.000
            full_tank = true
            """.trimIndent(),
        )
        assertEquals(1, first.vehicles.size)
        assertTrue(first.vehicles.single().vehicleCreated)
        assertEquals("kia", app.configState.config.value.activeVehicleSlug)

        // Away and back to Home to force its per-visit refresh (AF3–AF9's
        // own established pattern) — its vehicle-name map was last read
        // before this import happened.
        composeRule.onNodeWithTag("nav_settings").performClick()
        composeRule.onNodeWithTag("nav_home").performClick()
        composeRule.onAllNodesWithText("Kia Sportage").assertCountEquals(1)
        composeRule.onAllNodesWithText(context.getString(R.string.home_no_vehicle)).assertCountEquals(0)

        // 2 — a later import: "kia" is already active, and the bundle both
        // adds a fill-up to it and creates a whole new second vehicle.
        // Neither may switch the maker away from "kia".
        val second = viewModel.importBundle(
            """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-20
            source = "android"

            [[vehicle]]
            slug = "kia"
            name = "Kia Sportage"

            [[vehicle.fuel]]
            date = 2026-08-15
            odometer_km = 10500
            litres = 35.000
            price_per_litre = 45.000
            full_tank = true

            [[vehicle]]
            slug = "spare"
            name = "Spare"
            """.trimIndent(),
        )
        val kiaTally = second.vehicles.single { it.slug == "kia" }
        assertEquals(1, kiaTally.added.fuel)
        assertTrue(second.vehicles.single { it.slug == "spare" }.vehicleCreated)
        assertEquals("kia", app.configState.config.value.activeVehicleSlug)

        composeRule.onNodeWithTag("nav_fuel").performClick()
        composeRule.onAllNodesWithText("10.500 km").assertCountEquals(1)

        val onDisk = paths.fuelToml("kia").readText()
        assertTrue("odometer_km = 10000" in onDisk)
        assertTrue("odometer_km = 10500" in onDisk)
    }
}
