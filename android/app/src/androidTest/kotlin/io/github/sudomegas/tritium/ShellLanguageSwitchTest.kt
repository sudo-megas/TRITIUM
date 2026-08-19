package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * AF1.md §4, acceptance criterion 5: the shell launches, and the language
 * switch flips a visible string instantly.
 *
 * Interaction points use `Modifier.testTag`, not display text: once on the
 * Settings screen, the bottom-nav label and the screen's own heading both
 * read "Settings" in English — a real collision `onNodeWithText` would throw
 * on, found while writing this rather than after.
 *
 * `AppCompatDelegate.setApplicationLocales` changes the configuration, and
 * `MainActivity` declares no `android:configChanges` (deliberately — the
 * manifest guardian fails the build if it ever does, AF1.md §2.1 decision 6),
 * so the platform recreates the Activity on the locale change exactly as it
 * would on a rotation. `waitForIdle` after the tap is what lets the rule catch
 * up with that recreation before the assertion runs.
 */
@RunWith(AndroidJUnit4::class)
class ShellLanguageSwitchTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun switchingToTurkishFlipsTheSettingsHeadingInstantly() {
        // English by default — XTRITIUM §3 principle 6.
        composeRule.onNodeWithTag("settingsHeading").assertDoesNotExist()

        composeRule.onNodeWithTag("nav_settings").performClick()
        composeRule.onNodeWithTag("settingsHeading").assertTextEquals("Settings")

        composeRule.onNodeWithTag("languageChipTr").performClick()
        composeRule.waitForIdle()

        // The Activity was recreated by the locale change; Settings is the
        // start destination's sibling, not the graph's start, so navigate to
        // it again on the fresh Activity instance before asserting.
        composeRule.onNodeWithTag("nav_settings").performClick()
        composeRule.onNodeWithTag("settingsHeading").assertTextEquals("Ayarlar")
    }
}
