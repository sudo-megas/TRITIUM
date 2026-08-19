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
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.Consumption
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.FuelEntry
import io.github.sudomegas.tritium.storage.Scaled
import io.github.sudomegas.tritium.ui.FuelViewModel

/**
 * The Fuel tab (AF4.md §1.1 — "decided with you"): two buttons and a
 * provisional list, mirroring the desktop's own `FuelPane.tsx` at F4 —
 * placeholder furniture AF7 replaces, matching F7's own replacement of it.
 *
 * The list's one correctness rule (AF4.md §1.2): [Consumption.consumptionById]
 * is fed [FuelViewModel.fuelEntries] whole, every time — there is nothing to
 * filter it by yet, but the rule is stated here so AF7's range chips inherit
 * it rather than rediscover it.
 */
@Composable
fun FuelScreen(
    viewModel: FuelViewModel,
    currency: String?,
    onQuickAdd: () -> Unit,
    onFullAdd: () -> Unit,
    onEditEntry: (String) -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.refresh() }

    val activeSlug by viewModel.activeVehicleSlug.collectAsStateWithLifecycle()
    val entries by viewModel.fuelEntries.collectAsStateWithLifecycle()
    val hasVehicle = activeSlug != null
    val consumption = remember(entries) { Consumption.consumptionById(entries) }
    val sorted = remember(entries) { entries.sortedByDescending { it.odometerKm } }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onQuickAdd, enabled = hasVehicle) {
                Text(stringResource(R.string.fuel_quick_add))
            }
            Button(onClick = onFullAdd, enabled = hasVehicle) {
                Text(stringResource(R.string.fuel_full_add))
            }
        }

        when {
            !hasVehicle -> Text(
                text = stringResource(R.string.home_no_vehicle),
                modifier = Modifier.padding(top = 24.dp),
            )

            sorted.isEmpty() -> Text(
                text = stringResource(R.string.fuel_empty),
                modifier = Modifier.padding(top = 24.dp),
            )

            else -> LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
                items(sorted, key = { it.id }) { entry ->
                    FuelRow(
                        entry = entry,
                        consumption = consumption[entry.id],
                        currency = currency,
                        onClick = { onEditEntry(entry.id) },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun FuelRow(entry: FuelEntry, consumption: Consumption.ConsumptionPoint?, currency: String?, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(Format.formatDate(entry.date), style = MaterialTheme.typography.bodyMedium)
            Text("${entry.odometerKm} km", style = MaterialTheme.typography.bodyMedium)
            Text(
                stringResource(if (entry.fullTank) R.string.fuel_full else R.string.fuel_partial),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                Format.formatFigure(entry.litres, Scaled.PUMP_DECIMALS) + " l",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                Format.formatPricePerLitreText(entry.pricePerLitre, currency ?: ""),
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                Format.formatMoneyText(Scaled.fuelTotal(entry.litres, entry.pricePerLitre), currency ?: ""),
                style = MaterialTheme.typography.bodySmall,
            )
            if (consumption != null) {
                Text(
                    Format.formatFigure(consumption.l100km, Consumption.CONSUMPTION_DECIMALS) + " " +
                        stringResource(R.string.fuel_consumption),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}
