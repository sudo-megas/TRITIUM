package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import io.github.sudomegas.tritium.storage.UnitFormat
import io.github.sudomegas.tritium.ui.FuelViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The full form (AF4.md §1.2 decision "Full form"): every `fuel.toml`
 * field, `full_tank` as a real checkbox — never inferred, unlike quick-add's
 * silent `true` — and the same screen serves the edit path, branching on
 * whether an `entryId` was passed in, mirroring [VehicleFormScreen]'s own
 * add/edit shape (AF3.md decision 2).
 *
 * Split into this loading gate and [FuelFormBody]: [FuelViewModel.entry]/
 * [FuelViewModel.activeVehicleFuelSpec] are repository reads, now `suspend`
 * so they never block the main thread (AF12 audit finding) — and a
 * `rememberSaveable` field seeded from a value that later arrives
 * asynchronously would seed from the placeholder and never update. The body
 * composes only once what it needs to pre-fill from is actually in hand.
 */
@Composable
fun FuelFormScreen(
    viewModel: FuelViewModel,
    entryId: String?,
    currency: String?,
    unitFormat: UnitFormat,
    onSaved: () -> Unit,
) {
    var initial by remember(entryId) { mutableStateOf<FuelEntry?>(null) }
    var defaultFuelType by remember(entryId) { mutableStateOf("") }
    var notFound by remember(entryId) { mutableStateOf(false) }

    LaunchedEffect(entryId) {
        if (entryId == null) {
            defaultFuelType = viewModel.activeVehicleFuelSpec()
            initial = FuelEntry(id = "")
        } else {
            val loaded = viewModel.entry(entryId)
            if (loaded == null) notFound = true else initial = loaded
        }
    }

    val loaded = initial
    when {
        notFound -> Text(
            text = stringResource(R.string.entry_save_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(24.dp),
        )

        loaded == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }

        else -> FuelFormBody(
            viewModel = viewModel,
            entryId = entryId,
            initial = loaded,
            defaultFuelType = defaultFuelType,
            currency = currency,
            unitFormat = unitFormat,
            onSaved = onSaved,
        )
    }
}

@Composable
private fun FuelFormBody(
    viewModel: FuelViewModel,
    entryId: String?,
    initial: FuelEntry,
    defaultFuelType: String,
    currency: String?,
    unitFormat: UnitFormat,
    onSaved: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    var date by rememberSaveable {
        mutableStateOf(if (entryId == null) Format.formatDate(Format.todayIso()) else Format.formatDate(initial.date))
    }
    var odometerText by rememberSaveable {
        mutableStateOf(if (initial.odometerKm == 0) "" else unitFormat.distanceInput(initial.odometerKm))
    }
    var litresText by rememberSaveable { mutableStateOf(unitFormat.volumeInput(initial.litres)) }
    var priceText by rememberSaveable { mutableStateOf(unitFormat.pricePerVolumeInput(initial.pricePerLitre)) }
    var fullTank by rememberSaveable {
        mutableStateOf(if (entryId == null) true else initial.fullTank)
    }
    var fuelType by rememberSaveable {
        mutableStateOf(initial.fuelType.ifEmpty { if (entryId == null) defaultFuelType else "" })
    }
    var saveFailed by rememberSaveable { mutableStateOf(false) }

    val litres = unitFormat.parseVolume(litresText)
    val price = unitFormat.parsePricePerVolume(priceText)
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
            label = { Text("${stringResource(R.string.fuel_field_odometer)} (${unitFormat.distanceSymbol})") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = litresText,
            onValueChange = { litresText = it },
            label = { Text("${stringResource(R.string.fuel_field_litres)} (${unitFormat.volumeSymbol})") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("fuelFormLitres"),
        )
        OutlinedTextField(
            value = priceText,
            onValueChange = { priceText = it },
            label = { Text("${stringResource(R.string.fuel_field_price_per_litre)} (${unitFormat.volumeSymbol})") },
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

        if (saveFailed) {
            Text(
                text = stringResource(R.string.entry_save_failed),
                color = MaterialTheme.colorScheme.error,
            )
        }

        val odometer = unitFormat.parseDistance(odometerText)
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
                // entryId == null is add-only and always writes; false here
                // can only mean the id this form opened with is no longer in
                // fuel.toml (deleted elsewhere while the form was open) —
                // reported rather than silently treated as a successful save.
                scope.launch {
                    val saved = if (entryId == null) {
                        viewModel.addFuelEntry { id -> entry.copy(id = id) } != null
                    } else {
                        viewModel.updateFuelEntry(entry)
                    }
                    // Explicit hop back to Main before the Navigation call —
                    // withContext(Dispatchers.IO) inside addFuelEntry/
                    // updateFuelEntry is meant to restore the caller's own
                    // dispatcher on return, but popBackStack's own internal
                    // LifecycleRegistry.setCurrentState enforces the REAL
                    // Android main thread specifically, which an unconfined
                    // resume cannot be assumed to land back on. AF12 audit
                    // finding, found running this for real on-device.
                    withContext(Dispatchers.Main.immediate) {
                        if (saved) onSaved() else saveFailed = true
                    }
                }
            },
        ) {
            Text(stringResource(R.string.fuel_save))
        }
    }
}
