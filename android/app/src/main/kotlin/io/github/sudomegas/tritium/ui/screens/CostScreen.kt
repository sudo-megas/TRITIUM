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
import io.github.sudomegas.tritium.storage.CostEntry
import io.github.sudomegas.tritium.storage.CustomRange
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.RangeKey
import io.github.sudomegas.tritium.storage.boundsFor
import io.github.sudomegas.tritium.storage.filterByBounds
import io.github.sudomegas.tritium.ui.CostViewModel

/**
 * The Costs tab (AF5.md §1.1 — "not a fresh decision," AF4's own precedent).
 * A button, range chips, a sort toggle, and the list itself — AF7 replacing
 * the placeholder furniture that has stood since AF5.
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
            // costEntries already arrives date-desc (CostViewModel.refresh).
            SortState.DEFAULT -> filtered
            SortState.ASCENDING -> filtered.sortedBy { it.date }
            SortState.DESCENDING -> filtered.sortedByDescending { it.date }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Button(onClick = { confirmingId = null; deleteFailed = false; onAddCost() }, enabled = hasVehicle) {
            Text(stringResource(R.string.costs_add))
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
                text = stringResource(R.string.costs_empty),
                modifier = Modifier.padding(top = 24.dp),
            )

            else -> LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
                items(rows, key = { it.id }) { entry ->
                    CostRow(
                        entry = entry,
                        currency = currency,
                        confirming = confirmingId == entry.id,
                        onClick = { confirmingId = null; deleteFailed = false; onEditEntry(entry.id) },
                        onDeleteTap = { confirmingId = entry.id; deleteFailed = false },
                        onConfirmDelete = {
                            confirmingId = null
                            deleteFailed = !viewModel.removeCostEntry(entry.id)
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
private fun CostRow(
    entry: CostEntry,
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
                Format.formatMoneyText(entry.signedAmount(), currency ?: ""),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        DeleteControl(confirming = confirming, onTap = onDeleteTap, onConfirm = onConfirmDelete, onCancel = onCancelDelete)
    }
}
