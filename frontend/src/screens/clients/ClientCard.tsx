import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { t } from '../../i18n/t'
import { isApiError, services, type ClientDetail, type DocumentSummary } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { ClientForm } from './ClientForm'
import { documentBadge, documentPath, documentTypeKey } from './documentStatus'
import { Banner, ListSkeleton, Money } from './parts'
import { errorText } from './errorText'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cl-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function DocumentRow({ doc }: { doc: DocumentSummary }) {
  const badge = documentBadge(doc)
  return (
    <li>
      <Link className="cl-row cl-doc" to={documentPath(doc)}>
        <span className="cl-doc-main">
          <span className="cl-doc-line">
            <span className="dc-code">{doc.number ?? t('docNumber.draft')}</span>
          </span>
          <span className="cl-doc-kind">{t(documentTypeKey(doc.type))}</span>
        </span>
        <span className="cl-doc-side">
          <span className="cl-doc-amount">
            <Money tiyn={doc.grossTiyn} />
          </span>
          <span className="cl-badge" data-tone={badge.tone}>
            {badge.label}
          </span>
        </span>
      </Link>
    </li>
  )
}

interface ConfirmProps {
  text: string
  confirmLabel: string
  danger: boolean
  pending: boolean
  error: unknown
  onConfirm: () => void
  onCancel: () => void
}

// components.md "Dialog (confirm)": only for what can't be undone; focus starts on Отмена.
function Confirm(props: ConfirmProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  // After the sheet has moved focus to itself (its effect runs after this one), so a tick later.
  useEffect(() => {
    const timer = setTimeout(() => cancel.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="cl-confirm">
      {props.error !== null && props.error !== undefined && (
        <Banner tone="danger" title={t('clientCard.actionError')}>
          {errorText(props.error)}
        </Banner>
      )}
      <p>{props.text}</p>
      <div className="cl-actions">
        <button
          type="button"
          className={`btn ${props.danger ? 'btn-danger' : 'btn-primary'} btn-block`}
          disabled={props.pending}
          onClick={props.onConfirm}
        >
          <span className="dc-label">{props.confirmLabel}</span>
        </button>
        <button ref={cancel} type="button" className="btn btn-secondary btn-block" onClick={props.onCancel}>
          <span className="dc-label">{t('clientCard.cancel')}</span>
        </button>
      </div>
    </div>
  )
}

function Card({ client }: { client: ClientDetail }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const editing = params.get('edit') === '1'
  const [confirming, setConfirming] = useState(false)

  const archiveOnly = client.documents.length > 0
  const archived = client.archivedAt !== null

  const remove = useMutation({
    mutationFn: () => services.clients.remove(client.id),
    onSuccess: async () => {
      if (archiveOnly) {
        // The card stays and shows its archived banner.
        await queryClient.invalidateQueries({ queryKey: ['clients'] })
        setConfirming(false)
      } else {
        // A deleted client has no card to refetch: drop it, refresh the lists and leave.
        queryClient.removeQueries({ queryKey: ['clients', 'detail', client.id] })
        void queryClient.invalidateQueries({ queryKey: ['clients', 'list'] })
        void navigate('/clients', { replace: true })
      }
    },
  })

  const setEditing = (open: boolean) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (open) next.set('edit', '1')
        else next.delete('edit')
        return next
      },
      { replace: !open },
    )

  const hasContacts = Boolean(client.phone || client.email || client.address || client.contactName || client.binIin)

  return (
    <>
      <header className="cl-head">
        <h1>{client.name}</h1>
        <p className="cl-kind">{t(`clients.kind.${client.kind}`)}</p>
      </header>

      {archived && <Banner tone="success">{t('clientCard.archivedBanner')}</Banner>}

      <section className="card">
        <div className="card-body">
          {hasContacts ? (
            <dl className="cl-facts">
              {client.contactName && <Fact label={t('clientCard.contactName')}>{client.contactName}</Fact>}
              {client.phone && (
                <Fact label={t('clientCard.phone')}>
                  <span className="cl-nowrap">{client.phone}</span>
                </Fact>
              )}
              {client.email && <Fact label={t('clientCard.email')}>{client.email}</Fact>}
              {client.address && <Fact label={t('clientCard.address')}>{client.address}</Fact>}
              {client.binIin && (
                <Fact label={t(client.kind === 'company' ? 'clientForm.binIin.company' : 'clientForm.binIin.person')}>
                  <span className="dc-code">{client.binIin}</span>
                </Fact>
              )}
            </dl>
          ) : (
            <p className="muted">{t('clientCard.contacts.empty')}</p>
          )}
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setEditing(true)}>
            <span className="dc-label">{t('clientCard.edit')}</span>
          </button>
        </div>
      </section>

      <section className="cl-section" aria-labelledby="client-documents">
        <h2 id="client-documents">{t('clientCard.documents')}</h2>
        {client.documents.length === 0 ? (
          <p className="muted">{t('clientCard.documents.empty')}</p>
        ) : (
          <ul className="card cl-list">
            {client.documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </section>

      {/* A client with documents can only be archived (they are accounting records); one without is deleted. */}
      {archiveOnly && !archived && (
        <section className="cl-section">
          <p className="muted">{t('clientCard.archive.why')}</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirming(true)}>
            <span className="dc-label">{t('clientCard.archive')}</span>
          </button>
        </section>
      )}
      {!archiveOnly && (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirming(true)}>
          <span className="dc-label">{t('clientCard.delete')}</span>
        </button>
      )}

      <BottomSheet open={editing} title={t('clientForm.title.edit')} onClose={() => setEditing(false)}>
        <ClientForm
          client={client}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['clients'] })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </BottomSheet>

      <BottomSheet
        open={confirming}
        title={t(archiveOnly ? 'clientCard.archive.title' : 'clientCard.delete.title')}
        onClose={() => setConfirming(false)}
      >
        <Confirm
          text={t(archiveOnly ? 'clientCard.archive.text' : 'clientCard.delete.text', { name: client.name })}
          confirmLabel={t(archiveOnly ? 'clientCard.archive.confirm' : 'clientCard.delete.confirm')}
          danger={!archiveOnly}
          pending={remove.isPending}
          error={remove.error}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirming(false)}
        />
      </BottomSheet>
    </>
  )
}

// S23: a simple client record: contacts, the documents of this client, edit, and delete or archive.
export function ClientCard() {
  const { clientId = '' } = useParams()
  const detail = useQuery({
    queryKey: ['clients', 'detail', clientId],
    queryFn: () => services.clients.get(clientId),
  })

  let body
  if (detail.isError) {
    const gone = isApiError(detail.error) && detail.error.code === 'not_found'
    body = (
      <Banner
        tone="danger"
        title={t('clientCard.error.title')}
        action={
          gone ? (
            <Link className="btn btn-secondary" to="/clients">
              <span className="dc-label">{t('clientCard.backToList')}</span>
            </Link>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => void detail.refetch()}>
              <span className="dc-label">{t('clients.retry')}</span>
            </button>
          )
        }
      >
        {errorText(detail.error)}
      </Banner>
    )
  } else if (!detail.data) {
    body = <ListSkeleton rows={3} label={t('clientCard.loading')} />
  } else {
    body = <Card client={detail.data} />
  }

  return (
    <div className="page" data-screen="S23">
      {body}
    </div>
  )
}
