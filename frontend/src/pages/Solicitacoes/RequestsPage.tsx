import { useRef, useState } from 'react'
import { RequestDialog, type RequestSelection } from '../../components/requests/RequestDialog'
import { RequestFilters } from '../../components/requests/RequestFilters'
import { RequestTable } from '../../components/requests/RequestTable'
import { DataState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { useRequests } from '../../hooks/useRequests'
import { panelHref, parseRoute } from '../../routes/routes'
import { usingMocks } from '../../services/http'
import type { ServiceRequest } from '../../types/request'
import './requests.css'

function linkedSelection(id?: string): RequestSelection | null {
  return id ? { mode: 'view', id } : null
}

export function RequestsPage({ requestId }: { requestId?: string }) {
  const list = useRequests()
  const [selection, setSelection] = useState<RequestSelection | null>(() => linkedSelection(requestId))
  const [previousRequestId, setPreviousRequestId] = useState(requestId)
  const [notice, setNotice] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const newRequestRef = useRef<HTMLButtonElement>(null)

  if (requestId !== previousRequestId) {
    setPreviousRequestId(requestId)
    setSelection(linkedSelection(requestId))
  }

  const data = list.result.status === 'ready' ? list.result.data : undefined
  const total = data?.requests.length ?? 0
  const heading = total === 1 ? '1 solicitação cadastrada' : `${total} solicitações cadastradas`
  let summary = list.matchedTotal === 1 ? '1 resultado' : `${list.matchedTotal} resultados`
  if (total === 0) summary = 'Nenhuma solicitação cadastrada.'
  else if (list.matchedTotal === 0) summary = 'Nenhuma solicitação corresponde aos filtros.'
  else if (list.lastPage > 1) summary += ` · Página ${list.page} de ${list.lastPage}`

  function open(next: RequestSelection) {
    setNotice('')
    setSelection(next)
  }

  function dismiss() {
    setSelection(null)
    const route = parseRoute(window.location.hash)
    if (requestId && route.page === 'module' && route.requestId === requestId) {
      window.location.replace(panelHref('solicitacoes'))
    }
  }

  function saved(request: ServiceRequest, message: string) {
    list.saveToList(request)
    setNotice(message)
    dismiss()
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        const target = newRequestRef.current?.disabled ? headingRef.current : newRequestRef.current
        target?.focus({ preventScroll: true })
      }
    })
  }

  function changePage(page: number) {
    if (list.goToPage(page)) listHeadingRef.current?.focus()
  }

  return (
    <div className="requests-page">
      <div className="panel-intro requests-intro">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>Solicitações</h1>
          {usingMocks && <p className="request-note">As alterações da demonstração são descartadas ao recarregar a página.</p>}
        </div>
        <button type="button" className="button button-primary" ref={newRequestRef}
          disabled={!data?.clients.size} onClick={() => open({ mode: 'create' })}>
          <Icon name="plus" size={19} /> Nova solicitação
        </button>
      </div>
      <p className={notice ? 'request-success' : 'sr-only'} role="status">{notice}</p>
      {list.result.status === 'loading' && <DataState status="loading" message="Carregando as solicitações e os clientes…" />}
      {list.result.status === 'error' && (
        <DataState status="error" message="Não foi possível carregar as solicitações ou os clientes. Confira a conexão."
          onRetry={() => { headingRef.current?.focus(); list.retry() }} />
      )}
      {data && (
        <section className="requests-list" aria-labelledby="request-list-title">
          <div className="request-list-tools">
            <h2 id="request-list-title" ref={listHeadingRef} tabIndex={-1}>{heading}</h2>
            {data.clients.size === 0 && (
              <p className="request-note">
                <a className="text-link" href={panelHref('clientes')}>Cadastre um cliente</a> para registrar uma solicitação.
              </p>
            )}
            {total > 0 && (
              <RequestFilters filters={list.filters} onChange={list.changeFilters} hasFilters={list.hasFilters}
                onClear={() => { list.clearFilters(); document.getElementById('request-list-search')?.focus() }} />
            )}
          </div>
          {list.items.length > 0 && (
            <RequestTable requests={list.items} clients={data.clients}
              onView={(id) => open({ mode: 'view', id })} onEdit={(id) => open({ mode: 'edit', id })} />
          )}
          <div className="request-list-footer">
            <p className="request-note" role="status">{summary}</p>
            {list.lastPage > 1 && (
              <nav className="request-pagination" aria-label="Páginas de solicitações">
                <button type="button" aria-disabled={list.page === 1} onClick={() => changePage(list.page - 1)}>Anterior</button>
                <button type="button" aria-disabled={list.page === list.lastPage} onClick={() => changePage(list.page + 1)}>Próxima</button>
              </nav>
            )}
          </div>
        </section>
      )}
      {selection && data && (
        <RequestDialog selection={selection} clients={data.clients} onDismiss={dismiss}
          onEdit={(id) => setSelection({ mode: 'edit', id })}
          onSaved={(request) => saved(request, selection.mode === 'create'
            ? `Solicitação ${request.id} cadastrada com sucesso.` : `Solicitação ${request.id} atualizada com sucesso.`)}
          onStatusSaved={(request) => saved(request, `Status de ${request.id} atualizado com sucesso.`)} />
      )}
    </div>
  )
}
