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
 * AF5.md's own verification list: a picked category (İLK ALIŞ) and a typed
 * MANUAL category both save correctly, a typed category is slugified rather
 * than taken raw, and the income checkbox flips the display sign without
 * touching what is stored — the one thing worth proving on a real launch
 * rather than only in `CostFileTest`/`SlugTest`.
 *
 * Seeds through `ConfigState.update`, not `ConfigStore` alone — AF4's own
 * fix, `FuelFlowTest`'s doc comment records why: `Application.onCreate()`
 * reads `settings.toml` synchronously before any `@Rule` runs.
 *
 * `closeSoftKeyboard()` runs before every Save tap: on this real device, a
 * `performClick()` fired while the real IME is still up and focused on the
 * amount field never actually lands — the form sits unchanged indefinitely
 * (confirmed by screenshotting mid-run, seconds apart, showing byte-for-byte
 * the same "New cost" screen). Neither `FuelFlowTest` nor `VehicleFlowTest`
 * hit this because their own last-focused field before Save is a dropdown
 * or checkbox, never a still-focused text field with the keyboard up.
 *
 * This test still runs intermittently on this particular device — the IME
 * dismissal above does not always leave the Save click free to land, and
 * CI only compiles instrumented sources, never executes them (`android-ci.yml`),
 * so it cannot be the gate either way. Every behaviour it exercises was
 * independently confirmed by hand, on-device, via `uiautomator dump`: the
 * group and category dropdowns each open and select (the real bug
 * [DropdownField] exists to fix), the typed MANUAL category slugifies on
 * save (`"Lastik"` to `lastik`, never the raw text, never a fallback slug —
 * `issues.md` I-17), the amount field's live preview matches what saves,
 * and the income checkbox flips only the displayed sign, never the stored
 * figure (`lastik` / `-500,00 ₺`, the underlying entry unchanged). That
 * manual pass, not this test's pass/fail on any given run, is what AF5's
 * acceptance criteria are verified against.
 */
@RunWith(AndroidJUnit4::class)
class CostFlowTest {

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
    fun pickedAndTypedCategoriesBothSaveAndIncomeFlipsTheDisplaySign() {
        composeRule.onNodeWithTag("nav_costs").performClick()
        composeRule.onAllNodesWithText("No costs yet.").assertCountEquals(1)

        // A picked category, from İLK ALIŞ's own tree.
        composeRule.onNodeWithText("Add cost").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("costGroupField").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithText("İLK ALIŞ").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("costCategoryPicked").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithText("Kapora").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("costAmount").performTextClearance()
        composeRule.onNodeWithTag("costAmount").performTextInput("1000")
        closeSoftKeyboard()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("costSave").performClick()
        // "Add cost" exists only on CostScreen, never on CostFormScreen — a
        // definitive signal the pop-back-stack navigation has actually
        // settled, unlike a bare waitForIdle() here, which can return while
        // the outgoing form (still showing its own "Kapora"/"1.000,00 ₺")
        // and the incoming list are both mid-transition.
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Add cost").fetchSemanticsNodes().size == 1
        }

        composeRule.onAllNodesWithText("Kapora").assertCountEquals(1)
        composeRule.onAllNodesWithText("1.000,00 ₺").assertCountEquals(1)

        // A typed MANUAL category — capitalised on input, slugified on save
        // (issues.md I-17: never the raw text, never a fallback slug). A
        // fresh form defaults to MANUAL already, so the group needs no touch.
        composeRule.onNodeWithText("Add cost").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("costCategoryTyped").performTextInput("Lastik")
        closeSoftKeyboard()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("costAmount").performTextClearance()
        composeRule.onNodeWithTag("costAmount").performTextInput("500")
        composeRule.onNodeWithTag("costIncomeCheckbox").performClick()
        closeSoftKeyboard()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("costSave").performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Add cost").fetchSemanticsNodes().size == 1
        }

        // Stored under the slug, shown negative — the checkbox never touches
        // the figure written to disk, only the sign shown for it.
        composeRule.onAllNodesWithText("lastik").assertCountEquals(1)
        composeRule.onAllNodesWithText("-500,00 ₺").assertCountEquals(1)

        // The first entry is untouched by the second save.
        composeRule.onAllNodesWithText("1.000,00 ₺").assertCountEquals(1)
    }
}
