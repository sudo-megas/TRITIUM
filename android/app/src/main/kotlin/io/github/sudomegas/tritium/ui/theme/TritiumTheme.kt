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

/**
 * Native Material 3 (AF6b.md §1) — the fork AF1.md §2.1 decision 7 deferred,
 * closed by the maker rather than inferred. Dynamic/tonal colour where the
 * platform offers it (API 31+); the M3 baseline scheme, unbranded, below
 * that — minSdk 26 reaches five versions further back than dynamic colour
 * does. No custom seed colour: the fork just closed was "native," not
 * "native, but branded."
 */
@Composable
fun TritiumTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && dark -> dynamicDarkColorScheme(context)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> dynamicLightColorScheme(context)
        dark -> darkColorScheme()
        else -> lightColorScheme()
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
