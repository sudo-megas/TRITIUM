package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.github.sudomegas.tritium.storage.FuelEntry
import io.github.sudomegas.tritium.storage.ServiceEntry
import io.github.sudomegas.tritium.storage.TritiumPaths
import io.github.sudomegas.tritium.storage.Vehicle
import io.github.sudomegas.tritium.storage.VehicleDocument
import io.github.sudomegas.tritium.storage.VehicleRepository
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

/**
 * AF7.md §4's own acceptance criteria 5 and 7: deletion asks twice, in the
 * flow, and Home's summary block reflects real entries rather than staying
 * a static placeholder. Seeded directly through [VehicleRepository], not
 * the UI's own entry forms (AF4–AF6's own tests already cover those, and
 * they carry known device-specific IME flakiness — see [CostFlowTest]'s
 * doc comment) — this test's job is the delete-with-confirm flow and the
 * summary figures reading real data, nothing upstream of that.
 *
 * Not what AF7's acceptance criteria are verified against; a manual
 * `uiautomator`-driven walkthrough is, matching every AF since AF5.
 */
@RunWith(AndroidJUnit4::class)
class SummaryAndDeletionTest {

    private val composeRule = createAndroidComposeRule<MainActivity>()

    private val seedRule = TestRule { base, _ ->
        object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                val paths = TritiumPaths(context.filesDir)
                val repository = VehicleRepository(paths)
                val slug = repository.uniqueSlugForNewVehicle("Test Car")
                repository.saveVehicleRecord(slug, VehicleDocument(1, Vehicle(name = "Test Car"), emptyMap()))
                // Two full tanks — one consumption interval, 7,000 l/100km.
                repository.addFuelEntry(slug) { id ->
                    FuelEntry(id, date = "2026-08-01", odometerKm = 10000, litres = 40_000, pricePerLitre = 45_000, fullTank = true)
                }
                repository.addFuelEntry(slug) { id ->
                    FuelEntry(id, date = "2026-08-10", odometerKm = 10500, litres = 35_000, pricePerLitre = 45_000, fullTank = true)
                }
                repository.addServiceEntry(slug) { id ->
                    ServiceEntry(id, date = "2026-08-05", part = "Oil change", odometerKm = 9800, amount = 50_000, vendor = "Test Garage")
                }
                val app = context.applicationContext as TritiumApplication
                runBlocking { app.configState.update { it.copy(currency = "TRY", activeVehicleSlug = slug) } }
                base.evaluate()
            }
        }
    }

    @get:Rule
    val rules: RuleChain = RuleChain.outerRule(seedRule).around(composeRule)

    @Test
    fun homeShowsRealSummaryFiguresAndServiceDeletionAsksTwice() {
        // Home's summary block reflects the seeded entries, not "—" for a
        // figure that has something to compute from (AF7.md §4 criterion 7).
        // Average and last consumption are the same figure — one interval.
        composeRule.onAllNodesWithText("7,000 l/100km").assertCountEquals(2)
        // Lifetime spend: fuel 1.800,00 + 1.575,00, service 500,00.
        composeRule.onAllNodesWithText("3.875,00 ₺").assertCountEquals(1)

        // Service's own list: delete asks twice, in the flow — never a dialog.
        composeRule.onNodeWithTag("nav_service").performClick()
        composeRule.onAllNodesWithText("Oil change").assertCountEquals(1)

        composeRule.onAllNodesWithText("Delete")[0].performClick()
        composeRule.onAllNodesWithText("Delete for good").assertCountEquals(1)
        composeRule.onAllNodesWithText("Keep it").assertCountEquals(1)

        // "Keep it" reverts without deleting anything.
        composeRule.onAllNodesWithText("Keep it")[0].performClick()
        composeRule.onAllNodesWithText("Delete for good").assertCountEquals(0)
        composeRule.onAllNodesWithText("Oil change").assertCountEquals(1)

        // Second tap, on "Delete for good," commits.
        composeRule.onAllNodesWithText("Delete")[0].performClick()
        composeRule.onAllNodesWithText("Delete for good")[0].performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("No service records yet.").fetchSemanticsNodes().size == 1
        }
    }
}
