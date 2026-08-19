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
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.ServiceEntry
import io.github.sudomegas.tritium.ui.ServiceViewModel

/**
 * The Service tab (AF6.md §1.1 — Periyodik Bakım's entry path, "not a
 * branch of the cost form"). One button and a provisional list, mirroring
 * [CostScreen]'s own shape — placeholder furniture AF7 replaces.
 *
 * `vendor` is rendered with a plain [Text], never a clickable/link
 * composable — XTRITIUM §3.5, with no exception. The row itself is
 * clickable to open the entry for editing, the same as [CostRow]'s own
 * row-level tap target; that is navigation, not the vendor field acting as
 * a link.
 */
@Composable
fun ServiceScreen(
    viewModel: ServiceViewModel,
    currency: String?,
    onAddService: () -> Unit,
    onEditEntry: (String) -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.refresh() }

    val activeSlug by viewModel.activeVehicleSlug.collectAsStateWithLifecycle()
    val entries by viewModel.serviceEntries.collectAsStateWithLifecycle()
    val hasVehicle = activeSlug != null

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Button(onClick = onAddService, enabled = hasVehicle) {
            Text(stringResource(R.string.service_add))
        }

        when {
            !hasVehicle -> Text(
                text = stringResource(R.string.home_no_vehicle),
                modifier = Modifier.padding(top = 24.dp),
            )

            entries.isEmpty() -> Text(
                text = stringResource(R.string.service_empty),
                modifier = Modifier.padding(top = 24.dp),
            )

            else -> LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
                items(entries, key = { it.id }) { entry ->
                    ServiceRow(entry = entry, currency = currency, onClick = { onEditEntry(entry.id) })
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun ServiceRow(entry: ServiceEntry, currency: String?, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(Format.formatDate(entry.date), style = MaterialTheme.typography.bodyMedium)
            if (entry.part.isNotEmpty()) {
                Text(entry.part, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${entry.odometerKm} km", style = MaterialTheme.typography.bodySmall)
            Text(Format.formatMoneyText(entry.amount, currency ?: ""), style = MaterialTheme.typography.bodySmall)
            if (entry.vendor.isNotEmpty()) {
                Text(entry.vendor, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
