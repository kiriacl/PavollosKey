import { useCallback } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { requestHref } from '../../routes/routes'
import { usingMocks } from '../../services/http'
import { listRequests } from '../../services/requests'
import type { Client } from '../../types/client'
import { formatCivilDate } from '../../utils/dates'
import { RequestStatusBadge } from '../requests/RequestStatusBadge'
import { ReadResult } from '../ui/ReadResult'
import { formatCep, formatClientDate, formatPhone } from './clientFormat'

export function ClientDetails({ client, onEdit }: { client: Client; onEdit: () => void }) {
  const address = client.endereco
  const addressFields = [
    ['CEP', formatCep(address.cep)],
    ['Logradouro', address.logradouro],
    ['Número', address.numero],
    ['Complemento', address.complemento],
    ['Bairro', address.bairro],
    ['Cidade', address.cidade],
    ['Estado', address.estado],
  ].filter(([, value]) => value)

  return (
    <div className="client-details">
      <section aria-labelledby="client-contact-title">
        <h3 id="client-contact-title">Dados de contato</h3>
        <dl className="client-details-grid">
          <div><dt>Nome completo</dt><dd>{client.nome}</dd></div>
          <div><dt>Telefone</dt><dd>{formatPhone(client.telefone) || 'Não informado'}</dd></div>
          {usingMocks && <div><dt>WhatsApp</dt><dd>{formatPhone(client.whatsapp) || 'Não informado'}</dd></div>}
          <div><dt>E-mail</dt><dd>{client.email || 'Não informado'}</dd></div>
          <div><dt>Data de cadastro</dt><dd><time dateTime={client.criadoEm}>{formatClientDate(client.criadoEm)}</time></dd></div>
        </dl>
      </section>
      {usingMocks && <section aria-labelledby="client-address-title">
        <h3 id="client-address-title">Endereço</h3>
        {addressFields.length > 0 ? (
          <dl className="client-details-grid">
            {addressFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        ) : <p className="client-note">Nenhum endereço informado.</p>}
      </section>}
      {usingMocks && <section aria-labelledby="client-notes-title">
        <h3 id="client-notes-title">Observações</h3>
        <p className="client-observations">{client.observacoes || 'Nenhuma observação informada.'}</p>
      </section>}
      <section className="client-history" aria-labelledby="client-history-title">
        <h3 id="client-history-title">Histórico de solicitações e serviços</h3>
        {usingMocks ? <p className="client-note">O histórico por cliente está disponível com a API.</p>
          : <ClientHistory id={client.id} />}
      </section>
      <div className="client-dialog-actions">
        <button type="button" className="button button-primary" onClick={onEdit}>Editar cliente</button>
      </div>
    </div>
  )
}

function ClientHistory({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => listRequests(signal, id), [id])
  const query = useAsyncData(load)
  return (
    <ReadResult query={query} name="os atendimentos do cliente">
      {(requests) => requests.length ? (
        <ul className="operation-list">
          {requests.map((request) => (
            <li key={request.id}>
              <a className="text-link" href={requestHref(request.id)}>{request.descricao}</a>
              <p>{formatCivilDate(request.dataSolicitacao)} · <RequestStatusBadge status={request.status} /></p>
            </li>
          ))}
        </ul>
      ) : <p className="client-note">Nenhum atendimento para este cliente.</p>}
    </ReadResult>
  )
}
