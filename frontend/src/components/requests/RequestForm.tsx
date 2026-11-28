import { useRef, useState, type FormEvent } from 'react'
import { useRequestWrite, type RequestFieldErrors } from '../../hooks/useRequestWrite'
import { usingMocks } from '../../services/http'
import { createRequest, updateRequest } from '../../services/requests'
import type { Client } from '../../types/client'
import { isRequestOrigin, requestOriginLabels, type RequestInput, type ServiceRequest } from '../../types/request'
import { isCivilDate, todayInSaoPaulo } from '../../utils/dates'
import { formatPhone } from '../clients/clientFormat'
import { RequestField } from './RequestField'
import { visibleRequestOrigins } from './requestStatusLabels'

interface RequestFormProps {
  clients: ReadonlyMap<string, Client>
  request?: ServiceRequest
  saving: boolean
  onSaving: (saving: boolean) => void
  onSaved: (request: ServiceRequest) => void
  onCancel: () => void
}

type Draft = Omit<RequestInput, 'origem'> & { origem: RequestInput['origem'] | '' }

function initialValues(request?: ServiceRequest): Draft {
  return request ?? {
    clienteId: '', tipoServico: '', descricao: '', origem: '',
    dataSolicitacao: todayInSaoPaulo(), endereco: '', observacoes: '',
  }
}

export function RequestForm({ clients, request, saving, onSaving, onSaved, onCancel }: RequestFormProps) {
  const [draft, setDraft] = useState(() => initialValues(request))
  const formRef = useRef<HTMLFormElement>(null)
  const { problem, setProblem, reportProblem, save } = useRequestWrite(formRef, onSaving, onSaved)
  const fields = problem?.fields ?? {}
  const options = Array.from(clients.values()).sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'))
  const missingClient = request && !clients.has(request.clienteId)

  function change<Field extends keyof Draft>(field: Field, value: Draft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }))
    if (problem?.fields[field]) {
      const remaining = { ...problem.fields }
      delete remaining[field]
      setProblem(Object.keys(remaining).length ? { ...problem, fields: remaining } : null)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: RequestFieldErrors = {}
    const tipoServico = draft.tipoServico.trim()
    const descricao = draft.descricao.trim()
    const origem = draft.origem

    if (!draft.clienteId || (!clients.has(draft.clienteId) && draft.clienteId !== request?.clienteId)) {
      errors.clienteId = 'Selecione um cliente cadastrado.'
    }
    if (usingMocks && !tipoServico) errors.tipoServico = 'Informe o tipo de serviço.'
    if (!descricao) errors.descricao = 'Descreva a solicitação.'
    if (!origem) errors.origem = 'Selecione a origem do atendimento.'
    if (usingMocks && !isCivilDate(draft.dataSolicitacao)) errors.dataSolicitacao = 'Informe uma data válida.'

    if (!origem || Object.keys(errors).length) {
      reportProblem({ message: 'Revise os campos destacados.', fields: errors })
      return
    }

    const input: RequestInput = {
      clienteId: draft.clienteId,
      tipoServico,
      descricao,
      origem,
      dataSolicitacao: draft.dataSolicitacao,
      endereco: draft.endereco.trim(),
      observacoes: draft.observacoes.trim(),
    }
    void save(() => request ? updateRequest(request.id, input) : createRequest(input))
  }

  return (
    <form ref={formRef} className="request-editor" noValidate onSubmit={submit}>
      <p className="request-note">Os campos marcados com asterisco são obrigatórios.</p>
      <fieldset disabled={saving} className="request-form-grid">
        <legend className="sr-only">Dados da solicitação</legend>
        <RequestField name="clienteId" label="Cliente" required error={fields.clienteId}>
          {(attrs) => (
            <select {...attrs} value={draft.clienteId} onChange={(event) => change('clienteId', event.target.value)}>
              <option value="">Selecione um cliente</option>
              {missingClient && <option value={request.clienteId}>Cliente não disponível</option>}
              {options.map(({ id, nome, telefone }) => (
                <option key={id} value={id}>{nome}{telefone && ` · ${formatPhone(telefone)}`}</option>
              ))}
            </select>
          )}
        </RequestField>
        {usingMocks && <RequestField name="tipoServico" label="Tipo de serviço" required error={fields.tipoServico}>
          {(attrs) => <input {...attrs} value={draft.tipoServico} onChange={(event) => change('tipoServico', event.target.value)} />}
        </RequestField>}
        <RequestField name="origem" label="Origem do atendimento" required error={fields.origem}>
          {(attrs) => (
            <select {...attrs} value={draft.origem} onChange={(event) => {
              const origin = event.target.value
              change('origem', isRequestOrigin(origin) ? origin : '')
            }}>
              <option value="">Selecione uma origem</option>
              {visibleRequestOrigins.map((origin) => <option key={origin} value={origin}>{requestOriginLabels[origin]}</option>)}
            </select>
          )}
        </RequestField>
        {usingMocks && <RequestField name="dataSolicitacao" label="Data da solicitação" required error={fields.dataSolicitacao}>
          {(attrs) => <input {...attrs} type="date" value={draft.dataSolicitacao} onChange={(event) => change('dataSolicitacao', event.target.value)} />}
        </RequestField>}
        <div className="request-field-wide">
          <RequestField name="descricao" label="Descrição da solicitação" required error={fields.descricao}>
            {(attrs) => <textarea {...attrs} rows={3} maxLength={usingMocks ? undefined : 2000} value={draft.descricao} onChange={(event) => change('descricao', event.target.value)} />}
          </RequestField>
        </div>
        {usingMocks && <div className="request-field-wide">
          <RequestField name="endereco" label="Endereço do atendimento" error={fields.endereco}>
            {(attrs) => <input {...attrs} value={draft.endereco} onChange={(event) => change('endereco', event.target.value)} />}
          </RequestField>
        </div>}
        {usingMocks && <div className="request-field-wide">
          <RequestField name="observacoes" label="Observações" error={fields.observacoes}>
            {(attrs) => <textarea {...attrs} rows={3} value={draft.observacoes} onChange={(event) => change('observacoes', event.target.value)} />}
          </RequestField>
        </div>}
      </fieldset>
      {problem && <p className="form-error" tabIndex={-1} role="alert">{problem.message}</p>}
      <p className="sr-only" role="status">{saving ? 'Salvando solicitação…' : ''}</p>
      <div className="request-dialog-actions">
        <button type="button" className="button request-secondary" disabled={saving} onClick={onCancel}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar solicitação'}
        </button>
      </div>
    </form>
  )
}
