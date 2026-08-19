package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertExists
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
 */
@RunWith(AndroidJUnit4::class)
class VehicleFlowTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun currencyDialogBlocksUntilAnsweredThenCreatingAVehicleMakesItActive() {
        // The dialog is up, offering the four presets — and nothing behind
        // it is reachable, since it takes the whole window.
        composeRule.onNodeWithText("TRY").assertExists()
        composeRule.onNodeWithText("USD").assertExists()

        composeRule.onNodeWithText("TRY").performClick()
        composeRule.onNodeWithText("Confirm").performClick()
        composeRule.waitForIdle()

        // Answered once — the dialog is gone, and the picker shows the
        // empty state, never a "get started" screen (XTRITIUM §7).
        composeRule.onAllNodesWithText("Confirm").assertCountEquals(0)
        composeRule.onNodeWithText("No vehicle").assertExists()

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
        composeRule.onNodeWithText("Kia Sportage").assertExists()
        composeRule.onAllNodesWithText("Confirm").assertCountEquals(0)
    }
}
