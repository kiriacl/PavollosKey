import type { Client } from '../../types/client'
import { usingMocks } from '../../services/http'
import { formatClientDate, formatPhone } from './clientFormat'

interface ClientTableProps {
  clients: Client[]
  onView: (id: string) => void
  onEdit: (id: string) => void
}

export function ClientTable({ clients, onView, onEdit }: ClientTableProps) {
  return (
    <table className="client-table" role="table">
      <caption className="sr-only">Clientes cadastrados</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Nome</th>
          <th role="columnheader" scope="col">Telefone</th>
          {usingMocks && <th role="columnheader" scope="col">WhatsApp</th>}
          <th className="client-email-column" role="columnheader" scope="col">E-mail</th>
          <th role="columnheader" scope="col">Data de cadastro</th>
          <th role="columnheader" scope="col">Ações</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {clients.map((client) => (
          <tr key={client.id} role="row">
            <th role="rowheader" scope="row">{client.nome}</th>
            <td role="cell">
              <span className="client-mobile-label" aria-hidden="true">Telefone</span>
              {formatPhone(client.telefone) || <MissingValue />}
            </td>
            {usingMocks && <td role="cell">
              <span className="client-mobile-label" aria-hidden="true">WhatsApp</span>
              {formatPhone(client.whatsapp) || <MissingValue />}
            </td>}
            <td role="cell" className="client-email-column">
              <span className="client-mobile-label" aria-hidden="true">E-mail</span>
              {client.email || <MissingValue />}
            </td>
            <td role="cell">
              <span className="client-mobile-label" aria-hidden="true">Data de cadastro</span>
              <time dateTime={client.criadoEm}>{formatClientDate(client.criadoEm)}</time>
            </td>
            <td role="cell" className="client-row-actions">
              <button className="text-link" type="button" aria-label={`Visualizar ${client.nome}`} onClick={() => onView(client.id)}>
                Visualizar
              </button>
              <button className="text-link" type="button" aria-label={`Editar ${client.nome}`} onClick={() => onEdit(client.id)}>
                Editar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MissingValue() {
  return <><span aria-hidden="true">—</span><span className="sr-only">Não informado</span></>
}
