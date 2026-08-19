package io.github.sudomegas.tritium.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.sudomegas.tritium.BuildConfig
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.config.AppConfig
import io.github.sudomegas.tritium.config.ThemeMode
import io.github.sudomegas.tritium.storage.Format
import io.github.sudomegas.tritium.storage.Units.CONSUMPTION_SYMBOL
import io.github.sudomegas.tritium.storage.Units.ConsumptionUnit
import io.github.sudomegas.tritium.storage.Units.DISTANCE_SYMBOL
import io.github.sudomegas.tritium.storage.Units.DistanceUnit
import io.github.sudomegas.tritium.storage.Units.VOLUME_SYMBOL
import io.github.sudomegas.tritium.storage.Units.VolumeUnit
import io.github.sudomegas.tritium.ui.SettingsViewModel

/**
 * AF1's language switch, AF8's Export, and About beneath both — the mark,
 * the maker, the version, the source address and the full licence text,
 * XTRITIUM §10 unchanged by platform. Every address is a
 * [SelectionContainer], never a clickable link (XTRITIUM §5).
 */
@Composable
fun SettingsScreen(viewModel: SettingsViewModel) {
    val config by viewModel.config.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Text(
            text = stringResource(id = R.string.settings_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.testTag("settingsHeading"),
        )

        Text(
            text = stringResource(id = R.string.settings_language),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 24.dp),
        )
        LanguageSwitch(current = config.language, onSelect = viewModel::setLanguage)

        HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp))

        UnitsSection(config = config, viewModel = viewModel)

        HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp))

        AppearanceSection(config = config, viewModel = viewModel)

        HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp))

        ExportSection(viewModel)

        HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp))

        AboutSection()
    }
}

/**
 * The phone exports, the desktop imports — one direction (AF8.md, F16's own
 * decision, unchanged). Always every vehicle, one file (AF8.md §1.2): no
 * per-vehicle picker. `ACTION_CREATE_DOCUMENT`, Android's own native save
 * picker, is the AF8.md §1.2 answer to F16 decision 6's reasoning for the
 * desktop's own native dialog — drawn outside this app's own surface, not
 * a Compose modal.
 */
@Composable
private fun ExportSection(viewModel: SettingsViewModel) {
    val context = LocalContext.current
    var status by remember { mutableStateOf<String?>(null) }
    val successText = stringResource(id = R.string.export_success)
    val failureText = stringResource(id = R.string.export_failure)

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        status = runCatching {
            context.contentResolver.openOutputStream(uri)?.use { it.write(viewModel.exportBundle().toByteArray()) }
        }.fold(
            onSuccess = { successText },
            onFailure = { failureText },
        )
    }

    Text(
        text = stringResource(id = R.string.export_title),
        style = MaterialTheme.typography.titleMedium,
    )
    Button(
        modifier = Modifier.padding(top = 8.dp).testTag("exportButton"),
        onClick = {
            status = null
            launcher.launch("tritium-export-${Format.todayIso()}.toml")
        },
    ) {
        Text(stringResource(id = R.string.export_action))
    }
    status?.let {
        Text(text = it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
    }
}

/**
 * The unit boundary's own settings surface (AF9.md §2) — three pickers and
 * a precision stepper. Options render as their raw symbol (`km`, `l`,
 * `l/100km`…), never a translated label: `Units.kt`'s own rule, ported from
 * `units.ts`, is that a symbol is notation, not prose.
 */
@Composable
private fun UnitsSection(config: AppConfig, viewModel: SettingsViewModel) {
    Text(
        text = stringResource(id = R.string.settings_units_title),
        style = MaterialTheme.typography.titleMedium,
    )

    UnitRow(
        label = stringResource(id = R.string.settings_units_distance),
        options = DistanceUnit.entries,
        selected = config.distanceUnit,
        symbol = { DISTANCE_SYMBOL.getValue(it) },
        onSelect = viewModel::setDistanceUnit,
        testTagPrefix = "distanceUnit",
    )
    UnitRow(
        label = stringResource(id = R.string.settings_units_volume),
        options = VolumeUnit.entries,
        selected = config.volumeUnit,
        symbol = { VOLUME_SYMBOL.getValue(it) },
        onSelect = viewModel::setVolumeUnit,
        testTagPrefix = "volumeUnit",
    )
    UnitRow(
        label = stringResource(id = R.string.settings_units_consumption),
        options = ConsumptionUnit.entries,
        selected = config.consumptionUnit,
        symbol = { CONSUMPTION_SYMBOL.getValue(it) },
        onSelect = viewModel::setConsumptionUnit,
        testTagPrefix = "consumptionUnit",
    )

    Text(
        text = stringResource(id = R.string.settings_units_decimals),
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = 16.dp),
    )
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
        TextButton(
            onClick = { viewModel.setDecimalsConsumption(config.decimalsConsumption - 1) },
            enabled = config.decimalsConsumption > 0,
        ) { Text("−") }
        Text(
            text = config.decimalsConsumption.toString(),
            modifier = Modifier.padding(horizontal = 16.dp).testTag("decimalsConsumptionValue"),
        )
        TextButton(
            onClick = { viewModel.setDecimalsConsumption(config.decimalsConsumption + 1) },
            enabled = config.decimalsConsumption < 6,
        ) { Text("+") }
    }
}

@Composable
private fun <T> UnitRow(
    label: String,
    options: List<T>,
    selected: T,
    symbol: (T) -> String,
    onSelect: (T) -> Unit,
    testTagPrefix: String,
) {
    Text(
        text = label,
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = 8.dp),
    )
    Row(modifier = Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            FilterChip(
                modifier = Modifier.testTag("$testTagPrefix${symbol(option)}"),
                selected = option == selected,
                onClick = { onSelect(option) },
                label = { Text(symbol(option)) },
            )
        }
    }
}

/**
 * AF6b.md §1's own answer for what this setting means, built here (AF9.md
 * §1): a light/dark/system toggle and a dynamic-colour switch, not a picker
 * over the desktop's eleven palettes.
 */
@Composable
private fun AppearanceSection(config: AppConfig, viewModel: SettingsViewModel) {
    Text(
        text = stringResource(id = R.string.settings_appearance_title),
        style = MaterialTheme.typography.titleMedium,
    )

    Text(
        text = stringResource(id = R.string.settings_appearance_theme),
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = 8.dp),
    )
    Row(modifier = Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
            modifier = Modifier.testTag("themeModeSystem"),
            selected = config.themeMode == ThemeMode.SYSTEM,
            onClick = { viewModel.setThemeMode(ThemeMode.SYSTEM) },
            label = { Text(stringResource(id = R.string.settings_appearance_theme_system)) },
        )
        FilterChip(
            modifier = Modifier.testTag("themeModeLight"),
            selected = config.themeMode == ThemeMode.LIGHT,
            onClick = { viewModel.setThemeMode(ThemeMode.LIGHT) },
            label = { Text(stringResource(id = R.string.settings_appearance_theme_light)) },
        )
        FilterChip(
            modifier = Modifier.testTag("themeModeDark"),
            selected = config.themeMode == ThemeMode.DARK,
            onClick = { viewModel.setThemeMode(ThemeMode.DARK) },
            label = { Text(stringResource(id = R.string.settings_appearance_theme_dark)) },
        )
    }

    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 16.dp)) {
        Switch(
            modifier = Modifier.testTag("dynamicColorSwitch"),
            checked = config.dynamicColor,
            onCheckedChange = viewModel::setDynamicColor,
        )
        Text(
            text = stringResource(id = R.string.settings_appearance_dynamic_color),
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

@Composable
private fun LanguageSwitch(current: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.padding(top = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(
            selected = current == "en",
            onClick = { onSelect("en") },
            label = { Text(stringResource(id = R.string.settings_language_en)) },
        )
        FilterChip(
            modifier = Modifier.testTag("languageChipTr"),
            selected = current == "tr",
            onClick = { onSelect("tr") },
            label = { Text(stringResource(id = R.string.settings_language_tr)) },
        )
    }
}

@Composable
private fun AboutSection() {
    Text(
        text = stringResource(id = R.string.about_title),
        style = MaterialTheme.typography.titleMedium,
    )

    SelectionContainer {
        Column(modifier = Modifier.padding(top = 8.dp)) {
            AboutRow(stringResource(id = R.string.about_maker), MAKER)
            AboutRow(stringResource(id = R.string.about_version), "v${BuildConfig.VERSION_NAME}")
            AboutRow(stringResource(id = R.string.about_source), SOURCE_ADDRESS)
            AboutRow(stringResource(id = R.string.about_licence), LICENCE_ID)
        }
    }

    Text(
        text = stringResource(id = R.string.about_licence_title),
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = 24.dp),
    )

    val context = LocalContext.current
    var licenceText by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        licenceText = context.assets.open("LICENSE").bufferedReader().use { it.readText() }
    }
    SelectionContainer {
        Text(
            text = licenceText,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun AboutRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(text = label, style = MaterialTheme.typography.labelMedium)
        Text(text = value, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(start = 8.dp))
    }
}

/**
 * The same facts the desktop's About page states (`src/shared/app-meta.ts`)
 * — one repository now that AF1.md §1.1 puts `android/` on `main`, so the
 * source address is the same URL, not a second one to keep in sync.
 */
private const val MAKER = "sudo-megas"
private const val SOURCE_ADDRESS = "https://github.com/sudo-megas/TRITIUM"
private const val LICENCE_ID = "GPL-3.0-or-later"
