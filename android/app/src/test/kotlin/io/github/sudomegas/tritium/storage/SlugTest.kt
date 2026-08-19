package io.github.sudomegas.tritium.storage

import java.util.Locale
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test

class SlugTest {

    private val defaultLocale = Locale.getDefault()

    @After
    fun restoreLocale() {
        Locale.setDefault(defaultLocale)
    }

    @Test
    fun `a plain ASCII name slugifies as expected`() {
        assertEquals("kia-sportage", slugFor("Kia Sportage"))
    }

    @Test
    fun `every Turkish letter in the table transliterates to ASCII`() {
        assertEquals("isik-goruslu-cocuk", slugFor("İşık Görüşlü Çocuk"))
    }

    @Test
    fun `an empty or symbol-only name falls back to the vehicle default`() {
        assertEquals(EMPTY_SLUG, slugFor(""))
        assertEquals(EMPTY_SLUG, slugFor("!!!"))
    }

    @Test
    fun `slugify has no fallback, unlike slugFor`() {
        // issues.md I-17: the fallback belongs to the caller, never to the
        // transliteration itself.
        assertEquals("", slugify(""))
        assertEquals("", slugify("!!!"))
    }

    @Test
    fun `the slug is identical under the Turkish locale and under English`() {
        // The dotless-i trap: a locale-aware lowercase maps 'I' to Turkish
        // dotless 'ı' under a Turkish locale, changing which characters make
        // it through [a-z0-9]. Proved by actually flipping the JVM default
        // locale, not by trusting the comment above slugify().
        val name = "İstanbul Işık"

        // The two-argument constructor, not Locale.of(...) — that overload
        // is JDK 19+ and this app's minSdk is 26; Android's own libcore is
        // not guaranteed to carry it, where the constructor always has been.
        @Suppress("DEPRECATION")
        Locale.setDefault(Locale("tr", "TR"))
        val turkish = slugFor(name)

        Locale.setDefault(Locale.US)
        val english = slugFor(name)

        assertEquals(turkish, english)
        assertEquals("istanbul-isik", turkish)
    }

    @Test
    fun `uniqueSlug returns the base when it is not taken`() {
        assertEquals("kia-sportage", uniqueSlug("Kia Sportage", emptySet()))
    }

    @Test
    fun `uniqueSlug resolves a collision with a numeric suffix`() {
        assertEquals("kia-sportage-2", uniqueSlug("Kia Sportage", setOf("kia-sportage")))
        assertEquals(
            "kia-sportage-3",
            uniqueSlug("Kia Sportage", setOf("kia-sportage", "kia-sportage-2")),
        )
    }

    @Test
    fun `uniqueSlug compares case-insensitively`() {
        assertEquals("kia-sportage-2", uniqueSlug("Kia Sportage", setOf("Kia-Sportage")))
    }
}
