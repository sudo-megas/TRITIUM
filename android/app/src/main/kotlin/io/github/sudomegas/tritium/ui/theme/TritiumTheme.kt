package io.github.sudomegas.tritium.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * PLACEHOLDER. Deliberately wrong, on purpose, so nobody mistakes this for
 * TRITIUM's actual Android identity (AF1.md §2.1 decision 7 — F1.md's own
 * precedent for the desktop's provisional tab bar: "placeholder palettes
 * carry obviously-wrong colours on purpose so nobody mistakes them for the
 * design phase's output").
 *
 * Whether the real answer is the desktop's CaskaydiaCove-and-eleven-palettes
 * identity carried over, Material 3 with dynamic colour the way the family's
 * sibling Android port chose, or something else again is XTRITIUM §11's own
 * kind of question — deliberately not decided here, settled together before
 * AF7 (AF1.md §1.2).
 */
private val PlaceholderMagenta = Color(0xFFFF00FF)
private val PlaceholderLime = Color(0xFF66FF00)
private val PlaceholderMustard = Color(0xFFE0C200)

private val PlaceholderLightScheme = lightColorScheme(
    primary = PlaceholderMagenta,
    secondary = PlaceholderLime,
    tertiary = PlaceholderMustard,
)

private val PlaceholderDarkScheme = darkColorScheme(
    primary = PlaceholderMagenta,
    secondary = PlaceholderLime,
    tertiary = PlaceholderMustard,
)

@Composable
fun TritiumTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) PlaceholderDarkScheme else PlaceholderLightScheme
    MaterialTheme(colorScheme = scheme, content = content)
}
