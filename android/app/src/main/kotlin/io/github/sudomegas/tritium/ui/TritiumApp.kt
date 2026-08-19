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
import androidx.navigation.toRoute
import io.github.sudomegas.tritium.TritiumApplication
import io.github.sudomegas.tritium.storage.UnitFormat
import io.github.sudomegas.tritium.ui.nav.CostFormRoute
import io.github.sudomegas.tritium.ui.nav.CostsRoute
import io.github.sudomegas.tritium.ui.nav.FuelFormRoute
import io.github.sudomegas.tritium.ui.nav.FuelQuickAddRoute
import io.github.sudomegas.tritium.ui.nav.FuelRoute
import io.github.sudomegas.tritium.ui.nav.HomeRoute
import io.github.sudomegas.tritium.ui.nav.ServiceFormRoute
import io.github.sudomegas.tritium.ui.nav.ServiceRoute
import io.github.sudomegas.tritium.ui.nav.SettingsRoute
import io.github.sudomegas.tritium.ui.nav.TopLevelDestination
import io.github.sudomegas.tritium.ui.nav.VehicleFormRoute
import io.github.sudomegas.tritium.ui.screens.CostFormScreen
import io.github.sudomegas.tritium.ui.screens.CostScreen
import io.github.sudomegas.tritium.ui.screens.FuelFormScreen
import io.github.sudomegas.tritium.ui.screens.FuelQuickAddScreen
import io.github.sudomegas.tritium.ui.screens.FuelScreen
import io.github.sudomegas.tritium.ui.screens.HomeScreen
import io.github.sudomegas.tritium.ui.screens.ServiceFormScreen
import io.github.sudomegas.tritium.ui.screens.ServiceScreen
import io.github.sudomegas.tritium.ui.screens.SettingsScreen
import io.github.sudomegas.tritium.ui.screens.VehicleFormScreen

/**
 * The shell. Bottom navigation between Home and Settings, hidden while the
 * vehicle form is open — AF3.md decision 2 treats the form as a genuine
 * full-screen destination, not a tab's content, the same way the desktop's
 * own separate window has nothing to do with its tab bar either. One shared
 * snackbar for a `settings.toml` write that failed (AF1.md §2.1 decisions 5,
 * 7, 8), and — from AF3 — the first-run currency question (XTRITIUM §8),
 * shown over whatever is on screen and answerable from nowhere else.
 */
@Composable
fun TritiumApp(app: TritiumApplication) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()

    val settingsViewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.factory(app))
    val homeViewModel: HomeViewModel = viewModel(factory = HomeViewModel.factory(app))
    val fuelViewModel: FuelViewModel = viewModel(factory = FuelViewModel.factory(app))
    val costViewModel: CostViewModel = viewModel(factory = CostViewModel.factory(app))
    val serviceViewModel: ServiceViewModel = viewModel(factory = ServiceViewModel.factory(app))
    val error by settingsViewModel.error.collectAsStateWithLifecycle()
    val config by settingsViewModel.config.collectAsStateWithLifecycle()
    val unitFormat = remember(config.distanceUnit, config.volumeUnit, config.consumptionUnit, config.decimalsConsumption) {
        UnitFormat(config.distanceUnit, config.volumeUnit, config.consumptionUnit, config.decimalsConsumption)
    }

    val snackbarHostState = remember { SnackbarHostState() }

    // A settings write that failed is surfaced, not logged and forgotten — the
    // same discipline ConfigState already applies to the file itself.
    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            settingsViewModel.clearError()
        }
    }

    val onFormScreen = backStackEntry?.destination?.hierarchy?.any {
        it.hasRoute(VehicleFormRoute::class) ||
            it.hasRoute(FuelQuickAddRoute::class) ||
            it.hasRoute(FuelFormRoute::class) ||
            it.hasRoute(CostFormRoute::class) ||
            it.hasRoute(ServiceFormRoute::class)
    } == true

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (!onFormScreen) {
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
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = HomeRoute,
            modifier = Modifier.padding(padding),
        ) {
            composable<HomeRoute> {
                HomeScreen(
                    viewModel = homeViewModel,
                    currency = config.currency,
                    unitFormat = unitFormat,
                    onAddVehicle = { navController.navigate(VehicleFormRoute()) },
                    onEditVehicle = { slug -> navController.navigate(VehicleFormRoute(slug)) },
                )
            }
            composable<SettingsRoute> { SettingsScreen(viewModel = settingsViewModel) }
            composable<VehicleFormRoute> { entry ->
                val route: VehicleFormRoute = entry.toRoute()
                VehicleFormScreen(
                    viewModel = homeViewModel,
                    slug = route.slug,
                    unitFormat = unitFormat,
                    onSaved = { navController.popBackStack() },
                )
            }
            composable<FuelRoute> {
                FuelScreen(
                    viewModel = fuelViewModel,
                    currency = config.currency,
                    unitFormat = unitFormat,
                    onQuickAdd = { navController.navigate(FuelQuickAddRoute) },
                    onFullAdd = { navController.navigate(FuelFormRoute()) },
                    onEditEntry = { entryId -> navController.navigate(FuelFormRoute(entryId)) },
                )
            }
            composable<FuelQuickAddRoute> {
                FuelQuickAddScreen(
                    viewModel = fuelViewModel,
                    currency = config.currency,
                    unitFormat = unitFormat,
                    onSaved = { navController.popBackStack() },
                )
            }
            composable<FuelFormRoute> { entry ->
                val route: FuelFormRoute = entry.toRoute()
                FuelFormScreen(
                    viewModel = fuelViewModel,
                    entryId = route.entryId,
                    currency = config.currency,
                    unitFormat = unitFormat,
                    onSaved = { navController.popBackStack() },
                )
            }
            composable<CostsRoute> {
                CostScreen(
                    viewModel = costViewModel,
                    currency = config.currency,
                    onAddCost = { navController.navigate(CostFormRoute()) },
                    onEditEntry = { entryId -> navController.navigate(CostFormRoute(entryId)) },
                )
            }
            composable<CostFormRoute> { entry ->
                val route: CostFormRoute = entry.toRoute()
                CostFormScreen(
                    viewModel = costViewModel,
                    entryId = route.entryId,
                    currency = config.currency,
                    onSaved = { navController.popBackStack() },
                )
            }
            composable<ServiceRoute> {
                ServiceScreen(
                    viewModel = serviceViewModel,
                    currency = config.currency,
                    unitFormat = unitFormat,
                    onAddService = { navController.navigate(ServiceFormRoute()) },
                    onEditEntry = { entryId -> navController.navigate(ServiceFormRoute(entryId)) },
                )
            }
            composable<ServiceFormRoute> { entry ->
                val route: ServiceFormRoute = entry.toRoute()
                ServiceFormScreen(
                    viewModel = serviceViewModel,
                    entryId = route.entryId,
                    currency = config.currency,
                    unitFormat = unitFormat,
                    onSaved = { navController.popBackStack() },
                )
            }
        }
    }

    // XTRITIUM §8: fires once, at launch, when currency is absent — never
    // shown again once answered, and answerable from nowhere else (no
    // settings screen offers to change it). Drawn last, over the shell,
    // rather than gating the NavHost itself, so the shell beneath it is
    // already the real one the moment it is dismissed.
    if (config.currency == null) {
        CurrencyAskDialog(onConfirm = { code -> settingsViewModel.setCurrency(code) })
    }
}
