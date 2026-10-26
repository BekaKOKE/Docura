import { Link } from 'react-router'
import { documentListPath, documentSections, type DocumentSection } from '../app/nav'
import { t, type MessageKey } from '../i18n/t'

const labels = {
  quotes: 'segments.quotes',
  invoices: 'segments.invoices',
  acts: 'segments.acts',
} as const satisfies Record<DocumentSection, MessageKey>

// The Документы segmented control: КП · Счета · Акты. The address decides which segment is selected,
// so a deep link such as /documents/invoices opens with Счета selected. Each segment is a link, not a stateful tab.
export function DocumentSegments({ current }: { current: DocumentSection }) {
  return (
    <div className="segments-wrap">
      <nav className="segments" aria-label={t('segments.label')}>
        {documentSections.map((section) => (
          <Link
            key={section}
            className="segment"
            to={documentListPath[section]}
            aria-current={section === current ? 'page' : undefined}
          >
            <span className="dc-label">{t(labels[section])}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
