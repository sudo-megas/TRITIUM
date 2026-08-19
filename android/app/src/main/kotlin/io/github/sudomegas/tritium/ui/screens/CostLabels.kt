package io.github.sudomegas.tritium.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import io.github.sudomegas.tritium.R
import io.github.sudomegas.tritium.storage.CostGroup

/**
 * Every group/category/payment-method value is a storage slug (XTRITIUM
 * §6.1) — never shown to the maker raw, the same rule AF3/AF4 already
 * followed for every other token-shaped field. MANUAL's typed category has
 * no entry here by design: it is never looked up, only echoed back as typed.
 */
@Composable
fun costGroupLabel(group: CostGroup): String = stringResource(
    when (group) {
        CostGroup.ILK_ALIS -> R.string.costs_group_ilk_alis
        CostGroup.TEKRAR_EDEN -> R.string.costs_group_tekrar_eden
        CostGroup.MANUAL -> R.string.costs_group_manual
    },
)

@Composable
fun costCategoryLabel(token: String): String {
    val res = when (token) {
        "kapora" -> R.string.costs_category_kapora
        "arac-bedeli" -> R.string.costs_category_arac_bedeli
        "noter-ruhsat" -> R.string.costs_category_noter_ruhsat
        "plaka-noter" -> R.string.costs_category_plaka_noter
        "plaka-so" -> R.string.costs_category_plaka_so
        "periyodik-bakim" -> R.string.costs_category_periyodik_bakim
        "mtv-1" -> R.string.costs_category_mtv_1
        "mtv-2" -> R.string.costs_category_mtv_2
        "trafik-sigortasi" -> R.string.costs_category_trafik_sigortasi
        "kasko" -> R.string.costs_category_kasko
        else -> return token
    }
    return stringResource(res)
}

@Composable
fun costPaymentMethodLabel(token: String): String {
    val res = when (token) {
        "eft" -> R.string.costs_method_eft
        "kredi-karti" -> R.string.costs_method_kredi_karti
        "banka-karti" -> R.string.costs_method_banka_karti
        else -> return token
    }
    return stringResource(res)
}
