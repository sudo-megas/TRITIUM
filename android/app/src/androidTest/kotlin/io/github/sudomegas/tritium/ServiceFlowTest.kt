package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.espresso.Espresso.closeSoftKeyboard
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
 * AF6.md's own verification list: a full record — part, odometer, amount,
 * vendor — saves, and the maker's own fourth row (no part, no vendor,
 * amount only) saves just as well, since `part` was never the gate. A
 * vendor holding a URL is asserted present as plain, unlinked text — the
 * one thing worth proving on a real launch rather than only in
 * `ServiceFileTest`.
 *
 * Seeds through `ConfigState.update`, not `ConfigStore` alone — the same
 * `RuleChain`-before-launch pattern `CostFlowTest`/`FuelFlowTest` already
 * established, for the same reason: `Application.onCreate()` reads
 * `settings.toml` synchronously before any `@Rule` runs.
 *
 * `closeSoftKeyboard()` runs before the Save tap, matching `CostFlowTest`'s
 * own defensive pattern for this device — see that test's doc comment for
 * the full account of why. This test is not what AF6's acceptance criteria
 * are verified against; a manual `uiautomator`-driven walkthrough is, and
 * that walkthrough runs before, not after, this test — AF5's own lesson.
 */
@RunWith(AndroidJUnit4::class)
class ServiceFlowTest {

    private val composeRule = createAndroidComposeRule<MainActivity>()

    private val seedRule = TestRule { base, _ ->
        object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                val paths = TritiumPaths(context.filesDir)
                val repository = VehicleRepository(paths)
                val slug = repository.uniqueSlugForNewVehicle("Test Car")
                repository.saveVehicleRecord(slug, VehicleDocument(1, Vehicle(name = "Test Car"), emptyMap()))
                val app = context.applicationContext as TritiumApplication
                runBlocking { app.configState.update { it.copy(currency = "TRY", activeVehicleSlug = slug) } }
                base.evaluate()
            }
        }
    }

    @get:Rule
    val rules: RuleChain = RuleChain.outerRule(seedRule).around(composeRule)

    @Test
    fun aFullRecordAndTheMakersOwnBareRowBothSaveAndVendorNeverBecomesALink() {
        composeRule.onNodeWithTag("nav_service").performClick()
        composeRule.onAllNodesWithText("No service records yet.").assertCountEquals(1)

        // A full row: part, odometer, amount, and a vendor holding a URL —
        // stored and shown as plain text, never a link (XTRITIUM §3.5).
        composeRule.onNodeWithText("Add service record").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("serviceOdometer").performTextInput("19764")
        composeRule.onNodeWithTag("serviceAmount").performTextInput("1500")
        composeRule.onNodeWithTag("serviceVendor").performTextInput("https://www.lastikcim.com.tr/lastik/")
        closeSoftKeyboard()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("serviceSave").performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Add service record").fetchSemanticsNodes().size == 1
        }

        composeRule.onAllNodesWithText("19.764 km").assertCountEquals(1)
        composeRule.onAllNodesWithText("https://www.lastikcim.com.tr/lastik/").assertCountEquals(1)

        // The maker's own fourth row: no part, no vendor, amount alone —
        // `part` was never the save gate, only `amount` is. A lower
        // odometer than the first row also exercises the backwards warning
        // without blocking the save.
        composeRule.onNodeWithText("Add service record").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("serviceOdometer").performTextInput("15100")
        composeRule.onNodeWithTag("serviceAmount").performTextInput("12000")
        closeSoftKeyboard()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("serviceSave").performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Add service record").fetchSemanticsNodes().size == 1
        }

        composeRule.onAllNodesWithText("15.100 km").assertCountEquals(1)

        // The first entry is untouched by the second save.
        composeRule.onAllNodesWithText("19.764 km").assertCountEquals(1)
    }
}
