package io.github.sudomegas.tritium.storage

import java.io.File

/**
 * A record file will not parse. Ported from the desktop's `CorruptFileError`
 * (`errors.ts`) — thrown out of a read rather than swallowed into an empty
 * document, because a corrupt **data** file falling back to "no entries" and
 * then being saved would erase the maker's records (AF2.md §2.5). Settings
 * can fall back to defaults; a vehicle's records never can.
 */
class CorruptRecordException(val file: File, cause: Throwable?) :
    Exception("${file.name}: ${cause?.message ?: cause?.let { it::class.simpleName } ?: "could not be parsed as TOML"}", cause)
