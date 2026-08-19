// The cost form (XTRITIUM §6.2 — the form adapts to the category), in a window
// of its own (§5.1: movable, non-anchored).
//
// It is also the edit path, as the fuel form is: §3.8 says every entry is
// editable at any time, and an edit replaces one entry by id in the main
// process rather than rewriting the file from whatever this window is holding.
//
// One form, not two. §5.1's quick-add/full-form pair is a fuel decision — a
// fill-up has three figures worth a fast path. A cost has no such subset, and a
// quick path would have to pick one of §6.2's shapes and be wrong for the rest.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { parseDate, parseInput } from '../../shared/format.js'
import {
  COST_GROUPS,
  PAYMENT_METHODS,
  isCostGroup,
  pickableCategories,
  takesTypedCategory,
  type VehicleBundle
} from '../../shared/records.js'
import { MONEY_DECIMALS } from '../../shared/scaled.js'
import { categorySlug } from '../../shared/slug.js'
import {
  costDraftOf,
  costEntryOf,
  emptyCostDraft,
  type CostDraft
} from '../../shared/cost-draft.js'

export function CostForm({ slug, entry }: { slug: string; entry?: string }): JSX.Element {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<CostDraft>(() => emptyCostDraft())
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Editing: the entry on disk fills the form. Adding: today, and an empty
  // category — §3.3, nothing is chosen on the maker's behalf.
  useEffect(() => {
    if (slug.length === 0 || entry === undefined) return

    void (async () => {
      try {
        const bundle = (await window.tritium.loadVehicle(slug)) as VehicleBundle
        const existing = bundle.costs.entries.find((candidate) => candidate.id === entry)
        if (existing !== undefined) setDraft(costDraftOf(existing))
      } catch (cause) {
        setFailure(String(cause))
      }
    })()
  }, [slug, entry])

  const set = <K extends keyof CostDraft>(key: K, value: CostDraft[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /**
   * Changing the group clears the category rather than carrying a nonsense pair
   * forward — `kasko` under İLK ALIŞ is not a thing the tree contains.
   */
  const setGroup = (value: string): void => {
    if (!isCostGroup(value)) return
    setDraft((current) => ({ ...current, group: value, category: '' }))
  }

  const typed = takesTypedCategory(draft.group)
  const categories = pickableCategories(draft.group)

  /**
   * The shipped methods, plus whatever this entry already carries.
   *
   * §4.4 calls the list editable and F11 owns settings whole, so F5 ships the
   * three fixed. But a value typed into the file by hand must survive an edit of
   * the same entry: dropping it would be the app overruling the maker's own
   * editor, which §3.8 forbids.
   */
  const stored = draft.payment_method
  const methods =
    stored.length > 0 && !(PAYMENT_METHODS as readonly string[]).includes(stored)
      ? [...PAYMENT_METHODS, stored]
      : [...PAYMENT_METHODS]

  const amount = parseInput(draft.amount, MONEY_DECIMALS)
  const ready =
    slug.length > 0 &&
    amount !== null &&
    amount > 0 &&
    categorySlug(draft.category).length > 0 &&
    !saving

  const badDate = draft.date.trim().length > 0 && parseDate(draft.date) === null

  async function save(): Promise<void> {
    if (!ready) return
    setSaving(true)

    try {
      const record = costEntryOf(draft)
      if (entry === undefined) await window.tritium.addCost(slug, record)
      else await window.tritium.updateCost(slug, { ...record, id: entry })
      await window.tritium.closeForm()
    } catch (cause) {
      setFailure(String(cause))
      setSaving(false)
    }
  }

  return (
    <div className="form">
      <h1 className="form__title">
        {entry === undefined ? t('costs.addTitle') : t('costs.editTitle')}
      </h1>

      {failure !== null && (
        <p className="form__error" data-testid="cost-form-error">
          {t('costs.saveFailed')}
        </p>
      )}

      <div className="form__grid">
        <label className="field">
          <span className="field__label">{t('costs.fields.date')}</span>
          <input
            className="control"
            type="text"
            placeholder={t('vehicles.datePattern')}
            data-testid="cost-date"
            value={draft.date}
            onChange={(event) => set('date', event.target.value)}
          />
        </label>

        {/* The tree, group first (§6.1). Fuelio's list is flat; this one is not. */}
        <label className="field">
          <span className="field__label">{t('costs.fields.group')}</span>
          <select
            className="control"
            data-testid="cost-group"
            value={draft.group}
            onChange={(event) => setGroup(event.target.value)}
          >
            {COST_GROUPS.map((group) => (
              <option key={group} value={group}>
                {t(`costs.groups.${group}`)}
              </option>
            ))}
          </select>
        </label>

        {/*
         * The one control that changes shape in F5. §6.2's other adaptation —
         * Periyodik Bakım's part / odometer / vendor — writes service.toml and
         * is F6's; the money shape is what İLK ALIŞ, TEKRAR EDEN and MANUAL all
         * wear, so the fields below are the same for the three of them.
         */}
        <label className="field">
          <span className="field__label">{t('costs.fields.category')}</span>
          {typed ? (
            <input
              className="control"
              type="text"
              data-testid="cost-category-typed"
              value={draft.category}
              onChange={(event) => set('category', event.target.value)}
            />
          ) : (
            <select
              className="control"
              data-testid="cost-category"
              value={draft.category}
              onChange={(event) => set('category', event.target.value)}
            >
              <option value="">{t('vehicles.unset')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(`costs.categories.${category}`)}
                </option>
              ))}
            </select>
          )}
          {typed && <span className="field__hint">{t('costs.typedCategoryHint')}</span>}
          {/*
           * F5 withheld Periyodik Bakım from this list and could say nothing
           * about where it had gone, because the SERVICE tab was empty and
           * pointing at an empty tab is worse than silence. F6 filled it.
           */}
          {draft.group === 'tekrar-eden' && (
            <span className="field__hint" data-testid="cost-service-elsewhere">
              {t('costs.serviceElsewhere')}
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">{t('costs.fields.title')}</span>
          <input
            className="control"
            type="text"
            data-testid="cost-title"
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('costs.fields.amount')}</span>
          <input
            className="control"
            type="text"
            inputMode="decimal"
            data-testid="cost-amount"
            value={draft.amount}
            onChange={(event) => set('amount', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('costs.fields.payment_method')}</span>
          <select
            className="control"
            data-testid="cost-payment_method"
            value={draft.payment_method}
            onChange={(event) => set('payment_method', event.target.value)}
          >
            <option value="">{t('vehicles.unset')}</option>
            {methods.map((method) => (
              <option key={method} value={method}>
                {t(`costs.methods.${method}`, { defaultValue: method })}
              </option>
            ))}
          </select>
        </label>

        {/*
         * §4.4 gives bank its own field so that totals by bank become possible,
         * and instalment its own beside it — "plain text, no engine behind it".
         * On the maker's sheet both were crammed into one AÇIKLAMA column with a
         * slash between them, which is why neither could ever be summed.
         */}
        <label className="field">
          <span className="field__label">{t('costs.fields.bank')}</span>
          <input
            className="control"
            type="text"
            data-testid="cost-bank"
            value={draft.bank}
            onChange={(event) => set('bank', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('costs.fields.instalment')}</span>
          <input
            className="control"
            type="text"
            data-testid="cost-instalment"
            value={draft.instalment}
            onChange={(event) => set('instalment', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('costs.fields.note')}</span>
          <input
            className="control"
            type="text"
            data-testid="cost-note"
            value={draft.note}
            onChange={(event) => set('note', event.target.value)}
          />
        </label>

        {/* The flag is the sign. The amount on disk stays positive (§3.7). */}
        <label className="field field--check">
          <span className="field__label">{t('costs.fields.income')}</span>
          <input
            type="checkbox"
            data-testid="cost-income"
            checked={draft.income}
            onChange={(event) => set('income', event.target.checked)}
          />
          <span className="field__hint">{t('costs.incomeHint')}</span>
        </label>
      </div>

      {badDate && (
        <p className="form__warning" data-testid="cost-date-warning">
          {t('vehicles.dateWarning')}
        </p>
      )}

      <div className="form__actions">
        <button
          type="button"
          className="button"
          data-testid="cost-cancel"
          onClick={() => void window.tritium.closeForm()}
        >
          {t('costs.cancel')}
        </button>

        <button
          type="button"
          className="button button--primary"
          data-testid="cost-save"
          disabled={!ready}
          onClick={() => void save()}
        >
          {t('costs.save')}
        </button>
      </div>
    </div>
  )
}
