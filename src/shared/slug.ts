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

export function slugFor(name: string): string {
  let mapped = ''
  for (const character of name) mapped += TRANSLITERATIONS[character] ?? character

  // toLowerCase is locale-independent by specification — it is toLocaleLowerCase
  // that consults the ambient locale, and the Turkish letters are already gone.
  const slug = mapped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug.length > 0 ? slug : EMPTY_SLUG
}

/**
 * `slugFor`, but empty in becomes empty out.
 *
 * A vehicle must have a directory, so `slugFor('')` gives it one. A cost
 * category must not be invented: a MANUAL entry saved with nothing typed keeps
 * an empty `category`, which reads back as "not categorised" rather than as a
 * category called "vehicle" that the maker never named (§3.3).
 */
export function categorySlug(text: string): string {
  return text.trim().length === 0 ? '' : slugFor(text)
}
