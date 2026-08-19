// The detail region (F7), in the right-hand pane.
//
// F4's fuel pane reserved this space in a comment: "F7 reclaims the right half
// for the detail region that replaces the tooltip this app does not have." This
// is that region. It shows the selected record whole — every field of §4.4,
// including the ones the dense table has no room for — and it is where the two
// things one does to a record live.
//
// Deleting asks twice, and asks in the flow: the button becomes a confirming
// button and goes back if anything else is touched. Not a dialog, not a modal,
// not window.confirm — `audit-overlap` fails the build on all three, and all
// three would cover the very record the maker is deciding about.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { Cells } from './EmptyPanes.js'

export interface DetailRow {
  /** The record's own field name — stable across languages, unlike the label. */
  id: string
  /** The label as the maker reads it, already translated. */
  key: string
  /** Already formatted — the detail pane renders, it does not decide. */
  value: string
}

const RIGHT_CELLS = 8

export function RecordDetail({
  id,
  heading,
  rows,
  onEdit,
  onDelete,
  testId
}: {
  id: string | null
  heading: string
  rows: DetailRow[]
  onEdit: () => void
  onDelete: () => void
  testId: string
}): JSX.Element {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  // A confirmation belongs to one record. Selecting another must not inherit it,
  // or a second click lands on something the maker never meant to delete.
  useEffect(() => setConfirming(false), [id])

  if (id === null) {
    // Nothing selected is not an error and not an invitation: it is the same
    // layout holding nothing (§7).
    return (
      <div className="detail" data-testid={`${testId}-none`}>
        <Cells count={RIGHT_CELLS} />
      </div>
    )
  }

  return (
    <div className="detail" data-testid={testId}>
      <h2 className="section__title">{heading}</h2>

      <dl className="detail__rows">
        {rows.map((row) => (
          <div className="detail__row" key={row.id}>
            <dt className="detail__key">{row.key}</dt>
            {/* Selectable text, always. Nothing here is ever a link (§3.5). */}
            <dd className="detail__value" data-testid={`${testId}-value-${row.id}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="detail__actions">
        <button
          type="button"
          className="button"
          data-testid={`${testId}-edit`}
          onClick={() => {
            setConfirming(false)
            onEdit()
          }}
        >
          {t('table.edit')}
        </button>

        {confirming ? (
          <>
            <button
              type="button"
              className="button button--danger"
              data-testid={`${testId}-delete-confirm`}
              onClick={() => {
                setConfirming(false)
                onDelete()
              }}
            >
              {t('table.deleteConfirm')}
            </button>
            <button
              type="button"
              className="button"
              data-testid={`${testId}-delete-cancel`}
              onClick={() => setConfirming(false)}
            >
              {t('table.deleteCancel')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button"
            data-testid={`${testId}-delete`}
            onClick={() => setConfirming(true)}
          >
            {t('table.delete')}
          </button>
        )}
      </div>

      {confirming && (
        <p className="form__warning" data-testid={`${testId}-delete-warning`}>
          {t('table.deleteWarning')}
        </p>
      )}
    </div>
  )
}
