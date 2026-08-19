package io.github.sudomegas.tritium.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import io.github.sudomegas.tritium.R

/**
 * XTRITIUM §8: asked once, at first launch, and — the desktop's own
 * `windows.ts` makes the currency window the only *modal* form window in
 * the whole app, with no cancel button at all — the only way out is to
 * answer. `dismissOnBackPress`/`dismissOnClickOutside` both false is what
 * makes that true on Android; the platform's own back gesture would
 * otherwise close an ordinary dialog for free.
 */
private val PRESETS = listOf("TRY", "USD", "EUR", "GBP")

@Composable
fun CurrencyAskDialog(onConfirm: (String) -> Unit) {
    var selected by remember { mutableStateOf(PRESETS.first()) }
    var customText by remember { mutableStateOf("") }
    var useCustom by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = {},
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false),
        title = { Text(stringResource(id = R.string.currency_title)) },
        text = {
            Column {
                PRESETS.forEach { code ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(selected = !useCustom && selected == code) {
                                useCustom = false
                                selected = code
                            }
                            .padding(vertical = 4.dp),
                    ) {
                        RadioButton(selected = !useCustom && selected == code, onClick = {
                            useCustom = false
                            selected = code
                        })
                        Text(code, modifier = Modifier.padding(start = 8.dp))
                    }
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .selectable(selected = useCustom) { useCustom = true }
                        .padding(vertical = 4.dp),
                ) {
                    RadioButton(selected = useCustom, onClick = { useCustom = true })
                    TextField(
                        value = customText,
                        onValueChange = {
                            useCustom = true
                            // §8: whatever the maker answered once — free
                            // text, nothing more. No length cap in the
                            // storage layer; a symbol table just may not
                            // recognise it (Format.currencySymbol).
                            customText = it
                        },
                        label = { Text(stringResource(id = R.string.currency_other)) },
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        },
        confirmButton = {
            val answer = if (useCustom) customText.trim() else selected
            TextButton(
                onClick = { if (answer.isNotEmpty()) onConfirm(answer) },
                enabled = answer.isNotEmpty(),
            ) {
                Text(stringResource(id = R.string.currency_confirm))
            }
        },
        // No dismiss button, deliberately — XTRITIUM §8 and the desktop's
        // own CurrencyAsk.tsx both offer exactly one way out of this dialog.
    )
}
