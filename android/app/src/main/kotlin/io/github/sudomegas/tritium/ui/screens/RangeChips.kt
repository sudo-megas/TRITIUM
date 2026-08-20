package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.RangeKey

/**
 * The five fixed ranges plus a custom pair, shared by Fuel/Cost/Service
 * (AF7.md §2.1 decision 7, XTRITIUM §7.2). Selecting a chip narrows which
 * ROWS a screen renders — [io.github.sudomegas.tritium.storage.Consumption.consumptionById]
 * is never filtered by it; that rule lives at the call site, not here
 * (AF7.md §1.2).
 *
 * The custom fields carry raw typed text, not a parsed date. An unreadable
 * bound is simply not applied while the maker is mid-keystroke (F7.md §2.1
 * decision 5) — never treated as filtering to nothing. No date picker.
 */
@Composable
fun RangeChips(
    selected: RangeKey,
    customFrom: String,
    customTo: String,
    onSelect: (RangeKey) -> Unit,
    onCustomFromChange: (String) -> Unit,
    onCustomToChange: (String) -> Unit,
) {
    val chips = listOf(
        RangeKey.ALL to stringResource(R.string.range_all),
        RangeKey.YTD to stringResource(R.string.range_ytd),
        RangeKey.PREVIOUS_YEAR to stringResource(R.string.range_previous_year),
        RangeKey.THIS_MONTH to stringResource(R.string.range_this_month),
        RangeKey.PREVIOUS_MONTH to stringResource(R.string.range_previous_month),
        RangeKey.CUSTOM to stringResource(R.string.range_custom),
    )

    Column {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            chips.forEach { (key, label) ->
                FilterChip(selected = selected == key, onClick = { onSelect(key) }, label = { Text(label) })
            }
        }
        if (selected == RangeKey.CUSTOM) {
            Row(
                modifier = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = customFrom,
                    onValueChange = onCustomFromChange,
                    label = { Text(stringResource(R.string.range_from)) },
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = customTo,
                    onValueChange = onCustomToChange,
                    label = { Text(stringResource(R.string.range_to)) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

/**
 * default → ascending → descending → default (AF7.md §2.1 decision 9). Each
 * list keeps its own notion of "default" (fuel: odometer desc; costs/
 * service: date desc) — this only names the three states and their order,
 * never a sort key, since fuel and costs/service don't share one.
 */
enum class SortState { DEFAULT, ASCENDING, DESCENDING }

fun SortState.next(): SortState = when (this) {
    SortState.DEFAULT -> SortState.ASCENDING
    SortState.ASCENDING -> SortState.DESCENDING
    SortState.DESCENDING -> SortState.DEFAULT
}

@Composable
fun SortToggleButton(state: SortState, onClick: () -> Unit) {
    val label = when (state) {
        SortState.DEFAULT -> stringResource(R.string.sort_default)
        SortState.ASCENDING -> stringResource(R.string.sort_ascending)
        SortState.DESCENDING -> stringResource(R.string.sort_descending)
    }
    TextButton(onClick = onClick) { Text(label) }
}

/**
 * Delete, asking twice, in the flow — never an `AlertDialog` (F7.md §2.1
 * decision 8, ported for Compose as a per-row state rather than the
 * desktop's button-morph, same principle). Not confirming: one small
 * button. Confirming: a commit button, a cancel button, and the warning
 * line, replacing it — mirroring the desktop's own `RecordDetail.tsx`.
 */
@Composable
fun DeleteControl(confirming: Boolean, onTap: () -> Unit, onConfirm: () -> Unit, onCancel: () -> Unit) {
    if (!confirming) {
        TextButton(onClick = onTap) { Text(stringResource(R.string.list_delete)) }
        return
    }
    Column {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = onConfirm) { Text(stringResource(R.string.list_delete_confirm)) }
            TextButton(onClick = onCancel) { Text(stringResource(R.string.list_delete_cancel)) }
        }
        Text(stringResource(R.string.list_delete_warning), style = MaterialTheme.typography.bodySmall)
    }
}
