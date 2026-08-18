// Which form a window is. XTRITIUM §5.1 — entry forms are real, separate,
// movable Electron windows, so every form window loads the same bundle and is
// told what it is.
//
// The instruction travels in the process arguments, next to the settings F1
// already passes that way. Not in a URL hash: the argument is read by the
// preload, arrives typed, and reads identically under the dev server and a
// packaged loadFile — a hash would have to be parsed twice and spelled two ways.

export const FORM_ARG = '--tritium-form='

export const FORM_KINDS = ['vehicle', 'currency'] as const
export type FormKind = (typeof FORM_KINDS)[number]

export interface FormRequest {
  kind: FormKind
  /** The vehicle being edited. Absent means a new one. */
  slug?: string
}

export function isFormKind(value: unknown): value is FormKind {
  return typeof value === 'string' && (FORM_KINDS as readonly string[]).includes(value)
}

/** Read the request out of argv, or null for the main window. */
export function parseFormRequest(argv: readonly string[]): FormRequest | null {
  const argument = argv.find((value) => value.startsWith(FORM_ARG))
  if (argument === undefined) return null

  try {
    const parsed: unknown = JSON.parse(argument.slice(FORM_ARG.length))
    const candidate = parsed as Partial<FormRequest>
    if (!isFormKind(candidate.kind)) return null

    return {
      kind: candidate.kind,
      ...(typeof candidate.slug === 'string' && candidate.slug.length > 0
        ? { slug: candidate.slug }
        : {})
    }
  } catch {
    return null
  }
}
