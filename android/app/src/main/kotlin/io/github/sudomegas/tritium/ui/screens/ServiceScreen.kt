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
import io.github.sudomegas.tritium.storage.CustomRange
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.RangeKey
import io.github.sudomegas.tritium.storage.ServiceEntry
import io.github.sudomegas.tritium.storage.UnitFormat
import io.github.sudomegas.tritium.storage.boundsFor
import io.github.sudomegas.tritium.storage.filterByBounds
import io.github.sudomegas.tritium.ui.ServiceViewModel

/**
 * The Service tab (AF6.md §1.1 — Periyodik Bakım's entry path, "not a
 * branch of the cost form"). A button, range chips, a sort toggle, and the
 * list itself — AF7 replacing the placeholder furniture that has stood
 * since AF6.
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
    unitFormat: UnitFormat,
    onAddService: () -> Unit,
    onEditEntry: (String) -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.refresh() }

    val activeSlug by viewModel.activeVehicleSlug.collectAsStateWithLifecycle()
    val entries by viewModel.serviceEntries.collectAsStateWithLifecycle()
    val hasVehicle = activeSlug != null

    var rangeKey by rememberSaveable { mutableStateOf(RangeKey.ALL) }
    var customFrom by rememberSaveable { mutableStateOf("") }
    var customTo by rememberSaveable { mutableStateOf("") }
    var sortState by rememberSaveable { mutableStateOf(SortState.DEFAULT) }
    var confirmingId by rememberSaveable { mutableStateOf<String?>(null) }
    var deleteFailed by rememberSaveable { mutableStateOf(false) }

    val today = remember { Format.todayIso() }
    val bounds = remember(rangeKey, customFrom, customTo, today) {
        boundsFor(rangeKey, today, CustomRange(Format.parseDate(customFrom), Format.parseDate(customTo)))
    }
    val filtered = remember(entries, bounds) { filterByBounds(entries, bounds) { it.date } }
    val rows = remember(filtered, sortState) {
        when (sortState) {
            // serviceEntries already arrives date-desc (ServiceViewModel.refresh).
            SortState.DEFAULT -> filtered
            SortState.ASCENDING -> filtered.sortedBy { it.date }
            SortState.DESCENDING -> filtered.sortedByDescending { it.date }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Button(onClick = { confirmingId = null; deleteFailed = false; onAddService() }, enabled = hasVehicle) {
            Text(stringResource(R.string.service_add))
        }

        RangeChips(
            selected = rangeKey,
            customFrom = customFrom,
            customTo = customTo,
            onSelect = { confirmingId = null; deleteFailed = false; rangeKey = it },
            onCustomFromChange = { customFrom = it },
            onCustomToChange = { customTo = it },
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
            SortToggleButton(
                state = sortState,
                onClick = { confirmingId = null; deleteFailed = false; sortState = sortState.next() },
            )
        }

        if (deleteFailed) {
            Text(
                text = stringResource(R.string.list_delete_failed),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        when {
            !hasVehicle -> Text(
                text = stringResource(R.string.home_no_vehicle),
                modifier = Modifier.padding(top = 24.dp),
            )

            rows.isEmpty() -> Text(
                text = stringResource(R.string.service_empty),
                modifier = Modifier.padding(top = 24.dp),
            )

            else -> LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
                items(rows, key = { it.id }) { entry ->
                    ServiceRow(
                        entry = entry,
                        currency = currency,
                        unitFormat = unitFormat,
                        confirming = confirmingId == entry.id,
                        onClick = { confirmingId = null; deleteFailed = false; onEditEntry(entry.id) },
                        onDeleteTap = { confirmingId = entry.id; deleteFailed = false },
                        onConfirmDelete = {
                            confirmingId = null
                            deleteFailed = !viewModel.removeServiceEntry(entry.id)
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
private fun ServiceRow(
    entry: ServiceEntry,
    currency: String?,
    unitFormat: UnitFormat,
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
            if (entry.part.isNotEmpty()) {
                Text(entry.part, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(unitFormat.distanceWith(entry.odometerKm), style = MaterialTheme.typography.bodySmall)
            Text(Format.formatMoneyText(entry.amount, currency ?: ""), style = MaterialTheme.typography.bodySmall)
            if (entry.vendor.isNotEmpty()) {
                Text(entry.vendor, style = MaterialTheme.typography.bodySmall)
            }
        }
        DeleteControl(confirming = confirming, onTap = onDeleteTap, onConfirm = onConfirmDelete, onCancel = onCancelDelete)
    }
}
