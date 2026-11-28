import type { Client } from '../../types/client'
import { usingMocks } from '../../services/http'
import { requestOriginLabels, type ServiceRequest } from '../../types/request'
import { formatCivilDate } from '../../utils/dates'
import { RequestStatusBadge } from './RequestStatusBadge'

interface RequestTableProps {
  requests: ServiceRequest[]
  clients: ReadonlyMap<string, Client>
  onView: (id: string) => void
  onEdit: (id: string) => void
}

export function RequestTable({ requests, clients, onView, onEdit }: RequestTableProps) {
  return (
    <table className="requests-table" role="table">
      <caption className="sr-only">Solicitações cadastradas</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Solicitação</th>
          <th role="columnheader" scope="col">Cliente</th>
          <th role="columnheader" scope="col">Data</th>
          <th role="columnheader" scope="col">Origem</th>
          <th role="columnheader" scope="col">Status</th>
          <th role="columnheader" scope="col">Ações</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {requests.map((request) => (
          <tr key={request.id} role="row">
            <th role="rowheader" scope="row">
              <span className="request-table-id">{request.id}</span>
              {usingMocks ? request.tipoServico : request.descricao}
            </th>
            <td role="cell">
              <span className="request-mobile-label" aria-hidden="true">Cliente</span>
              {clients.get(request.clienteId)?.nome ?? 'Cliente não disponível'}
            </td>
            <td role="cell">
              <span className="request-mobile-label" aria-hidden="true">Data</span>
              <time dateTime={request.dataSolicitacao}>{formatCivilDate(request.dataSolicitacao)}</time>
            </td>
            <td role="cell">
              <span className="request-mobile-label" aria-hidden="true">Origem</span>
              {requestOriginLabels[request.origem]}
            </td>
            <td role="cell">
              <span className="request-mobile-label" aria-hidden="true">Status</span>
              <RequestStatusBadge status={request.status} />
            </td>
            <td role="cell" className="request-table-actions">
              <button type="button" className="text-link" aria-label={`Visualizar ${request.id}`} onClick={() => onView(request.id)}>
                Visualizar
              </button>
              {usingMocks && <button type="button" className="text-link" aria-label={`Editar ${request.id}`} onClick={() => onEdit(request.id)}>
                Editar
              </button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
