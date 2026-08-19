package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.github.sudomegas.tritium.storage.FuelEntry
import io.github.sudomegas.tritium.storage.TritiumPaths
import io.github.sudomegas.tritium.storage.Vehicle
import io.github.sudomegas.tritium.storage.VehicleDocument
import io.github.sudomegas.tritium.storage.VehicleRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

/**
 * AF9.md §4 criterion 2 and 3, proved on a real launch rather than only in
 * [io.github.sudomegas.tritium.storage.UnitsTest]: switching the distance
 * unit in Settings changes the Fuel list's odometer figure immediately, and
 * `fuel.toml` itself never moves — THE FILE STAYS METRIC, checked against
 * the file on disk, not just against [io.github.sudomegas.tritium.storage.Units]'s
 * own arithmetic.
 */
@RunWith(AndroidJUnit4::class)
class UnitsFlowTest {

    private val composeRule = createAndroidComposeRule<MainActivity>()
    private lateinit var fuelFile: java.io.File

    private val seedRule = TestRule { base, _ ->
        object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                val paths = TritiumPaths(context.filesDir)
                val repository = VehicleRepository(paths)
                val slug = repository.uniqueSlugForNewVehicle("Test Car")
                repository.saveVehicleRecord(slug, VehicleDocument(1, Vehicle(name = "Test Car"), emptyMap()))
                repository.addFuelEntry(slug) { id ->
                    FuelEntry(id, date = "2026-08-16", odometerKm = 19764, litres = 29_990, pricePerLitre = 73_380, fullTank = true)
                }
                fuelFile = paths.fuelToml(slug)
                val app = context.applicationContext as TritiumApplication
                runBlocking { app.configState.update { it.copy(currency = "TRY", activeVehicleSlug = slug) } }
                base.evaluate()
            }
        }
    }

    @get:Rule
    val rules: RuleChain = RuleChain.outerRule(seedRule).around(composeRule)

    @Test
    fun switchingToMilesChangesTheDisplayAndNeverTheFile() {
        composeRule.onNodeWithTag("nav_fuel").performClick()
        composeRule.onAllNodesWithText("19.764 km").assertCountEquals(1)

        composeRule.onNodeWithTag("nav_settings").performClick()
        composeRule.onNodeWithTag("distanceUnitmi").performClick()

        composeRule.onNodeWithTag("nav_fuel").performClick()
        // 19764 km × 10 / 1.609344 = 122.807,9... -> 122808 (tenths of a
        // mile) -> shown grouped, one decimal: 12.280,8 mi.
        composeRule.onAllNodesWithText("12.280,8 mi").assertCountEquals(1)
        composeRule.onAllNodesWithText("19.764 km").assertCountEquals(0)

        val onDisk = fuelFile.readText()
        assertTrue("fuel.toml must still hold the raw kilometre reading", "odometer_km = 19764" in onDisk)
    }
}
