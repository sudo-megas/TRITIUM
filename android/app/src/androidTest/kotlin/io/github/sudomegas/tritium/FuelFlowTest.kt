package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
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
 * AF4.md's own verification list: quick-add lands as one entry, the full
 * form edits it, and a second full-tank entry produces a consumption figure
 * the first one does not — the one thing worth proving on a real launch
 * rather than only in [io.github.sudomegas.tritium.storage.ConsumptionTest].
 *
 * A currency and one active vehicle are seeded directly through
 * [VehicleRepository]/[TritiumApplication.configState], the same
 * [RuleChain]-before-launch pattern `ShellLanguageSwitchTest` already
 * established — this test is about the Fuel tab, not about re-proving AF3's
 * own creation flow.
 *
 * The seed goes through [io.github.sudomegas.tritium.config.ConfigState.update]
 * rather than [io.github.sudomegas.tritium.config.ConfigStore] directly: on a
 * real device, `Application.onCreate()` — which reads `settings.toml` once,
 * synchronously, into `ConfigState`'s initial value — runs before any `@Rule`
 * does, `outerRule` included. Writing only the file left the live in-memory
 * config at its untouched default, so the very first assertion below saw
 * `activeVehicleSlug == null` and the "No vehicle" empty state instead of
 * the fuel one — found running this test for real, not in CI, which compiles
 * but never executes it.
 */
@RunWith(AndroidJUnit4::class)
class FuelFlowTest {

    private val composeRule = createAndroidComposeRule<MainActivity>()

    private val seedRule = TestRule { base, _ ->
        object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                val paths = TritiumPaths(context.filesDir)
                val repository = VehicleRepository(paths)
                val slug = repository.uniqueSlugForNewVehicle("Test Car")
                repository.saveVehicleRecord(
                    slug,
                    VehicleDocument(1, Vehicle(name = "Test Car", fuelSpec = "Kurşunsuz 95"), emptyMap()),
                )
                val app = context.applicationContext as TritiumApplication
                runBlocking { app.configState.update { it.copy(currency = "TRY", activeVehicleSlug = slug) } }
                base.evaluate()
            }
        }
    }

    @get:Rule
    val rules: RuleChain = RuleChain.outerRule(seedRule).around(composeRule)

    @Test
    fun quickAddThenEditThenASecondFullTankProducesConsumption() {
        composeRule.onNodeWithTag("nav_fuel").performClick()
        composeRule.onAllNodesWithText("No fill-ups yet.").assertCountEquals(1)

        // First fill-up, via quick add — full_tank defaults true, but with no
        // earlier full tank before it this can produce no consumption point
        // (XTRITIUM §5.2).
        composeRule.onNodeWithText("Quick add").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("fuelQuickOdometer").performTextInput("10000")
        composeRule.onNodeWithTag("fuelQuickLitres").performTextInput("40")
        composeRule.onNodeWithTag("fuelQuickPrice").performTextInput("45")
        composeRule.onNodeWithText("Save").performClick()
        composeRule.waitForIdle()

        composeRule.onAllNodesWithText("10.000 km").assertCountEquals(1)
        composeRule.onAllNodesWithText("l/100km", substring = true).assertCountEquals(0)

        // Second fill-up, a later full tank — now a consumption figure exists,
        // attached to this second entry, not the first.
        composeRule.onNodeWithText("Quick add").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("fuelQuickOdometer").performTextInput("10500")
        composeRule.onNodeWithTag("fuelQuickLitres").performTextInput("40")
        composeRule.onNodeWithTag("fuelQuickPrice").performTextInput("45")
        composeRule.onNodeWithText("Save").performClick()
        composeRule.waitForIdle()

        composeRule.onAllNodesWithText("10.500 km").assertCountEquals(1)
        composeRule.onAllNodesWithText("l/100km", substring = true).assertCountEquals(1)

        // The full form edits the second entry in place — tapping its row
        // opens it pre-filled, and a changed litres figure is what comes back.
        composeRule.onNodeWithText("10.500 km").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("fuelFormLitres").performTextClearance()
        composeRule.onNodeWithTag("fuelFormLitres").performTextInput("55")
        composeRule.onNodeWithText("Save").performClick()
        composeRule.waitForIdle()

        composeRule.onAllNodesWithText("55,000 l").assertCountEquals(1)
    }
}
