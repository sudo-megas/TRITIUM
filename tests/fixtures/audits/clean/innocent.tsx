// Fixture: nothing here breaks any of the four rules.
import { useTranslation } from 'react-i18next'

export function Innocent() {
  const { t } = useTranslation()
  return <div className="cell">{t('tabs.fuel')}</div>
}
