import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { t } from '../../i18n/t'
import { services, type Article } from '../../services'
import { errorText } from '../clients/errorText'
import { Banner } from '../clients/parts'

interface ArchiveConfirmProps {
  article: Article
  onArchived: (article: Article) => void
  onCancel: () => void
}

// components.md "Dialog (confirm)": for what the user can't undo here (there is no screen for archived items);
// focus starts on Отмена. Archiving never deletes: the row stays, and so do the lines of documents made from it.
export function ArchiveConfirm({ article, onArchived, onCancel }: ArchiveConfirmProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  // After the sheet has moved focus to itself (its effect runs after this one), so a tick later.
  useEffect(() => {
    const timer = setTimeout(() => cancel.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])

  const archive = useMutation({
    mutationFn: () => services.articles.remove(article.id),
    onSuccess: () => onArchived(article),
  })

  return (
    <div className="cl-confirm">
      {archive.isError && (
        <Banner tone="danger" title={t('catalogArchive.error')}>
          {errorText(archive.error)}
        </Banner>
      )}
      <p>{t('catalogArchive.text', { title: article.title })}</p>
      <div className="cl-actions">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={archive.isPending}
          onClick={() => archive.mutate()}
        >
          <span className="dc-label">{t('catalogArchive.confirm')}</span>
        </button>
        <button ref={cancel} type="button" className="btn btn-secondary btn-block" onClick={onCancel}>
          <span className="dc-label">{t('catalogArchive.cancel')}</span>
        </button>
      </div>
    </div>
  )
}
