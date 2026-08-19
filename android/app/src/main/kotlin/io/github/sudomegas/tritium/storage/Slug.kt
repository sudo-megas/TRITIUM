package io.github.sudomegas.tritium.storage

/**
 * Turning a name the maker typed into a key a file can hold — a direct port
 * of the desktop's `src/shared/slug.ts`, character for character, because
 * AF8's export must produce the same slug from the same name the desktop
 * would (F16 §2.2: "a vehicle is matched by slug"). Ported from the desktop,
 * not from the family's sibling Android port's own `Slugs.kt`: SAAT solves
 * the Turkish dotless-i casing trap with a locale-independent `lowercase()`,
 * which is correct but insufficient here — it fixes the casing bug without
 * transliterating `ğ ş ö ç ü` to ASCII at all, and the desktop's explicit
 * table does both. Two apps answering "what is this vehicle's slug"
 * differently is a vehicle that duplicates itself the first time a bundle
 * crosses (AF2.md §2.6).
 */

/**
 * Turkish letters, transliterated by an explicit table.
 *
 * Deliberate rather than clever. A locale-aware lowercase maps `İ` to a
 * dotted i and `I` to a dotless `ı` under a Turkish locale and to something
 * else under any other — exactly the kind of ambient-locale dependency
 * XTRITIUM §3 principle 6 forbids, ported here even though nothing on
 * Android polices it the way `audit-locale` does in `src/`. The table gives
 * the same slug on every device, in every locale, forever.
 */
private val TRANSLITERATIONS: Map<Char, Char> = mapOf(
    'ı' to 'i', 'İ' to 'i',
    'ğ' to 'g', 'Ğ' to 'g',
    'ş' to 's', 'Ş' to 's',
    'ö' to 'o', 'Ö' to 'o',
    'ç' to 'c', 'Ç' to 'c',
    'ü' to 'u', 'Ü' to 'u',
)

/** Anything outside `[a-z0-9]`, in runs, becomes a single hyphen. */
private val SLUG_INVALID = Regex("[^a-z0-9]+")

/** The fallback when a name slugifies to nothing at all. */
const val EMPTY_SLUG = "vehicle"

/**
 * The slug itself, with no fallback — empty in, empty out, and empty for
 * anything that holds no letter or digit at all.
 *
 * Kept separate from [slugFor] because the fallback is the caller's
 * decision, not the transliteration's — `issues.md` I-17 is what the
 * desktop's own `categorySlug` cost by delegating to the vehicle fallback
 * instead of staying separate from it.
 */
fun slugify(name: String): String {
    val mapped = buildString {
        for (character in name) append(TRANSLITERATIONS[character] ?: character)
    }

    // Kotlin's no-argument lowercase() is locale-independent by contract —
    // it is lowercase(Locale) that consults the ambient locale — and the
    // Turkish letters are already gone by this point.
    return mapped
        .lowercase()
        .replace(SLUG_INVALID, "-")
        .trim('-')
}

/** A vehicle must have a directory, so a name that slugifies to nothing gets one. */
fun slugFor(name: String): String {
    val slug = slugify(name)
    return slug.ifEmpty { EMPTY_SLUG }
}

/**
 * `slugFor`, with a numeric suffix when the name is already taken —
 * case-insensitively, ported from the desktop's `repository.ts`
 * (`uniqueSlug`), not from SAAT's version: the two are the same algorithm,
 * and the desktop's is the one AF8 must match.
 */
fun uniqueSlug(name: String, taken: Set<String>): String {
    val base = slugFor(name)
    val lowerTaken = taken.mapTo(mutableSetOf()) { it.lowercase() }

    if (base.lowercase() !in lowerTaken) return base

    var suffix = 2
    while ("$base-$suffix".lowercase() in lowerTaken) suffix += 1
    return "$base-$suffix"
}
