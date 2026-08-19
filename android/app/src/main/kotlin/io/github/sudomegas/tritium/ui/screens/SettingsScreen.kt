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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.sudomegas.tritium.BuildConfig
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.Format
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
