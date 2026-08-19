package io.github.sudomegas.tritium

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.github.sudomegas.tritium.config.AppConfig
import io.github.sudomegas.tritium.config.ConfigStore
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

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
 *
 * **AF3 addition**: a `settings.toml` carrying a currency is seeded before
 * `MainActivity` ever launches, via a [RuleChain] with the seeding rule
 * *outer* to [composeRule] — otherwise this test would meet AF3's
 * non-dismissible currency dialog on first launch and never reach Settings
 * at all. The exact problem F3.md §2.7 records the desktop hitting when its
 * own currency modal shipped: every existing e2e spec launched against a
 * fresh data directory and would have met the question too.
 */
@RunWith(AndroidJUnit4::class)
class ShellLanguageSwitchTest {

    private val composeRule = createAndroidComposeRule<MainActivity>()

    private val seedCurrencyRule = TestRule { base, _ ->
        object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                ConfigStore(context.filesDir).save(AppConfig(currency = "TRY"))
                base.evaluate()
            }
        }
    }

    @get:Rule
    val rules: RuleChain = RuleChain.outerRule(seedCurrencyRule).around(composeRule)

    @Test
    fun switchingToTurkishFlipsTheSettingsHeadingInstantly() {
        // English by default — XTRITIUM §3 principle 6. Not yet on Settings,
        // so no node carries this tag at all — assertCountEquals(0) rather
        // than assertDoesNotExist(), which this Compose BOM does not resolve.
        composeRule.onAllNodesWithTag("settingsHeading").assertCountEquals(0)

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
