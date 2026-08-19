package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.TomlArray
import dev.eav.tomlkt.TomlElement
import dev.eav.tomlkt.TomlLiteral
import dev.eav.tomlkt.TomlNull
import dev.eav.tomlkt.TomlTable
import dev.eav.tomlkt.toBooleanOrNull
import dev.eav.tomlkt.toDoubleOrNull
import dev.eav.tomlkt.toLocalDateOrNull
import dev.eav.tomlkt.toLongOrNull

/**
 * The small TOML layer the record files share — a port of the desktop's
 * `src/main/storage/toml.ts`, against tomlkt's DOCUMENT model
 * (`TomlTable`/`TomlElement`) rather than `@Serializable` data classes, for
 * the reason `WatchToml.kt` in the family's sibling Android port states: a
 * record file is one the maker may hand-edit, and a typed decode throws on
 * one mistyped field and costs the whole file, where reading the tree costs
 * one field.
 *
 * **Reading is lenient, matching the desktop's actual leniency, not SAAT's
 * more permissive one** — a wrong type reads as the field's zero value
 * rather than being coerced from a string or collected as a warning.
 * `readBoolean` in particular only accepts a literal `true`/`false`, exactly
 * as the desktop's `value === true` does.
 *
 * **Writing does not use tomlkt's own serialiser.** XTRITIUM §4.4 fixes the
 * exact text of every record file, and a general-purpose serialiser cannot
 * meet it — dropping `11746.00`'s trailing zero, ordering keys however a
 * table happened to be built. So each record file emits its own text, key by
 * key, in §4.4's order, using [line] and friends below.
 */

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

fun asTableArray(element: TomlElement?): List<TomlTable> =
    (element as? TomlArray)?.filterIsInstance<TomlTable>() ?: emptyList()

fun readString(table: TomlTable?, key: String): String {
    val literal = table?.get(key) as? TomlLiteral ?: return ""
    return if (literal.type == TomlLiteral.Type.String) literal.content else ""
}

/**
 * A whole number. Accepts a TOML integer or a TOML float that rounds to one
 * — `19764.0` is as valid a whole number as `19764` — matching the
 * desktop's `readInteger`, which does not distinguish JS numbers by how
 * they were written either.
 */
fun readInteger(table: TomlTable?, key: String): Int {
    val literal = table?.get(key) as? TomlLiteral ?: return 0
    return when (literal.type) {
        TomlLiteral.Type.Integer -> literal.toLongOrNull()?.toInt() ?: 0
        TomlLiteral.Type.Float -> literal.toDoubleOrNull()?.let { Math.round(it).toInt() } ?: 0
        else -> 0
    }
}

/** Any TOML number, integer or float, as a `Double` — for the [Scaled] conversions. */
fun readNumber(table: TomlTable?, key: String): Double {
    val literal = table?.get(key) as? TomlLiteral ?: return 0.0
    return when (literal.type) {
        TomlLiteral.Type.Integer, TomlLiteral.Type.Float -> literal.toDoubleOrNull() ?: 0.0
        else -> 0.0
    }
}

/** Only a literal `true`, matching the desktop's `value === true` exactly — no coercion at all. */
fun readBoolean(table: TomlTable?, key: String): Boolean {
    val literal = table?.get(key) as? TomlLiteral ?: return false
    return literal.type == TomlLiteral.Type.Boolean && literal.toBooleanOrNull() == true
}

/**
 * Normalise whatever tomlkt produced for a date into `YYYY-MM-DD`.
 *
 * Accepts a genuine TOML local date, or a plain string — a hand-edited file
 * may have quoted one, and the desktop's own `readDate` accepts a string
 * input the same way. A TOML local date carries no time and no zone, so
 * there is no timezone-shift risk to guard against here the way a
 * `LocalDateTime`/`OffsetDateTime` would need.
 */
fun readDate(table: TomlTable?, key: String): String {
    val literal = table?.get(key) as? TomlLiteral ?: return ""
    return when (literal.type) {
        TomlLiteral.Type.LocalDate -> literal.toLocalDateOrNull()?.toString() ?: ""
        TomlLiteral.Type.String -> literal.content
        else -> ""
    }
}

/** Collect the keys of [table] that are not in [known], as elements ready to carry forward. */
fun unknownKeys(table: TomlTable, known: Set<String>): Map<String, TomlElement> =
    table.entries
        .filter { (key, value) -> key !in known && value !is TomlNull }
        .associate { (key, value) -> key to value }

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * A TOML basic string. Escapes exactly what TOML's basic-string grammar
 * requires: backslash, double quote, and the control characters — the same
 * set JSON escapes, which is why the desktop gets away with `JSON.stringify`
 * for this. Kotlin has no such shortcut on hand, so this is hand-written
 * rather than borrowed from a JSON library this project has no other reason
 * to depend on.
 */
fun basicString(value: String): String {
    val out = StringBuilder(value.length + 2)
    out.append('"')
    for (character in value) {
        when (character) {
            '"' -> out.append("\\\"")
            '\\' -> out.append("\\\\")
            '\n' -> out.append("\\n")
            '\r' -> out.append("\\r")
            '\t' -> out.append("\\t")
            '\b' -> out.append("\\b")
            '\u000C' -> out.append("\\f")
            else -> if (character.code < 0x20) {
                out.append("\\u").append(character.code.toString(16).padStart(4, '0'))
            } else {
                out.append(character)
            }
        }
    }
    out.append('"')
    return out.toString()
}

/**
 * Render an unrecognised element inline. Unknown keys must survive a
 * read-modify-write untouched, and they can appear inside an `[[entry]]`
 * where a nested table header would be a syntax error — so everything is
 * rendered as an inline value, which is legal wherever a value is legal,
 * exactly as the desktop's `inlineValue` does.
 */
fun inlineValue(element: TomlElement): String = when (element) {
    is TomlLiteral -> if (element.type == TomlLiteral.Type.String) {
        basicString(element.content)
    } else {
        element.content
    }

    is TomlArray -> element.joinToString(prefix = "[", postfix = "]", separator = ", ") { inlineValue(it) }
    is TomlTable -> element.entries.joinToString(prefix = "{ ", postfix = " }", separator = ", ") { (key, value) ->
        "$key = ${inlineValue(value)}"
    }

    is TomlNull -> "\"\""
}

/** One `key = value` line, the literal already rendered. */
fun line(key: String, literal: String): String = "$key = $literal"

/**
 * A date line, or nothing at all. TOML has no empty date literal, so a field
 * the maker has not filled in — a vehicle with no inspection date yet — is
 * omitted rather than written as a syntax error. Dates are emitted bare:
 * quoting one would turn it into a string and it would never parse back as
 * a date.
 */
fun dateLines(key: String, value: String): List<String> =
    if (isDateString(value)) listOf(line(key, value)) else emptyList()

/**
 * Append the keys this milestone does not recognise, in the order tomlkt
 * handed them over. Plaintext the maker can repair in a text editor must
 * never lose a line because the code that rewrote it did not know what the
 * line was for.
 */
fun carriedLines(rest: Map<String, TomlElement>): List<String> =
    rest.map { (key, value) -> line(key, inlineValue(value)) }
