package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.FuelDraft
import io.github.sudomegas.tritium.storage.FuelEntry
import io.github.sudomegas.tritium.storage.Scaled
import io.github.sudomegas.tritium.ui.FuelViewModel

/**
 * XTRITIUM §5.1: "odometer, litres, price/litre — done. Everything else
 * editable later." Exactly three fields; date, fuel type and `full_tank`
 * default silently (AF4.md §1.2 decision 1) and are shown as a note rather
 * than asked — a default nobody can see is how a consumption figure goes
 * quietly wrong (§5.2). Add-only: this screen never edits.
 */
@Composable
fun FuelQuickAddScreen(viewModel: FuelViewModel, currency: String?, onSaved: () -> Unit) {
    val previousOdometer = remember { FuelDraft.lastOdometer(viewModel.fuelEntries.value) }
    val defaults = remember { FuelDraft.quickAddDefaults(viewModel.activeVehicleFuelSpec()) }

    var odometerText by rememberSaveable { mutableStateOf("") }
    var litresText by rememberSaveable { mutableStateOf("") }
    var priceText by rememberSaveable { mutableStateOf("") }

    val odometer = odometerText.toIntOrNull()
    val litres = Format.parseInput(litresText, Scaled.PUMP_DECIMALS)
    val price = Format.parseInput(priceText, Scaled.PUMP_DECIMALS)
    val backwards = odometer != null && FuelDraft.goesBackwards(odometer, previousOdometer)
    val total = if (litres != null && price != null) Scaled.fuelTotal(litres, price) else null

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.fuel_quick_title), style = MaterialTheme.typography.headlineSmall)

        if (previousOdometer != null) {
            Text(stringResource(R.string.fuel_previous_odometer, previousOdometer.toString()))
        }

        OutlinedTextField(
            value = odometerText,
            onValueChange = { odometerText = it },
            label = { Text(stringResource(R.string.fuel_field_odometer)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth().testTag("fuelQuickOdometer"),
        )
        if (backwards) {
            Text(stringResource(R.string.fuel_backwards, previousOdometer.toString()))
        }

        OutlinedTextField(
            value = litresText,
            onValueChange = { litresText = it },
            label = { Text(stringResource(R.string.fuel_field_litres)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("fuelQuickLitres"),
        )
        OutlinedTextField(
            value = priceText,
            onValueChange = { priceText = it },
            label = { Text(stringResource(R.string.fuel_field_price_per_litre)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("fuelQuickPrice"),
        )

        if (total != null) {
            Text("${stringResource(R.string.fuel_total)}: ${Format.formatMoneyText(total, currency ?: "")}")
        }

        Text(
            stringResource(R.string.fuel_quick_defaults, Format.formatDate(defaults.date), defaults.fuelType),
            style = MaterialTheme.typography.bodySmall,
        )

        Button(
            enabled = odometer != null && odometer > 0 && litres != null && litres > 0 && price != null,
            onClick = {
                viewModel.addFuelEntry { id ->
                    FuelEntry(
                        id = id,
                        date = defaults.date,
                        odometerKm = odometer ?: 0,
                        litres = litres ?: 0L,
                        pricePerLitre = price ?: 0L,
                        fullTank = defaults.fullTank,
                        fuelType = defaults.fuelType,
                    )
                }
                onSaved()
            },
        ) {
            Text(stringResource(R.string.fuel_save))
        }
    }
}
