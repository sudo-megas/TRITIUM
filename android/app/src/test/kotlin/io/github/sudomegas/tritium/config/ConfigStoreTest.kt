package io.github.sudomegas.tritium.config

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
