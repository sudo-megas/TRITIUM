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
import io.github.sudomegas.tritium.storage.CostEntry
import io.github.sudomegas.tritium.storage.CostGroup
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.PAYMENT_METHODS
import io.github.sudomegas.tritium.storage.Scaled
import io.github.sudomegas.tritium.storage.pickableCategories
import io.github.sudomegas.tritium.storage.slugify
import io.github.sudomegas.tritium.storage.takesTypedCategory
import io.github.sudomegas.tritium.ui.CostViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The one adaptive form (AF5.md §1.2 — "one form, not two"): the category
 * control changes shape with the group, everything else stays put. Serves
 * both add and edit, `entryId == null` meaning add — the same shape
 * [FuelFormScreen] already established.
 *
 * The MANUAL-category save gate is the one thing worth getting wrong
 * exactly zero times (AF5.md §1.2, `issues.md` I-17): gated on
 * `slugify(typed).isNotEmpty()`, never on the raw typed text alone, and
 * never routed through `slugFor`/`uniqueSlug`, which exist to invent a
 * fallback slug — the opposite of what a save gate needs here.
 *
 * Split into this loading gate and [CostFormBody]: [CostViewModel.entry] is
 * a repository read, now `suspend` so it never blocks the main thread
 * (AF12 audit finding) — and a `rememberSaveable` field seeded from a value
 * that later arrives asynchronously would seed from the placeholder and
 * never update. The body composes only once the entry it pre-fills from is
 * actually in hand — mirrors [FuelFormScreen]'s own split.
 */
@Composable
fun CostFormScreen(viewModel: CostViewModel, entryId: String?, currency: String?, onSaved: () -> Unit) {
    var initial by remember(entryId) { mutableStateOf<CostEntry?>(null) }
    var notFound by remember(entryId) { mutableStateOf(false) }

    LaunchedEffect(entryId) {
        if (entryId == null) {
            initial = CostEntry(id = "")
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

        else -> CostFormBody(viewModel = viewModel, entryId = entryId, initial = loaded, currency = currency, onSaved = onSaved)
    }
}

@Composable
private fun CostFormBody(
    viewModel: CostViewModel,
    entryId: String?,
    initial: CostEntry,
    currency: String?,
    onSaved: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    var date by rememberSaveable {
        mutableStateOf(if (entryId == null) Format.formatDate(Format.todayIso()) else Format.formatDate(initial.date))
    }
    var group by rememberSaveable { mutableStateOf(initial.group) }
    var pickedCategory by rememberSaveable {
        mutableStateOf(if (!takesTypedCategory(initial.group)) initial.category else "")
    }
    var typedCategory by rememberSaveable {
        mutableStateOf(if (takesTypedCategory(initial.group)) initial.category else "")
    }
    var title by rememberSaveable { mutableStateOf(initial.title) }
    var amountText by rememberSaveable { mutableStateOf(Format.toInput(initial.amount, Scaled.MONEY_DECIMALS)) }
    var income by rememberSaveable { mutableStateOf(initial.income) }
    var paymentMethod by rememberSaveable { mutableStateOf(initial.paymentMethod) }
    var bank by rememberSaveable { mutableStateOf(initial.bank) }
    var instalment by rememberSaveable { mutableStateOf(initial.instalment) }
    var note by rememberSaveable { mutableStateOf(initial.note) }
    var saveFailed by rememberSaveable { mutableStateOf(false) }

    val amount = Format.parseInput(amountText, Scaled.MONEY_DECIMALS)
    val resolvedCategory = if (takesTypedCategory(group)) slugify(typedCategory) else pickedCategory
    val canSave = amount != null && resolvedCategory.isNotEmpty()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(if (entryId == null) R.string.costs_add_title else R.string.costs_edit_title),
            style = MaterialTheme.typography.headlineSmall,
        )

        OutlinedTextField(
            value = date,
            onValueChange = { date = it },
            label = { Text(stringResource(R.string.costs_field_date)) },
            modifier = Modifier.fillMaxWidth(),
        )

        DropdownField(
            label = stringResource(R.string.costs_field_group),
            selectedText = costGroupLabel(group),
            options = CostGroup.entries,
            optionText = { costGroupLabel(it) },
            onSelect = { entry ->
                group = entry
                pickedCategory = ""
                typedCategory = ""
            },
            testTag = "costGroupField",
        )

        if (takesTypedCategory(group)) {
            OutlinedTextField(
                value = typedCategory,
                onValueChange = { typedCategory = it },
                label = { Text(stringResource(R.string.costs_field_category)) },
                modifier = Modifier.fillMaxWidth().testTag("costCategoryTyped"),
            )
            Text(stringResource(R.string.costs_typed_category_hint), style = MaterialTheme.typography.bodySmall)
        } else {
            if (group == CostGroup.TEKRAR_EDEN) {
                Text(stringResource(R.string.costs_service_elsewhere), style = MaterialTheme.typography.bodySmall)
            }
            DropdownField(
                label = stringResource(R.string.costs_field_category),
                selectedText = if (pickedCategory.isEmpty()) "" else costCategoryLabel(pickedCategory),
                options = pickableCategories(group),
                optionText = { costCategoryLabel(it) },
                onSelect = { token -> pickedCategory = token },
                testTag = "costCategoryPicked",
            )
        }

        OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            label = { Text(stringResource(R.string.costs_field_title)) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = amountText,
            onValueChange = { amountText = it },
            label = { Text(stringResource(R.string.costs_field_amount)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("costAmount"),
        )
        if (amount != null) {
            Text(Format.formatMoneyText(amount, currency ?: ""), style = MaterialTheme.typography.bodySmall)
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = income,
                onCheckedChange = { income = it },
                modifier = Modifier.testTag("costIncomeCheckbox"),
            )
            Text(stringResource(R.string.costs_field_income))
        }
        if (income) {
            Text(stringResource(R.string.costs_income_hint), style = MaterialTheme.typography.bodySmall)
        }

        DropdownField(
            label = stringResource(R.string.costs_field_payment_method),
            selectedText = if (paymentMethod.isEmpty()) "" else costPaymentMethodLabel(paymentMethod),
            options = PAYMENT_METHODS,
            optionText = { costPaymentMethodLabel(it) },
            onSelect = { token -> paymentMethod = token },
            testTag = "costPaymentMethodField",
        )

        OutlinedTextField(
            value = bank,
            onValueChange = { bank = it },
            label = { Text(stringResource(R.string.costs_field_bank)) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = instalment,
            onValueChange = { instalment = it },
            label = { Text(stringResource(R.string.costs_field_instalment)) },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = note,
            onValueChange = { note = it },
            label = { Text(stringResource(R.string.costs_field_note)) },
            modifier = Modifier.fillMaxWidth(),
        )

        if (saveFailed) {
            Text(
                text = stringResource(R.string.entry_save_failed),
                color = MaterialTheme.colorScheme.error,
            )
        }

        Button(
            enabled = canSave,
            modifier = Modifier.testTag("costSave"),
            onClick = {
                val entry = CostEntry(
                    id = initial.id,
                    date = Format.parseDate(date) ?: "",
                    group = group,
                    category = resolvedCategory,
                    title = title,
                    amount = amount ?: 0L,
                    income = income,
                    paymentMethod = paymentMethod,
                    bank = bank,
                    instalment = instalment,
                    note = note,
                )
                // entryId == null is add-only and always writes; false here
                // can only mean the id this form opened with is no longer in
                // costs.toml (deleted elsewhere while the form was open) —
                // reported rather than silently treated as a successful save.
                scope.launch {
                    val saved = if (entryId == null) {
                        viewModel.addCostEntry { id -> entry.copy(id = id) } != null
                    } else {
                        viewModel.updateCostEntry(entry)
                    }
                    // Explicit hop back to Main before the Navigation call —
                    // see FuelFormScreen's own comment on the same pattern.
                    withContext(Dispatchers.Main.immediate) {
                        if (saved) onSaved() else saveFailed = true
                    }
                }
            },
        ) {
            Text(stringResource(R.string.costs_save))
        }
    }
}
