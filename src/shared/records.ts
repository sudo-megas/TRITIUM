// The record shapes of XTRITIUM §4.4, shared by main, preload and renderer.
//
// Every money and measure field below holds a SCALED INTEGER (§4.3, see
// scaled.ts) — never a float. Dates are plain `YYYY-MM-DD` strings: TOML local
// dates carry no time and no zone, and a Date object crossing this boundary
// would drag both in, shifting a fill-up a day either side of midnight.
//
// Derived values are never stored (§4.4): a fill-up's total is litres × price,
// computed where it is shown, absent from the file.

export const RECORD_SCHEMA_VERSION = 1

/** `YYYY-MM-DD`, the only date shape TRITIUM writes or accepts. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDateString(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value)
}

// ---------------------------------------------------------------------------
// Vocabularies — fixed lists live here as data, not as strings scattered
// through the code that happens to need them.
// ---------------------------------------------------------------------------

/**
 * XTRITIUM §4.4: fuel_type comes "from a fixed pick-list (95, 97, dizel, LPG…)".
 * The ellipsis is the maker's — the final list is F4's business. These are the
 * four the constitution names.
 */
export const FUEL_TYPES = ['Kurşunsuz 95', 'Kurşunsuz 97', 'Dizel', 'LPG'] as const
export type FuelType = (typeof FUEL_TYPES)[number]

/** XTRITIUM §6.1 — the three columns of the category tree. */
export const COST_GROUPS = ['ilk-alis', 'tekrar-eden', 'manual'] as const
export type CostGroup = (typeof COST_GROUPS)[number]

/**
 * XTRITIUM §6.1, the user-authored tree, final. `manual` carries no fixed
 * categories: it is where the maker adds their own.
 *
 * Periyodik Bakım appears here for completeness but its entries do not live in
 * costs.toml — they land in service.toml (§6.2).
 */
export const COST_CATEGORIES: Readonly<Record<CostGroup, readonly string[]>> = {
  'ilk-alis': ['kapora', 'arac-bedeli', 'noter-ruhsat', 'plaka-noter', 'plaka-so'],
  'tekrar-eden': ['periyodik-bakim', 'mtv-1', 'mtv-2', 'trafik-sigortasi', 'kasko'],
  manual: []
}

/** XTRITIUM §4.4 — "editable list; ships: EFT, kredi kartı, banka kartı". */
export const PAYMENT_METHODS = ['eft', 'kredi-karti', 'banka-karti'] as const

export function isCostGroup(value: unknown): value is CostGroup {
  return typeof value === 'string' && (COST_GROUPS as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// The four records
// ---------------------------------------------------------------------------

/** vehicle.toml — a flat table. NO photo field: vehicles have no photos anywhere. */
export interface Vehicle {
  name: string
  make: string
  model: string
  year: number
  engine: string
  fuel_spec: string
  plate: string
  vin: string
  /** scaled ×10 */
  tank_capacity_l: number
  purchase_date: string
  /** scaled ×100 */
  purchase_price: number
  registration_date: string
  /** Passive reference only — nothing watches it, nothing notifies. */
  inspection_due: string
}

/** fuel.toml — one [[entry]] per fill-up. */
export interface FuelEntry {
  id: string
  date: string
  odometer_km: number
  /** scaled ×1000 */
  litres: number
  /** scaled ×1000 */
  price_per_litre: number
  /** Meaningful — the consumption engine reads it (§5.2). */
  full_tank: boolean
  fuel_type: string
}

/** costs.toml — İLK ALIŞ, TEKRAR EDEN (except Periyodik Bakım), and manual entries. */
export interface CostEntry {
  id: string
  date: string
  group: CostGroup
  category: string
  title: string
  /** scaled ×100 */
  amount: number
  /** Negative costs — payouts, refunds — are income. */
  income: boolean
  payment_method: string
  bank: string
  /** Plain text, no engine behind it. */
  instalment: string
  note: string
}

/** service.toml — the Periyodik Bakım sheet's shape. */
export interface ServiceEntry {
  id: string
  date: string
  part: string
  odometer_km: number
  /** scaled ×100 */
  amount: number
  /** A pasted address: selectable text ONLY, never a link (§3.5). */
  vendor: string
}

// ---------------------------------------------------------------------------
// Ids — f-0001, c-0001, s-0001
// ---------------------------------------------------------------------------

export const ID_PREFIXES = { fuel: 'f', cost: 'c', service: 's' } as const
export type RecordKind = keyof typeof ID_PREFIXES

export function formatId(kind: RecordKind, sequence: number): string {
  return `${ID_PREFIXES[kind]}-${sequence.toString().padStart(4, '0')}`
}

/**
 * The numeric part of an id, or 0 if it does not parse.
 *
 * Ids are allocated from the highest one already in the file rather than from a
 * count, so a hand-edited file — the maker deleting a middle entry in Neovim —
 * cannot produce a duplicate.
 */
export function idSequence(id: string): number {
  const match = /^[fcs]-(\d+)$/.exec(id)
  if (match === null) return 0
  return Number.parseInt(match[1] as string, 10)
}

export function nextId(kind: RecordKind, existing: readonly { id: string }[]): string {
  let highest = 0
  for (const entry of existing) {
    const sequence = idSequence(entry.id)
    if (sequence > highest) highest = sequence
  }
  return formatId(kind, highest + 1)
}

// ---------------------------------------------------------------------------
// Parsed document shapes.
//
// These live here, beside the records themselves, so a renderer can hold a
// loaded vehicle without importing main-process code across the process
// boundary — the storage modules import them back rather than declaring their
// own, so there is exactly one description of what a parsed file looks like.
// ---------------------------------------------------------------------------

/** A TOML table as the parser hands it over, keys and all — known or not. */
export type RecordTable = Record<string, unknown>

/** A parsed `[[entry]]` file: fuel.toml, costs.toml, service.toml. */
export interface EntryDocument<T> {
  schemaVersion: number
  entries: T[]
  /** Unknown keys, per entry id — so inserting or deleting an entry cannot misalign them. */
  entryRest: Record<string, RecordTable>
  /** Unknown keys at the top level of the document. */
  rest: RecordTable
}

/** A parsed `vehicle.toml`: a flat table, not an entry list. */
export interface VehicleDocument {
  schemaVersion: number
  vehicle: Vehicle
  rest: RecordTable
}

/** Everything one vehicle directory holds, read whole at once (XTRITIUM §4.1). */
export interface VehicleBundle {
  slug: string
  vehicle: VehicleDocument | null
  fuel: EntryDocument<FuelEntry>
  costs: EntryDocument<CostEntry>
  service: EntryDocument<ServiceEntry>
}

/** A vehicle with nothing filled in — the starting point of a new record. */
export const EMPTY_VEHICLE: Vehicle = {
  name: '',
  make: '',
  model: '',
  year: 0,
  engine: '',
  fuel_spec: '',
  plate: '',
  vin: '',
  tank_capacity_l: 0,
  purchase_date: '',
  purchase_price: 0,
  registration_date: '',
  inspection_due: ''
}
