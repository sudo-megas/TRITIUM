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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.Consumption
import io.github.sudomegas.tritium.storage.CustomRange
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.FuelEntry
import io.github.sudomegas.tritium.storage.RangeKey
import io.github.sudomegas.tritium.storage.Scaled
import io.github.sudomegas.tritium.storage.boundsFor
import io.github.sudomegas.tritium.storage.filterByBounds
import io.github.sudomegas.tritium.ui.FuelViewModel

/**
 * The Fuel tab (AF4.md §1.1 — "decided with you"): two buttons, range chips,
 * a sort toggle, and the list itself — AF7 replacing the placeholder
 * furniture that has stood since AF4.
 *
 * The list's one correctness rule (AF4.md §1.2, restated AF7.md §1.2):
 * [Consumption.consumptionById] is fed [FuelViewModel.fuelEntries] whole,
 * before any range or sort is applied — never the filtered/sorted rows.
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

    var rangeKey by rememberSaveable { mutableStateOf(RangeKey.ALL) }
    var customFrom by rememberSaveable { mutableStateOf("") }
    var customTo by rememberSaveable { mutableStateOf("") }
    var sortState by rememberSaveable { mutableStateOf(SortState.DEFAULT) }
    var confirmingId by rememberSaveable { mutableStateOf<String?>(null) }

    // Fed the whole, unfiltered entry list — the rule above, not the rows below.
    val consumption = remember(entries) { Consumption.consumptionById(entries) }

    val today = remember { Format.todayIso() }
    val bounds = remember(rangeKey, customFrom, customTo, today) {
        boundsFor(rangeKey, today, CustomRange(Format.parseDate(customFrom), Format.parseDate(customTo)))
    }
    val filtered = remember(entries, bounds) { filterByBounds(entries, bounds) { it.date } }
    val rows = remember(filtered, sortState) {
        when (sortState) {
            // fuelEntries already arrives odometer-desc (FuelViewModel.refresh).
            SortState.DEFAULT -> filtered
            SortState.ASCENDING -> filtered.sortedBy { it.odometerKm }
            SortState.DESCENDING -> filtered.sortedByDescending { it.odometerKm }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { confirmingId = null; onQuickAdd() }, enabled = hasVehicle) {
                Text(stringResource(R.string.fuel_quick_add))
            }
            Button(onClick = { confirmingId = null; onFullAdd() }, enabled = hasVehicle) {
                Text(stringResource(R.string.fuel_full_add))
            }
        }

        RangeChips(
            selected = rangeKey,
            customFrom = customFrom,
            customTo = customTo,
            onSelect = { confirmingId = null; rangeKey = it },
            onCustomFromChange = { customFrom = it },
            onCustomToChange = { customTo = it },
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
            SortToggleButton(state = sortState, onClick = { confirmingId = null; sortState = sortState.next() })
        }

        when {
            !hasVehicle -> Text(
                text = stringResource(R.string.home_no_vehicle),
                modifier = Modifier.padding(top = 24.dp),
            )

            rows.isEmpty() -> Text(
                text = stringResource(R.string.fuel_empty),
                modifier = Modifier.padding(top = 24.dp),
            )

            else -> LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
                items(rows, key = { it.id }) { entry ->
                    FuelRow(
                        entry = entry,
                        consumption = consumption[entry.id],
                        currency = currency,
                        confirming = confirmingId == entry.id,
                        onClick = { confirmingId = null; onEditEntry(entry.id) },
                        onDeleteTap = { confirmingId = entry.id },
                        onConfirmDelete = {
                            confirmingId = null
                            viewModel.removeFuelEntry(entry.id)
                        },
                        onCancelDelete = { confirmingId = null },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun FuelRow(
    entry: FuelEntry,
    consumption: Consumption.ConsumptionPoint?,
    currency: String?,
    confirming: Boolean,
    onClick: () -> Unit,
    onDeleteTap: () -> Unit,
    onConfirmDelete: () -> Unit,
    onCancelDelete: () -> Unit,
) {
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
        DeleteControl(confirming = confirming, onTap = onDeleteTap, onConfirm = onConfirmDelete, onCancel = onCancelDelete)
    }
}
