package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.FUEL_TYPES
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.FuelEntry
import io.github.sudomegas.tritium.storage.Scaled
import io.github.sudomegas.tritium.ui.FuelViewModel

/**
 * The full form (AF4.md §1.2 decision "Full form"): every `fuel.toml`
 * field, `full_tank` as a real checkbox — never inferred, unlike quick-add's
 * silent `true` — and the same screen serves the edit path, branching on
 * whether an `entryId` was passed in, mirroring [VehicleFormScreen]'s own
 * add/edit shape (AF3.md decision 2).
 */
@Composable
fun FuelFormScreen(viewModel: FuelViewModel, entryId: String?, currency: String?, onSaved: () -> Unit) {
    val initial = remember(entryId) { entryId?.let { viewModel.entry(it) } ?: FuelEntry(id = "") }

    var date by rememberSaveable {
        mutableStateOf(if (entryId == null) Format.formatDate(Format.todayIso()) else Format.formatDate(initial.date))
    }
    var odometerText by rememberSaveable {
        mutableStateOf(if (initial.odometerKm == 0) "" else initial.odometerKm.toString())
    }
    var litresText by rememberSaveable { mutableStateOf(Format.toInput(initial.litres, Scaled.PUMP_DECIMALS)) }
    var priceText by rememberSaveable { mutableStateOf(Format.toInput(initial.pricePerLitre, Scaled.PUMP_DECIMALS)) }
    var fullTank by rememberSaveable {
        mutableStateOf(if (entryId == null) true else initial.fullTank)
    }
    var fuelType by rememberSaveable {
        mutableStateOf(initial.fuelType.ifEmpty { if (entryId == null) viewModel.activeVehicleFuelSpec() else "" })
    }

    val litres = Format.parseInput(litresText, Scaled.PUMP_DECIMALS)
    val price = Format.parseInput(priceText, Scaled.PUMP_DECIMALS)
    val total = if (litres != null && price != null) Scaled.fuelTotal(litres, price) else null

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(if (entryId == null) R.string.fuel_add_title else R.string.fuel_edit_title),
            style = MaterialTheme.typography.headlineSmall,
        )

        OutlinedTextField(
            value = date,
            onValueChange = { date = it },
            label = { Text(stringResource(R.string.fuel_field_date)) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = odometerText,
            onValueChange = { odometerText = it },
            label = { Text(stringResource(R.string.fuel_field_odometer)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = litresText,
            onValueChange = { litresText = it },
            label = { Text(stringResource(R.string.fuel_field_litres)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("fuelFormLitres"),
        )
        OutlinedTextField(
            value = priceText,
            onValueChange = { priceText = it },
            label = { Text(stringResource(R.string.fuel_field_price_per_litre)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )

        if (total != null) {
            Text("${stringResource(R.string.fuel_total)}: ${Format.formatMoneyText(total, currency ?: "")}")
        }

        DropdownField(
            label = stringResource(R.string.fuel_field_fuel_type),
            selectedText = fuelType,
            options = FUEL_TYPES,
            optionText = { it },
            onSelect = { type -> fuelType = type },
            testTag = "fuelTypeField",
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = fullTank, onCheckedChange = { fullTank = it })
            Text(stringResource(R.string.fuel_field_full_tank))
        }

        val odometer = odometerText.toIntOrNull()
        Button(
            enabled = odometer != null && odometer > 0 && litres != null && litres > 0 && price != null,
            onClick = {
                val entry = FuelEntry(
                    id = initial.id,
                    date = Format.parseDate(date) ?: "",
                    odometerKm = odometer ?: 0,
                    litres = litres ?: 0L,
                    pricePerLitre = price ?: 0L,
                    fullTank = fullTank,
                    fuelType = fuelType,
                )
                if (entryId == null) {
                    viewModel.addFuelEntry { id -> entry.copy(id = id) }
                } else {
                    viewModel.updateFuelEntry(entry)
                }
                onSaved()
            },
        ) {
            Text(stringResource(R.string.fuel_save))
        }
    }
}
