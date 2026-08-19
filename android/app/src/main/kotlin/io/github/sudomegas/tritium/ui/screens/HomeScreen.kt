package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.Summary
import io.github.sudomegas.tritium.storage.UnitFormat
import io.github.sudomegas.tritium.storage.Vehicle
import io.github.sudomegas.tritium.ui.HomeSummary
import io.github.sudomegas.tritium.ui.HomeViewModel

/**
 * "Decided with you" (AF3.md): the vehicle picker lives in a top app bar
 * dropdown, not a screen of its own — the closest Android equivalent of the
 * desktop's picker sitting in the tab bar as chrome rather than behind a
 * tab. Always present, switching never navigates away. With zero vehicles
 * it is still there, offering only "Add" — never a "get started" screen
 * (XTRITIUM §7; AF3.md's empty-state decision).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    currency: String?,
    unitFormat: UnitFormat,
    onAddVehicle: () -> Unit,
    onEditVehicle: (String) -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.refresh() }

    val vehicleNames by viewModel.vehicleNames.collectAsStateWithLifecycle()
    val activeSlug by viewModel.activeVehicleSlug.collectAsStateWithLifecycle()
    var menuExpanded by remember { mutableStateOf(false) }

    val activeName = activeSlug?.let { vehicleNames[it] }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Box {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { menuExpanded = true },
                    ) {
                        Text(activeName ?: stringResource(id = R.string.home_no_vehicle))
                        // No dropdown-arrow icon: adding one would pull in
                        // material-icons-core for a single glyph, matching
                        // AF1's own "icon = {}" bottom-nav precedent — the
                        // tap target and the menu it opens are affordance
                        // enough for a scaffold milestone.
                    }
                    DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                        vehicleNames.forEach { (slug, name) ->
                            DropdownMenuItem(
                                text = { Text(name) },
                                onClick = {
                                    menuExpanded = false
                                    viewModel.switchVehicle(slug)
                                },
                            )
                        }
                        if (vehicleNames.isNotEmpty()) HorizontalDivider()
                        DropdownMenuItem(
                            text = { Text(stringResource(id = R.string.home_add_vehicle)) },
                            onClick = {
                                menuExpanded = false
                                onAddVehicle()
                            },
                        )
                    }
                }
            },
        )

        val vehicle by viewModel.activeVehicle.collectAsStateWithLifecycle()
        val summary by viewModel.summary.collectAsStateWithLifecycle()
        val slug = activeSlug

        if (vehicle != null && slug != null) {
            Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                VehicleSummary(vehicle = vehicle!!, onEdit = { onEditVehicle(slug) })
                if (summary != null) SummaryBlock(summary = summary!!, currency = currency, unitFormat = unitFormat)
            }
        } else {
            EmptyHome()
        }
    }
}

@Composable
private fun VehicleSummary(vehicle: Vehicle, onEdit: () -> Unit) {
    Column(modifier = Modifier.padding(24.dp)) {
        Text(vehicle.name, style = MaterialTheme.typography.headlineSmall)
        SummaryRow(stringResource(R.string.vehicle_field_make), vehicle.make)
        SummaryRow(stringResource(R.string.vehicle_field_model), vehicle.model)
        SummaryRow(stringResource(R.string.vehicle_field_plate), vehicle.plate)
        TextButton(onClick = onEdit) { Text(stringResource(R.string.home_edit_vehicle)) }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Text(value, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(start = 8.dp))
    }
}

/**
 * Every fuel/cost/service figure Home has never shown before AF7 (AF7.md
 * §2.1 decision 6). A null figure — no fuel yet, no previous fill-up —
 * renders as [R.string.home_summary_nothing], never a zero standing in for
 * an absence, the same reasoning `Summary.compare` itself would give for a
 * missing period.
 */
@Composable
private fun SummaryBlock(summary: HomeSummary, currency: String?, unitFormat: UnitFormat) {
    val nothing = stringResource(R.string.home_summary_nothing)

    Column(modifier = Modifier.padding(horizontal = 24.dp)) {
        Text(stringResource(R.string.home_summary_lifetime), style = MaterialTheme.typography.titleMedium)
        SummaryRow(
            stringResource(R.string.home_summary_average_consumption),
            summary.averageConsumption?.let { unitFormat.consumption(it) }
                ?.let { "$it ${unitFormat.consumptionSymbol}" }
                ?: nothing,
        )
        SummaryRow(
            stringResource(R.string.home_summary_last_consumption),
            summary.lastConsumption?.let { unitFormat.consumption(it) }
                ?.let { "$it ${unitFormat.consumptionSymbol}" }
                ?: nothing,
        )
        SummaryRow(
            stringResource(R.string.home_summary_last_price),
            summary.lastPrice?.let {
                "${unitFormat.pricePerVolumeText(it.price, currency ?: "")} · ${Format.formatDate(it.date)}"
            } ?: nothing,
        )
        SummaryRow(stringResource(R.string.home_summary_total_distance), unitFormat.distanceWith(summary.lifetimeDistance))
        SummaryRow(
            stringResource(R.string.home_summary_total_litres),
            unitFormat.volumeWith(summary.lifetimeLitres),
        )
        SummaryRow(
            stringResource(R.string.home_summary_total_spend),
            Format.formatMoneyText(summary.lifetimeSpend, currency ?: ""),
        )

        if (summary.recentEntries.isNotEmpty()) {
            Text(
                stringResource(R.string.home_summary_recent),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 16.dp),
            )
            summary.recentEntries.forEach { entry ->
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Text(Format.formatDate(entry.date), style = MaterialTheme.typography.bodySmall)
                    Text(
                        entryKindLabel(entry.kind),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                    Text(
                        entry.label,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                    Text(
                        Format.formatMoneyText(entry.amount, currency ?: ""),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun entryKindLabel(kind: Summary.EntryKind): String = when (kind) {
    Summary.EntryKind.FUEL -> stringResource(R.string.home_summary_kind_fuel)
    Summary.EntryKind.COST -> stringResource(R.string.home_summary_kind_cost)
    Summary.EntryKind.SERVICE -> stringResource(R.string.home_summary_kind_service)
}

/**
 * A placeholder, not a "get started" screen — XTRITIUM §7's empty-state rule
 * carried over from the desktop as-is (AF1.md §2.1 decision unchanged by
 * AF3): no illustration, no call to action beyond the picker's own Add
 * item, which is always reachable regardless of what this body shows.
 */
@Composable
private fun EmptyHome() {
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
