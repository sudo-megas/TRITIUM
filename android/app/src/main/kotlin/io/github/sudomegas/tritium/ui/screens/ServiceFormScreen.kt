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
import io.github.sudomegas.tritium.storage.FuelDraft
import io.github.sudomegas.tritium.storage.Scaled
import io.github.sudomegas.tritium.storage.ServiceEntry
import io.github.sudomegas.tritium.storage.UnitFormat
import io.github.sudomegas.tritium.ui.ServiceViewModel
import kotlinx.coroutines.launch

/**
 * The form (AF6.md §2.1 decision 5): `service.toml`'s entire shape — date,
 * part, odometer, amount, vendor. `part` is not required (the maker's own
 * sheet has a row with none); only `amount` gates save. Serves both add and
 * edit, `entryId == null` meaning add — the same shape [CostFormScreen]/
 * [FuelFormScreen] already established.
 *
 * `vendor` is plain text, never a URL field (XTRITIUM §3.5) — the hint
 * below says so, ported verbatim from the desktop's own `service.vendorHint`.
 *
 * Split into this loading gate and [ServiceFormBody]: [ServiceViewModel.entry]
 * is a repository read, now `suspend` so it never blocks the main thread
 * (AF12 audit finding) — and a `rememberSaveable` field seeded from a value
 * that later arrives asynchronously would seed from the placeholder and
 * never update. The body composes only once the entry it pre-fills from is
 * actually in hand — mirrors [FuelFormScreen]/[CostFormScreen]'s own split.
 */
@Composable
fun ServiceFormScreen(
    viewModel: ServiceViewModel,
    entryId: String?,
    currency: String?,
    unitFormat: UnitFormat,
    onSaved: () -> Unit,
) {
    var initial by remember(entryId) { mutableStateOf<ServiceEntry?>(null) }
    var notFound by remember(entryId) { mutableStateOf(false) }

    LaunchedEffect(entryId) {
        if (entryId == null) {
            initial = ServiceEntry(id = "")
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

        else -> ServiceFormBody(
            viewModel = viewModel,
            entryId = entryId,
            initial = loaded,
            currency = currency,
            unitFormat = unitFormat,
            onSaved = onSaved,
        )
    }
}

@Composable
private fun ServiceFormBody(
    viewModel: ServiceViewModel,
    entryId: String?,
    initial: ServiceEntry,
    currency: String?,
    unitFormat: UnitFormat,
    onSaved: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var previousOdometer by remember { mutableStateOf<Int?>(null) }
    // A display hint only — never seeds a rememberSaveable field — so it
    // loads independently of the gate above, same reasoning as
    // FuelQuickAddScreen's own previousOdometer/defaults.
    LaunchedEffect(Unit) { previousOdometer = viewModel.previousOdometer() }

    var date by rememberSaveable {
        mutableStateOf(if (entryId == null) Format.formatDate(Format.todayIso()) else Format.formatDate(initial.date))
    }
    var part by rememberSaveable { mutableStateOf(initial.part) }
    var odometerText by rememberSaveable {
        mutableStateOf(if (initial.odometerKm == 0) "" else unitFormat.distanceInput(initial.odometerKm))
    }
    var amountText by rememberSaveable { mutableStateOf(Format.toInput(initial.amount, Scaled.MONEY_DECIMALS)) }
    var vendor by rememberSaveable { mutableStateOf(initial.vendor) }
    var saveFailed by rememberSaveable { mutableStateOf(false) }

    val odometer = unitFormat.parseDistance(odometerText)
    val backwards = odometer != null && FuelDraft.goesBackwards(odometer, previousOdometer)
    val amount = Format.parseInput(amountText, Scaled.MONEY_DECIMALS)
    val canSave = amount != null && amount > 0

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(if (entryId == null) R.string.service_add_title else R.string.service_edit_title),
            style = MaterialTheme.typography.headlineSmall,
        )

        OutlinedTextField(
            value = date,
            onValueChange = { date = it },
            label = { Text(stringResource(R.string.service_field_date)) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = part,
            onValueChange = { part = it },
            label = { Text(stringResource(R.string.service_field_part)) },
            modifier = Modifier.fillMaxWidth(),
        )

        previousOdometer?.let { po ->
            Text(
                stringResource(
                    R.string.fuel_previous_odometer,
                    unitFormat.distance(po),
                    unitFormat.distanceSymbol,
                ),
            )
        }
        OutlinedTextField(
            value = odometerText,
            onValueChange = { odometerText = it },
            label = { Text("${stringResource(R.string.service_field_odometer)} (${unitFormat.distanceSymbol})") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("serviceOdometer"),
        )
        val backwardsOdometer = previousOdometer
        if (backwards && backwardsOdometer != null) {
            Text(
                stringResource(
                    R.string.fuel_backwards,
                    unitFormat.distance(backwardsOdometer),
                    unitFormat.distanceSymbol,
                ),
            )
        }

        OutlinedTextField(
            value = amountText,
            onValueChange = { amountText = it },
            label = { Text(stringResource(R.string.service_field_amount)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("serviceAmount"),
        )
        if (amount != null) {
            Text(Format.formatMoneyText(amount, currency ?: ""), style = MaterialTheme.typography.bodySmall)
        }

        OutlinedTextField(
            value = vendor,
            onValueChange = { vendor = it },
            label = { Text(stringResource(R.string.service_field_vendor)) },
            modifier = Modifier.fillMaxWidth().testTag("serviceVendor"),
        )
        Text(stringResource(R.string.service_vendor_hint), style = MaterialTheme.typography.bodySmall)

        if (saveFailed) {
            Text(
                text = stringResource(R.string.entry_save_failed),
                color = MaterialTheme.colorScheme.error,
            )
        }

        Button(
            enabled = canSave,
            modifier = Modifier.testTag("serviceSave"),
            onClick = {
                val entry = ServiceEntry(
                    id = initial.id,
                    date = Format.parseDate(date) ?: "",
                    part = part,
                    odometerKm = odometer ?: 0,
                    amount = amount ?: 0L,
                    vendor = vendor,
                )
                // entryId == null is add-only and always writes; false here
                // can only mean the id this form opened with is no longer in
                // service.toml (deleted elsewhere while the form was open) —
                // reported rather than silently treated as a successful save.
                scope.launch {
                    val saved = if (entryId == null) {
                        viewModel.addServiceEntry { id -> entry.copy(id = id) } != null
                    } else {
                        viewModel.updateServiceEntry(entry)
                    }
                    if (saved) onSaved() else saveFailed = true
                }
            },
        ) {
            Text(stringResource(R.string.service_save))
        }
    }
}
