package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.CostEntry
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.ui.CostViewModel

/**
 * The Costs tab (AF5.md §1.1 — "not a fresh decision," AF4's own precedent).
 * One button and a provisional list, mirroring [FuelScreen]'s own shape —
 * placeholder furniture AF7 replaces, matching F7's own replacement of F5's
 * pane.
 */
@Composable
fun CostScreen(
    viewModel: CostViewModel,
    currency: String?,
    onAddCost: () -> Unit,
    onEditEntry: (String) -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.refresh() }

    val activeSlug by viewModel.activeVehicleSlug.collectAsStateWithLifecycle()
    val entries by viewModel.costEntries.collectAsStateWithLifecycle()
    val hasVehicle = activeSlug != null

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Button(onClick = onAddCost, enabled = hasVehicle) {
            Text(stringResource(R.string.costs_add))
        }

        when {
            !hasVehicle -> Text(
                text = stringResource(R.string.home_no_vehicle),
                modifier = Modifier.padding(top = 24.dp),
            )

            entries.isEmpty() -> Text(
                text = stringResource(R.string.costs_empty),
                modifier = Modifier.padding(top = 24.dp),
            )

            else -> LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
                items(entries, key = { it.id }) { entry ->
                    CostRow(entry = entry, currency = currency, onClick = { onEditEntry(entry.id) })
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun CostRow(entry: CostEntry, currency: String?, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(Format.formatDate(entry.date), style = MaterialTheme.typography.bodyMedium)
            Text(
                if (entry.category.isEmpty()) costGroupLabel(entry.group) else costCategoryLabel(entry.category),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (entry.title.isNotEmpty()) {
                Text(entry.title, style = MaterialTheme.typography.bodySmall)
            }
            Text(
                Format.formatMoneyText(if (entry.income) -entry.amount else entry.amount, currency ?: ""),
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
