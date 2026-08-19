// The dense table XTRITIUM §7 settles, built once and used by all three lists.
//
// Three hand-written tables drifted apart across F4, F5 and F6 — the fuel pane
// ended up carrying a comment about column widths that the cost pane had to
// repeat word for word. This is that comment's last home.
//
// The treatment is F4b's, inherited rather than restyled: the row height, the
// alignment, the rule under each row, the first and last column's padding all
// come from `.entries`, which already exists and already looks right.

import { useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table'

export function EntryTable<T extends { id: string }>({
  rows,
  columns,
  defaultSorting,
  selectedId,
  onSelect,
  name,
  textColumns = []
}: {
  rows: T[]
  columns: ColumnDef<T, string>[]
  defaultSorting: SortingState
  selectedId: string | null
  onSelect: (id: string) => void
  name: string
  /**
   * Columns holding prose rather than figures, capped so they cannot widen the
   * table past its pane. Their full value is in the detail region — which is
   * what that region is for.
   */
  textColumns?: string[]
}): JSX.Element {
  const { t } = useTranslation()
  const [sorting, setSorting] = useState<SortingState>(defaultSorting)

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  return (
    <table className="entries entries--dense" data-testid={`${name}-list`}>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id} aria-sort={ariaSort(header.column.getIsSorted())}>
                {/* A header that sorts is a button, so it is reachable without a
                    pointer and announces itself as something that does. */}
                <button
                  type="button"
                  className="entries__sort"
                  data-testid={`${name}-sort-${header.column.id}`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <span className="entries__caret" aria-hidden="true">
                    {caret(header.column.getIsSorted())}
                  </span>
                </button>
              </th>
            ))}
            {/*
             * A slack column, holding nothing.
             *
             * F4b gave `.entries` its density by letting the LAST column take
             * all the surplus width, so the figures pack together at the left
             * instead of a table set to 100% spreading a hundred and fifty
             * pixels between one number and the next. Until F7 that column was
             * the row's Edit button. F7 moved both actions into the detail pane,
             * which left the last column of DATA absorbing the slack and drifting
             * away from the rest. This puts the slack back where it belongs.
             */}
            <th className="entries__slack" />
          </tr>
        ))}
      </thead>

      <tbody>
        {/* §7 — an empty list is the filled layout holding nothing: the headers
            and the column widths stay exactly where they were. */}
        {rows.length === 0 && (
          <tr>
            <td
              className="entries__empty"
              colSpan={columns.length + 1}
              data-testid={`${name}-empty`}
            >
              {t('table.empty')}
            </td>
          </tr>
        )}

        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            data-testid={`${name}-row-${row.original.id}`}
            data-selected={row.original.id === selectedId}
            tabIndex={0}
            onClick={() => onSelect(row.original.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(row.original.id)
              }
            }}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} data-testid={`${name}-${cell.column.id}-${row.original.id}`}>
                {textColumns.includes(cell.column.id) ? (
                  <span className="entries__text">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </span>
                ) : (
                  flexRender(cell.column.columnDef.cell, cell.getContext())
                )}
              </td>
            ))}
            <td className="entries__slack" />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ariaSort(direction: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending'
  if (direction === 'desc') return 'descending'
  return 'none'
}

/**
 * The sort indicator, drawn from the Nerd Font's own glyphs (§8 — icons are the
 * Font Awesome glyphs patched into the font, and there is no icon dependency).
 */
function caret(direction: false | 'asc' | 'desc'): string {
  if (direction === 'asc') return '▲'
  if (direction === 'desc') return '▼'
  return ''
}
