package io.github.sudomegas.tritium.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.ui.nav.HomeRoute
import io.github.sudomegas.tritium.ui.nav.SettingsRoute
import io.github.sudomegas.tritium.ui.nav.TopLevelDestination
import io.github.sudomegas.tritium.ui.screens.HomeScreen
import io.github.sudomegas.tritium.ui.screens.SettingsScreen

/**
 * The shell: two placeholder destinations, a bottom navigation bar, and one
 * shared snackbar for a `settings.toml` write that failed — AF1.md §2.1
 * decisions 5, 7 and 8. Real destinations, their count, and their icons are
 * all design-phase property, not this document's (AF1.md §1.2); the bar
 * itself is AF1's, the same relationship F1.md drew for the desktop's own
 * provisional tab bar.
 */
@Composable
fun TritiumApp(app: TritiumApplication) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()

    val settingsViewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.factory(app))
    val error by settingsViewModel.error.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }

    // A settings write that failed is surfaced, not logged and forgotten — the
    // same discipline ConfigState already applies to the file itself.
    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            settingsViewModel.clearError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            NavigationBar {
                TopLevelDestination.entries.forEach { destination ->
                    val selected = backStackEntry?.destination
                        ?.hierarchy
                        ?.any { it.hasRoute(destination.route::class) } == true

                    NavigationBarItem(
                        modifier = Modifier.testTag("nav_${destination.name.lowercase()}"),
                        selected = selected,
                        onClick = {
                            navController.navigate(destination.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {},
                        label = { Text(stringResource(destination.labelRes)) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = HomeRoute,
            modifier = Modifier.padding(padding),
        ) {
            composable<HomeRoute> { HomeScreen() }
            composable<SettingsRoute> { SettingsScreen(viewModel = settingsViewModel) }
        }
    }
}
