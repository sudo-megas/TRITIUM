package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.github.sudomegas.tritium.R

/**
 * A placeholder, not a "get started" screen — XTRITIUM §7's empty-state rule
 * carried over from the desktop as-is: no illustration, no call to action, no
 * onboarding. AF1 has no data layer at all yet (AF1.md §3), so there is
 * nothing this screen could honestly invite the maker to do.
 */
@Composable
fun HomeScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(id = R.string.home_placeholder_title),
            style = MaterialTheme.typography.headlineMedium,
        )
        Text(
            text = stringResource(id = R.string.home_placeholder_body),
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
