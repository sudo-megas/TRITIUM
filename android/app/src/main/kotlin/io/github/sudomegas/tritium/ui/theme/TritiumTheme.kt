package io.github.sudomegas.tritium.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import io.github.sudomegas.tritium.config.ThemeMode

/**
 * Native Material 3 (AF6b.md §1) — the fork AF1.md §2.1 decision 7 deferred,
 * closed by the maker rather than inferred. [themeMode] and [dynamicColor]
 * are AF9's own answer to AF6b.md's recorded question — "a light/dark/system
 * toggle, and whether to allow dynamic colour" — not a picker over the
 * desktop's eleven palettes. No custom seed colour where dynamic colour is
 * off or unavailable: the fork just closed was "native," not "native, but
 * branded."
 */
@Composable
fun TritiumTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val systemDark = isSystemInDarkTheme()
    val dark = when (themeMode) {
        ThemeMode.SYSTEM -> systemDark
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val context = LocalContext.current
    val dynamicAvailable = dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val scheme = when {
        dynamicAvailable && dark -> dynamicDarkColorScheme(context)
        dynamicAvailable -> dynamicLightColorScheme(context)
        dark -> darkColorScheme()
        else -> lightColorScheme()
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
