package io.github.sudomegas.tritium

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import io.github.sudomegas.tritium.ui.TritiumApp
import io.github.sudomegas.tritium.ui.theme.TritiumTheme

/**
 * AppCompatActivity, not ComponentActivity.
 *
 * XTRITIUM §3 principle 6 forbids the app taking its language from the system
 * locale. The only way to hold an explicit per-app locale across the whole
 * `minSdk 26` range is `AppCompatDelegate.setApplicationLocales`
 * ([TritiumApplication.applyLocale]), which requires this base class and the
 * `Theme.AppCompat`-descended parent in `themes.xml`. The framework's own
 * `LocaleManager` is API 33+ and would leave 26–32 unserved.
 *
 * Taken in AF1 rather than later (AF1.md §2.1 decision 3): the Activity base
 * class and theme parent are expensive to change once every screen exists.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            val app = application as TritiumApplication
            TritiumTheme {
                TritiumApp(app = app)
            }
        }
    }
}
