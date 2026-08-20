package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
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
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.Scaled
import io.github.sudomegas.tritium.storage.UnitFormat
import io.github.sudomegas.tritium.storage.Vehicle
import io.github.sudomegas.tritium.ui.HomeViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * One screen serving both add and edit — `slug == null` is add, mirroring
 * SAAT's own `FormRoute` shape (AF1's `Destinations.kt`). AF3.md decision 2:
 * full-screen, not a dialog — the desktop's reason for a separate *window*
 * is draggability, a desktop-only affordance Android has no equivalent of.
 *
 * Every `vehicle.toml` field (AF2's `Vehicle`); `name` is the only required
 * one — it seeds the slug (AF3.md decision 7). No photo field, never, on
 * either platform. Numeric and date fields hold their EDITABLE text form
 * (`Format.toInput`/`Format.formatDate`, both already the shape a maker
 * types back), parsed on save via `Format.parseInput`/`Format.parseDate` —
 * unparseable input is simply not written, matching XTRITIUM §3 principle 8:
 * the app warns nothing here yet and accepts what it can read.
 *
 * Split into this loading gate and [VehicleFormBody]: [HomeViewModel.loadVehicle]
 * is a repository read, now `suspend` so it never blocks the main thread
 * (AF12 audit finding) — and a `rememberSaveable` field seeded from a value
 * that later arrives asynchronously would seed from the placeholder and
 * never update. The body composes only once the record it pre-fills from
 * is actually in hand, the same split [FuelFormScreen] established.
 */
@Composable
fun VehicleFormScreen(
    viewModel: HomeViewModel,
    slug: String?,
    unitFormat: UnitFormat,
    onSaved: (String) -> Unit,
) {
    var initial by remember(slug) { mutableStateOf<Vehicle?>(if (slug == null) Vehicle() else null) }

    LaunchedEffect(slug) {
        if (slug != null) {
            initial = viewModel.loadVehicle(slug)?.vehicle ?: Vehicle()
        }
    }

    val loaded = initial
    if (loaded == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    } else {
        VehicleFormBody(viewModel = viewModel, slug = slug, initial = loaded, unitFormat = unitFormat, onSaved = onSaved)
    }
}

@Composable
private fun VehicleFormBody(
    viewModel: HomeViewModel,
    slug: String?,
    initial: Vehicle,
    unitFormat: UnitFormat,
    onSaved: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()

    var name by rememberSaveable { mutableStateOf(initial.name) }
    var make by rememberSaveable { mutableStateOf(initial.make) }
    var model by rememberSaveable { mutableStateOf(initial.model) }
    var year by rememberSaveable { mutableStateOf(if (initial.year == 0) "" else initial.year.toString()) }
    var engine by rememberSaveable { mutableStateOf(initial.engine) }
    var fuelSpec by rememberSaveable { mutableStateOf(initial.fuelSpec) }
    var plate by rememberSaveable { mutableStateOf(initial.plate) }
    var vin by rememberSaveable { mutableStateOf(initial.vin) }
    var tankCapacity by rememberSaveable {
        mutableStateOf(unitFormat.tankInput(initial.tankCapacityL))
    }
    var purchaseDate by rememberSaveable { mutableStateOf(Format.formatDate(initial.purchaseDate)) }
    var purchasePrice by rememberSaveable {
        mutableStateOf(Format.toInput(initial.purchasePrice, Scaled.MONEY_DECIMALS))
    }
    var registrationDate by rememberSaveable { mutableStateOf(Format.formatDate(initial.registrationDate)) }
    var inspectionDue by rememberSaveable { mutableStateOf(Format.formatDate(initial.inspectionDue)) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(
                id = if (slug == null) R.string.vehicle_form_title_add else R.string.vehicle_form_title_edit,
            ),
            style = MaterialTheme.typography.headlineSmall,
        )

        Field(stringResource(R.string.vehicle_field_name), name, testTag = "vehicleName") { name = it }
        Field(stringResource(R.string.vehicle_field_make), make) { make = it }
        Field(stringResource(R.string.vehicle_field_model), model) { model = it }
        Field(stringResource(R.string.vehicle_field_year), year, KeyboardType.Number) { year = it }
        Field(stringResource(R.string.vehicle_field_engine), engine) { engine = it }
        Field(stringResource(R.string.vehicle_field_fuel_spec), fuelSpec) { fuelSpec = it }
        Field(stringResource(R.string.vehicle_field_plate), plate) { plate = it }
        Field(stringResource(R.string.vehicle_field_vin), vin) { vin = it }
        Field(
            "${stringResource(R.string.vehicle_field_tank_capacity)} (${unitFormat.volumeSymbol})",
            tankCapacity,
            KeyboardType.Decimal,
        ) { tankCapacity = it }
        Field(stringResource(R.string.vehicle_field_purchase_date), purchaseDate) { purchaseDate = it }
        Field(
            stringResource(R.string.vehicle_field_purchase_price),
            purchasePrice,
            KeyboardType.Decimal,
        ) { purchasePrice = it }
        Field(stringResource(R.string.vehicle_field_registration_date), registrationDate) { registrationDate = it }
        Field(stringResource(R.string.vehicle_field_inspection_due), inspectionDue) { inspectionDue = it }

        Button(
            enabled = name.isNotBlank(),
            onClick = {
                val vehicle = Vehicle(
                    name = name,
                    make = make,
                    model = model,
                    year = year.toIntOrNull() ?: 0,
                    engine = engine,
                    fuelSpec = fuelSpec,
                    plate = plate,
                    vin = vin,
                    tankCapacityL = unitFormat.parseTank(tankCapacity) ?: 0L,
                    purchaseDate = Format.parseDate(purchaseDate) ?: "",
                    purchasePrice = Format.parseInput(purchasePrice, Scaled.MONEY_DECIMALS) ?: 0L,
                    registrationDate = Format.parseDate(registrationDate) ?: "",
                    inspectionDue = Format.parseDate(inspectionDue) ?: "",
                )
                scope.launch {
                    val savedSlug = if (slug == null) {
                        viewModel.createVehicle(vehicle)
                    } else {
                        viewModel.saveVehicle(slug, vehicle)
                        slug
                    }
                    // Explicit hop back to Main before the Navigation call —
                    // see FuelFormScreen's own comment on the same pattern.
                    withContext(Dispatchers.Main.immediate) { onSaved(savedSlug) }
                }
            },
        ) {
            Text(stringResource(R.string.vehicle_form_save))
        }
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    testTag: String? = null,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = Modifier
            .fillMaxWidth()
            .let { if (testTag != null) it.testTag(testTag) else it },
    )
}
