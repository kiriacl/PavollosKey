import { useRef } from 'react'
import { useRecentRequests } from '../../hooks/useRecentRequests'
import { requestHref } from '../../routes/routes'
import type { DashboardRequest } from '../../types/dashboard'
import type { RequestStatus } from '../../types/request'
import { usingMocks } from '../../services/http'
import { formatCivilDate } from '../../utils/dates'
import { Icon } from '../ui/Icon'
import { RequestStatusBadge } from '../requests/RequestStatusBadge'
import { requestStatusLabels, visibleRequestStatuses } from '../requests/requestStatusLabels'

export function RecentRequests({ requests }: { requests: DashboardRequest[] }) {
  const filters = useRecentRequests(requests)
  const searchInput = useRef<HTMLInputElement>(null)
  const resultCount = filters.total === 1 ? '1 solicitação' : `${filters.total} solicitações`
  let resultMessage = resultCount
  if (requests.length === 0) resultMessage = 'Nenhuma solicitação disponível.'
  else if (filters.total === 0) resultMessage = 'Nenhuma solicitação corresponde aos filtros.'
  else if (filters.pageCount > 1) resultMessage = `${resultCount} · Página ${filters.page} de ${filters.pageCount}`

  return (
    <section className="dashboard-card recent-requests" aria-labelledby="recent-requests-title">
      <div className="recent-requests-header">
        <h2 id="recent-requests-title">Solicitações recentes</h2>
        {requests.length > 0 && (
          <div className="request-filters">
            <label className="request-search">
              Nome do cliente
              <span>
                <Icon name="search" size={18} />
                <input
                  type="search"
                  ref={searchInput}
                  value={filters.query}
                  onChange={(event) => filters.changeQuery(event.target.value)}
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={filters.status}
                onChange={(event) => filters.changeStatus(event.target.value as RequestStatus | 'all')}
              >
                <option value="all">Todos os status</option>
                {visibleRequestStatuses.map((status) => (
                  <option key={status} value={status}>{requestStatusLabels[status]}</option>
                ))}
              </select>
            </label>
            {filters.hasFilters && (
              <button
                className="text-link clear-request-filters"
                type="button"
                onClick={() => {
                  filters.clearFilters()
                  searchInput.current?.focus()
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {filters.total > 0 && (
        <>
          <div className="request-columns request-column-headings" aria-hidden="true">
            <span>Cliente</span>
            <span>{usingMocks ? 'Tipo de serviço' : 'Descrição'}</span>
            <span>Data</span>
            <span>Origem</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          <ul className="request-list" role="list">
            {filters.visibleRequests.map((request) => (
              <li key={request.id}>
                <dl className="request-columns">
                  <div><dt>Cliente</dt><dd className="request-name">{request.cliente}</dd></div>
                  <div><dt>{usingMocks ? 'Tipo de serviço' : 'Descrição'}</dt><dd>{request.descricao}</dd></div>
                  <div>
                    <dt>Data da solicitação</dt>
                    <dd>
                      <time dateTime={request.dataSolicitacao}>{formatCivilDate(request.dataSolicitacao)}</time>
                    </dd>
                  </div>
                  <div><dt>Origem</dt><dd>{request.origem}</dd></div>
                  <div>
                    <dt>Status</dt>
                    <dd><RequestStatusBadge status={request.status} /></dd>
                  </div>
                  <div>
                    <dt>Ações</dt>
                    <dd>
                      <a href={requestHref(request.id)} className="text-link" aria-label={`Visualizar ${request.id}`}>
                        Visualizar
                      </a>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="request-results">
        <p className="dashboard-note" role="status">{resultMessage}</p>
        {filters.pageCount > 1 && (
          <nav className="request-pagination" aria-label="Páginas de solicitações">
            <button type="button" aria-disabled={filters.page === 1} onClick={() => {
              if (filters.page > 1) filters.setPage(filters.page - 1)
            }}>Anterior</button>
            <button type="button" aria-disabled={filters.page === filters.pageCount} onClick={() => {
              if (filters.page < filters.pageCount) filters.setPage(filters.page + 1)
            }}>Próxima</button>
          </nav>
        )}
      </div>
    </section>
  )
}
