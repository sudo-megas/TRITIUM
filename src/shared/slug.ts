// Turning a name the maker typed into a key a file can hold.
//
// Two callers, neither of which owns it. F3's repository allocates a vehicle
// directory from the vehicle's name (XTRITIUM §4.1); F5's cost form turns a
// typed MANUAL category into the key stored in costs.toml (§6.1 — "add
// custom: …"). Both need the same answer to the same question, and a second
// implementation of it would be a second set of Turkish letters to get wrong.

/**
 * Turkish letters, transliterated by an explicit table.
 *
 * This is deliberate rather than clever. A locale-aware lowercase would map
 * "İ" to a dotted i and "I" to a dotless ı under a Turkish locale and to
 * something else entirely under any other — which is exactly the kind of
 * ambient-locale dependency XTRITIUM §3.6 forbids and audit-locale hunts for.
 * The table gives the same slug on every machine, in every locale, forever.
 */
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ı: 'i',
  İ: 'i',
  ğ: 'g',
  Ğ: 'g',
  ş: 's',
  Ş: 's',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
  ü: 'u',
  Ü: 'u'
}

/** The fallback when a name slugifies to nothing at all. */
export const EMPTY_SLUG = 'vehicle'

/**
 * The slug itself, with no fallback — empty in, empty out, and empty for
 * anything that holds no letter or digit at all.
 *
 * Kept separate from `slugFor` because the fallback is the caller's decision
 * and not the transliteration's. F12 found out why the hard way: see below.
 */
export function slugify(name: string): string {
  let mapped = ''
  for (const character of name) mapped += TRANSLITERATIONS[character] ?? character

  // toLowerCase is locale-independent by specification — it is toLocaleLowerCase
  // that consults the ambient locale, and the Turkish letters are already gone.
  return mapped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A vehicle must have a directory, so a name that slugifies to nothing gets one. */
export function slugFor(name: string): string {
  const slug = slugify(name)
  return slug.length > 0 ? slug : EMPTY_SLUG
}

/**
 * A category, which must NOT be invented.
 *
 * A MANUAL entry saved with nothing usable typed keeps an empty `category` and
 * reads back as "not categorised" — never as a category the maker did not name
 * (§3.3).
 *
 * This used to delegate to `slugFor` for anything non-blank, and `issues.md`
 * I-17 is what that cost: a category typed as `!!!` or as an emoji has no
 * letters to slugify, fell through to the vehicle fallback, and was stored as a
 * category literally called **"vehicle"** — which passed the cost form's
 * "a category was chosen" gate on the way. It now slugifies directly, so a
 * category with nothing in it stays nothing, while a maker who genuinely types
 * "Vehicle" still gets `vehicle`.
 */
export function categorySlug(text: string): string {
  return slugify(text)
}
