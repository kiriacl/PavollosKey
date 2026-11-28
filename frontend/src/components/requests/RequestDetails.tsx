import { useRef, useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { useRequestWrite } from '../../hooks/useRequestWrite'
import { usingMocks } from '../../services/http'
import { closeRequest, updateRequestStatus } from '../../services/requests'
import type { Client } from '../../types/client'
import { isRequestStatus, requestOriginLabels, requestStatuses, type ServiceRequest } from '../../types/request'
import { formatCivilDate, formatTimestamp } from '../../utils/dates'
import { formatPhone } from '../clients/clientFormat'
import { OperationForm } from '../ui/OperationForm'
import { RecordHistory } from './RecordHistory'
import { RequestField } from './RequestField'
import { RequestStatusBadge } from './RequestStatusBadge'
import { requestStatusLabels } from './requestStatusLabels'

interface DetailsProps {
  request: ServiceRequest
  client?: Client
  saving: boolean
  onSaving: (saving: boolean) => void
  onStatusSaved: (request: ServiceRequest) => void
  onEdit: () => void
  onReload: () => void
}

export function RequestDetails({ request, client, saving, onSaving, onStatusSaved, onEdit, onReload }: DetailsProps) {
  const [status, setStatus] = useState(request.status)
  const formRef = useRef<HTMLFormElement>(null)
  const { problem, setProblem, save } = useRequestWrite(formRef, onSaving, onStatusSaved)
  const profile = useProfile()

  return (
    <div className="request-details">
      <section aria-labelledby="request-data-heading">
        <h3 id="request-data-heading">Dados da solicitação</h3>
        <dl className="request-details-grid">
          <div><dt>Identificador</dt><dd>{request.id}</dd></div>
          <div><dt>Status atual</dt><dd><RequestStatusBadge status={request.status} /></dd></div>
          {usingMocks && <div><dt>Tipo de serviço</dt><dd>{request.tipoServico}</dd></div>}
          <div><dt>Origem do atendimento</dt><dd>{requestOriginLabels[request.origem]}</dd></div>
          <div><dt>Data da solicitação</dt><dd><time dateTime={request.dataSolicitacao}>{formatCivilDate(request.dataSolicitacao)}</time></dd></div>
          <div><dt>Criação</dt><dd><time dateTime={request.criadoEm}>{formatTimestamp(request.criadoEm)}</time></dd></div>
          <div><dt>Última atualização</dt><dd><time dateTime={request.atualizadoEm}>{formatTimestamp(request.atualizadoEm)}</time></dd></div>
          <div className="request-field-wide"><dt>Descrição da solicitação</dt><dd>{request.descricao}</dd></div>
          {usingMocks && <div className="request-field-wide"><dt>Endereço do atendimento</dt><dd>{request.endereco || 'Não informado'}</dd></div>}
          {usingMocks && <div className="request-field-wide"><dt>Observações</dt><dd>{request.observacoes || 'Nenhuma observação informada.'}</dd></div>}
        </dl>
      </section>
      <section aria-labelledby="request-client-heading">
        <h3 id="request-client-heading">Cliente vinculado</h3>
        <dl className="request-details-grid">
          <div><dt>Identificador do cliente</dt><dd>{request.clienteId}</dd></div>
          <div><dt>Nome</dt><dd>{client?.nome ?? 'Cliente não disponível'}</dd></div>
          {client && (
            <>
              <div><dt>Telefone</dt><dd>{formatPhone(client.telefone) || 'Não informado'}</dd></div>
              {usingMocks && <div><dt>WhatsApp</dt><dd>{formatPhone(client.whatsapp) || 'Não informado'}</dd></div>}
              <div><dt>E-mail</dt><dd>{client.email || 'Não informado'}</dd></div>
            </>
          )}
        </dl>
      </section>
      <section className="request-history" aria-labelledby="request-history-heading">
        <h3 id="request-history-heading">Histórico de alterações</h3>
        {usingMocks ? <p className="request-note">O histórico está disponível com a API.</p> : <RecordHistory recordId={request.id} />}
      </section>
      {!usingMocks && request.status === 'pendente' && (
        <fieldset disabled={saving}>
          <details>
            <summary>Encerrar atendimento</summary>
            <OperationForm label="Confirmar encerramento" onBusy={onSaving} run={async (data) => {
              onStatusSaved(await closeRequest(request.id, 'encerrar', String(data.get('motivo')).trim()))
            }}>
              <label>Motivo, se aplicável<textarea name="motivo" maxLength={1000} /></label>
            </OperationForm>
          </details>
          {profile?.papel === 'proprietario' && (
            <details>
              <summary>Cancelar atendimento</summary>
              <OperationForm label="Confirmar cancelamento" onBusy={onSaving} run={async (data) => {
                onStatusSaved(await closeRequest(request.id, 'cancelar', String(data.get('motivo')).trim()))
              }}>
                <label>Motivo do cancelamento<textarea name="motivo" maxLength={1000} required /></label>
              </OperationForm>
            </details>
          )}
          <button type="button" className="text-link" onClick={onReload}>Atualizar atendimento</button>
        </fieldset>
      )}
      {usingMocks && <form ref={formRef} className="request-status-editor" onSubmit={(event) => {
        event.preventDefault()
        if (status !== request.status) void save(() => updateRequestStatus(request.id, status))
      }}>
        <RequestField name="status" label="Alterar status" error={problem?.fields.status}>
          {(attrs) => (
            <select {...attrs} disabled={saving} value={status} onChange={(event) => {
              const next = event.target.value
              if (isRequestStatus(next)) setStatus(next)
              setProblem(null)
            }}>
              {requestStatuses.map((value) => <option key={value} value={value}>{requestStatusLabels[value]}</option>)}
            </select>
          )}
        </RequestField>
        {problem && <p className="request-error-summary" tabIndex={-1} role="alert">{problem.message}</p>}
        <p className="sr-only" role="status">{saving ? 'Salvando status…' : ''}</p>
        <div className="request-dialog-actions">
          <button type="button" className="button request-secondary" disabled={saving} onClick={onEdit}>Editar solicitação</button>
          <button type="submit" className="button button-primary" disabled={saving || status === request.status}>
            {saving ? 'Salvando…' : 'Salvar status'}
          </button>
        </div>
      </form>}
    </div>
  )
}
