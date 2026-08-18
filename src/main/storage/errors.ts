// A data file that will not parse is an emergency, not a shrug.
//
// settings.toml falls back to defaults when it is corrupt, because losing a
// palette choice costs nothing. A vehicle's records are different: falling back
// to "no entries" and then saving would erase what the maker spent years
// entering. So a data file that cannot be parsed raises this, the caller
// reports it, and the file on disk is left exactly as it was found.

export class CorruptFileError extends Error {
  readonly file: string

  constructor(file: string, cause: unknown) {
    super(`unreadable TOML: ${file}`)
    this.name = 'CorruptFileError'
    this.file = file
    this.cause = cause
  }
}
