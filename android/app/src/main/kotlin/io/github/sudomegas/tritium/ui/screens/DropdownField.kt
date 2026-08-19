package io.github.sudomegas.tritium.ui.screens

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag

/**
 * A read-only field that opens a dropdown on tap. Ported to
 * [androidx.compose.material3.ExposedDropdownMenuBox] — the earlier hand-
 * rolled `Box { OutlinedTextField(readOnly = true).clickable {} ; DropdownMenu
 * {} }` shape (AF3's vehicle picker, AF4's fuel-type picker) never actually
 * opened on a real device: `OutlinedTextField`'s own tap handling for focus
 * placement wins the gesture before an externally chained `.clickable` ever
 * sees it, something no test caught because none of the three pickers built
 * that way were ever tap-driven — AF4's own `FuelFlowTest` only edited
 * `fuelFormLitres`. `ExposedDropdownMenuBox` is Material3's own answer to
 * exactly this: a real, working tap target instead.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> DropdownField(
    label: String,
    selectedText: String,
    options: List<T>,
    optionText: @Composable (T) -> String,
    onSelect: (T) -> Unit,
    testTag: String,
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedText,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true)
                .testTag(testTag),
        )
        ExposedDropdownMenuDefaults.DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(optionText(option)) },
                    onClick = {
                        onSelect(option)
                        expanded = false
                    },
                )
            }
        }
    }
}
