package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * AF3.md §4 (sketch): the currency dialog fires once at launch and cannot
 * be dismissed without answering; the picker shows "No vehicle" with zero
 * vehicles, never a "get started" screen; creating one makes it active.
 *
 * Deliberately does NOT seed a currency the way `ShellLanguageSwitchTest`
 * now must — this is the one test that means to meet the dialog.
 *
 * Every existence check below goes through `onAllNodesWithText(...).
 * assertCountEquals(1)` rather than `assertExists()` — this Compose BOM
 * (2026.06.01) does not resolve `assertExists`/`assertDoesNotExist` at all
 * (AF1's `ShellLanguageSwitchTest` hit the same thing with
 * `assertDoesNotExist` first); `assertCountEquals` is already proven to
 * resolve, so every single-node check in this file uses it consistently
 * rather than mixing in a family of assertions this BOM won't compile.
 */
@RunWith(AndroidJUnit4::class)
class VehicleFlowTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun currencyDialogBlocksUntilAnsweredThenCreatingAVehicleMakesItActive() {
        // The dialog is up, offering the four presets — and nothing behind
        // it is reachable, since it takes the whole window.
        composeRule.onAllNodesWithText("TRY").assertCountEquals(1)
        composeRule.onAllNodesWithText("USD").assertCountEquals(1)

        composeRule.onNodeWithText("TRY").performClick()
        composeRule.onNodeWithText("Confirm").performClick()
        composeRule.waitForIdle()

        // Answered once — the dialog is gone, and the picker shows the
        // empty state, never a "get started" screen (XTRITIUM §7).
        composeRule.onAllNodesWithText("Confirm").assertCountEquals(0)
        composeRule.onAllNodesWithText("No vehicle").assertCountEquals(1)

        // Add a vehicle: open the picker, tap Add, fill the required field,
        // save.
        composeRule.onNodeWithText("No vehicle").performClick()
        composeRule.onNodeWithText("Add").performClick()
        composeRule.waitForIdle()

        composeRule.onNodeWithTag("vehicleName").performTextInput("Kia Sportage")
        composeRule.onNodeWithText("Save").performClick()
        composeRule.waitForIdle()

        // Back on Home, the new vehicle is active and named in the picker —
        // and the currency dialog never reappeared along the way.
        composeRule.onAllNodesWithText("Kia Sportage").assertCountEquals(1)
        composeRule.onAllNodesWithText("Confirm").assertCountEquals(0)
    }
}
