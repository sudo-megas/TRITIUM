package io.github.sudomegas.tritium.config

import io.github.sudomegas.tritium.storage.Units.ConsumptionUnit
import io.github.sudomegas.tritium.storage.Units.DistanceUnit
import io.github.sudomegas.tritium.storage.Units.VolumeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ConfigStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun `a missing file loads as defaults, with no error`() {
        val store = ConfigStore(tmp.root)
        val load = store.load()
        assertEquals(AppConfig(), load.config)
        assertEquals(null, load.error)
    }

    @Test
    fun `save then load round-trips the language through tomlkt`() {
        val store = ConfigStore(tmp.root)
        store.save(AppConfig(language = "tr"))

        val load = store.load()
        assertEquals("tr", load.config.language)
        assertEquals(null, load.error)
    }

    @Test
    fun `currency and active_vehicle round-trip, matching the desktop's own key names`() {
        val store = ConfigStore(tmp.root)
        store.save(AppConfig(language = "en", currency = "TRY", activeVehicleSlug = "kia-sportage"))

        val load = store.load()
        assertEquals("TRY", load.config.currency)
        assertEquals("kia-sportage", load.config.activeVehicleSlug)

        val text = java.io.File(tmp.root, "settings.toml").readText()
        assertTrue("currency = \"TRY\"" in text)
        assertTrue("active_vehicle = \"kia-sportage\"" in text)
    }

    @Test
    fun `currency absent is the signal AF3's first-run question fires on, not a stored default`() {
        val store = ConfigStore(tmp.root)
        store.save(AppConfig(language = "en"))

        val text = java.io.File(tmp.root, "settings.toml").readText()
        assertTrue("currency" !in text)
        assertEquals(null, store.load().config.currency)
    }

    @Test
    fun `the written file carries schema_version and the desktop's own key shape`() {
        val store = ConfigStore(tmp.root)
        store.save(AppConfig(language = "en"))

        val text = java.io.File(tmp.root, "settings.toml").readText()
        assertTrue("schema_version = 1" in text)
        assertTrue("[general]" in text)
        assertTrue("language = \"en\"" in text)
    }

    @Test
    fun `no key is written as a literal null`() {
        // tomlkt's default emits `key = null` for an absent optional, which no
        // TOML parser — including this one — reads back. explicitNulls = false
        // is what prevents that; this asserts the setting actually took effect
        // rather than trusting the Toml{} block was configured correctly.
        val store = ConfigStore(tmp.root)
        store.save(AppConfig(language = "en"))

        val text = java.io.File(tmp.root, "settings.toml").readText()
        assertTrue("= null" !in text)
    }

    @Test
    fun `a leading BOM does not break the read`() {
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText("\uFEFF" + "schema_version = 1\n[general]\nlanguage = \"tr\"\n")

        val load = ConfigStore(tmp.root).load()
        assertEquals("tr", load.config.language)
        assertEquals(null, load.error)
    }

    @Test
    fun `an unrecognised key is ignored rather than failing the parse`() {
        // A settings.toml written by a later version of this app must not stop
        // an older AF-milestone's app from starting.
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText(
            "schema_version = 1\n" +
                "[general]\n" +
                "language = \"en\"\n" +
                "currency = \"TRY\"\n",
        )

        val load = ConfigStore(tmp.root).load()
        assertEquals("en", load.config.language)
        assertEquals(null, load.error)
    }

    @Test
    fun `a malformed file loads as defaults, with the error surfaced`() {
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText("this is not valid toml [[[")

        val load = ConfigStore(tmp.root).load()
        assertEquals(AppConfig(), load.config)
        assertTrue(load.error != null)
    }

    @Test
    fun `saving over an unreadable file rescues it rather than overwriting it`() {
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText("this is not valid toml [[[")

        ConfigStore(tmp.root).save(AppConfig(language = "tr"))

        val rescued = java.io.File(tmp.root, "settings.toml.broken")
        assertTrue("the broken file must be moved aside, not deleted", rescued.exists())
        assertEquals("this is not valid toml [[[", rescued.readText())

        val load = ConfigStore(tmp.root).load()
        assertEquals("tr", load.config.language)
    }

    @Test
    fun `units, format and appearance round-trip through tomlkt`() {
        val store = ConfigStore(tmp.root)
        store.save(
            AppConfig(
                distanceUnit = DistanceUnit.MI,
                volumeUnit = VolumeUnit.GAL,
                consumptionUnit = ConsumptionUnit.MPG,
                decimalsConsumption = 3,
                themeMode = ThemeMode.DARK,
                dynamicColor = false,
            ),
        )

        val load = store.load()
        assertEquals(DistanceUnit.MI, load.config.distanceUnit)
        assertEquals(VolumeUnit.GAL, load.config.volumeUnit)
        assertEquals(ConsumptionUnit.MPG, load.config.consumptionUnit)
        assertEquals(3, load.config.decimalsConsumption)
        assertEquals(ThemeMode.DARK, load.config.themeMode)
        assertEquals(false, load.config.dynamicColor)

        val text = java.io.File(tmp.root, "settings.toml").readText()
        assertTrue("[units]" in text)
        assertTrue("distance = \"mi\"" in text)
        assertTrue("[format]" in text)
        assertTrue("[appearance]" in text)
        assertTrue("theme_mode = \"dark\"" in text)
        // AF9.md §1 — no Android feature reads a cost-per-km figure.
        assertTrue("decimals_cost_per_km" !in text)
        assertTrue("palette" !in text)
    }

    @Test
    fun `a malformed unit token falls back to the metric default rather than crashing`() {
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText(
            "schema_version = 1\n" +
                "[units]\n" +
                "distance = \"furlongs\"\n" +
                "[appearance]\n" +
                "theme_mode = \"solarised\"\n",
        )

        val load = ConfigStore(tmp.root).load()
        assertEquals(DistanceUnit.KM, load.config.distanceUnit)
        assertEquals(ThemeMode.SYSTEM, load.config.themeMode)
        assertEquals(null, load.error)
    }

    @Test
    fun `a pre-AF9 file with no units, format or appearance section loads to their defaults`() {
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText("schema_version = 1\n[general]\nlanguage = \"tr\"\n")

        val load = ConfigStore(tmp.root).load()
        assertEquals("tr", load.config.language)
        assertEquals(AppConfig().distanceUnit, load.config.distanceUnit)
        assertEquals(AppConfig().decimalsConsumption, load.config.decimalsConsumption)
        assertEquals(AppConfig().themeMode, load.config.themeMode)
        assertEquals(AppConfig().dynamicColor, load.config.dynamicColor)
    }

    // -- AF12: keys this build does not model survive a save -----------------

    @Test
    fun `a top-level key this build does not model survives a save`() {
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText("schema_version = 1\nfuture_toplevel = \"kept\"\n[general]\nlanguage = \"en\"\n")

        val store = ConfigStore(tmp.root)
        store.load()
        store.save(AppConfig(language = "tr"))

        val text = file.readText()
        assertTrue("future_toplevel" in text)
        assertEquals("tr", store.load().config.language)
    }

    @Test
    fun `a sibling key inside a table this build does touch survives a save`() {
        // A newer Android build's [format] key, or the desktop's own
        // decimals_cost_per_km (AF9.md §1 — no feature here reads it, but a
        // shared file could still carry it from the desktop side one day).
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText(
            "schema_version = 1\n" +
                "[general]\n" +
                "language = \"en\"\n" +
                "[format]\n" +
                "decimals_consumption = 2\n" +
                "decimals_cost_per_km = 3\n",
        )

        val store = ConfigStore(tmp.root)
        store.load()
        store.save(AppConfig(language = "en", decimalsConsumption = 4))

        val text = file.readText()
        assertTrue("decimals_cost_per_km = 3" in text)
        assertTrue("decimals_consumption = 4" in text)
    }

    @Test
    fun `a carried key never overrides a value this save actually sets`() {
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText("schema_version = 1\n[general]\nlanguage = \"en\"\ncurrency = \"OLD\"\n")

        val store = ConfigStore(tmp.root)
        store.load()
        // currency is a known key, not a carried one — this save's own value wins.
        store.save(AppConfig(language = "en", currency = "TRY"))

        assertEquals("TRY", store.load().config.currency)
    }

    @Test
    fun `a save carries the file's own unknown keys even without an explicit load first`() {
        // setAsideIfUnreadable reads the file to check it parses before every
        // save, and that read populates the same carry-forward state load
        // does — so a caller that only ever calls save (there is exactly one
        // in this app, ConfigState.update) still keeps what the file held.
        val file = java.io.File(tmp.root, "settings.toml")
        file.writeText("schema_version = 1\nfuture_toplevel = \"kept\"\n[general]\nlanguage = \"en\"\n")

        ConfigStore(tmp.root).save(AppConfig(language = "tr"))

        assertTrue("future_toplevel" in file.readText())
    }

    @Test
    fun `a second broken file never overwrites the first rescue`() {
        val store = ConfigStore(tmp.root)
        val file = java.io.File(tmp.root, "settings.toml")

        file.writeText("broken one [[[")
        store.save(AppConfig(language = "en"))

        // Corrupt the freshly-saved file a second time and save again.
        file.writeText("broken two [[[")
        store.save(AppConfig(language = "tr"))

        val first = java.io.File(tmp.root, "settings.toml.broken")
        val second = java.io.File(tmp.root, "settings.toml.broken-2")
        assertEquals("broken one [[[", first.readText())
        assertEquals("broken two [[[", second.readText())
    }
}
