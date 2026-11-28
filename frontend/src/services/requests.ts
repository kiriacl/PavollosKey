import { demoRequests } from '../mocks/requests'
import { type RequestInput, type RequestStatus, type ServiceRequest } from '../types/request'
import { dateInSaoPaulo, isTimestamp } from '../utils/dates'
import { getClient } from './clients'
import { apiRoutes, getJson, HttpError, listAll, recordPath, usingMocks, writeJson } from './http'

let requests = [...demoRequests]
let nextDemoId = demoRequests.length + 1

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function readRequest(value: unknown): ServiceRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('A solicitação tem um formato inesperado.')
  }

  const data = value as Record<string, unknown>
  const { id, cliente_id, descricao, canal_entrada, status, criado_em, atualizado_em } = data
  if (
    !isText(id) || id === '.' || id === '..' || !isText(cliente_id) || !isText(descricao)
    || (canal_entrada !== 'presencial' && canal_entrada !== 'whatsapp')
    || (status !== 'aberto' && status !== 'encerrado' && status !== 'cancelado')
    || !isTimestamp(criado_em) || !isTimestamp(atualizado_em)
  ) {
    throw new Error('A solicitação tem um formato inesperado.')
  }

  return {
    id, clienteId: cliente_id, tipoServico: '', descricao, origem: canal_entrada,
    status: status === 'aberto' ? 'pendente' : status === 'encerrado' ? 'resolvida' : 'cancelada',
    dataSolicitacao: dateInSaoPaulo(criado_em), criadoEm: criado_em, atualizadoEm: atualizado_em,
    endereco: '', observacoes: '',
  }
}

const requestPath = (id: string) => recordPath(apiRoutes.requests, id)

function withId(request: ServiceRequest, id: string) {
  if (request.id !== id) throw new Error('O servidor retornou outra solicitação.')
  return request
}

function findMockRequest(id: string) {
  const request = requests.find((record) => record.id === id)
  if (!request) throw new HttpError(404, null)
  return request
}

async function checkMockClient(id: string) {
  try {
    await getClient(id, new AbortController().signal)
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new HttpError(422, { erros: { clienteId: 'Selecione um cliente cadastrado.' } })
    }
    throw error
  }
}

function saveMock(request: ServiceRequest) {
  requests = requests.map((item) => item.id === request.id ? request : item)
  return request
}

export async function listRequests(signal: AbortSignal, clientId?: string): Promise<ServiceRequest[]> {
  signal.throwIfAborted()
  if (usingMocks) return clientId ? requests.filter((item) => item.clienteId === clientId) : requests

  const path = clientId ? `${apiRoutes.requests}?cliente_id=${encodeURIComponent(clientId)}` : apiRoutes.requests
  const data = await listAll(path, signal)
  const records = data.map(readRequest)
  if (new Set(records.map(({ id }) => id)).size !== records.length) {
    throw new Error('A lista de solicitações contém identificadores repetidos.')
  }
  return records
}

export async function getRequest(id: string, signal: AbortSignal): Promise<ServiceRequest> {
  signal.throwIfAborted()
  if (usingMocks) return findMockRequest(id)
  return withId(readRequest(await getJson(requestPath(id), signal)), id)
}

export async function createRequest(input: RequestInput): Promise<ServiceRequest> {
  if (!usingMocks) {
    return readRequest(await writeJson(apiRoutes.requests, 'POST', {
      cliente_id: input.clienteId, canal_entrada: input.origem, descricao: input.descricao,
    }))
  }

  await checkMockClient(input.clienteId)
  const timestamp = new Date().toISOString()
  const request: ServiceRequest = {
    ...input,
    id: `SOL-${String(nextDemoId++).padStart(3, '0')}`,
    status: 'pendente',
    criadoEm: timestamp,
    atualizadoEm: timestamp,
  }
  requests = [request, ...requests]
  return request
}

export async function updateRequest(id: string, input: RequestInput): Promise<ServiceRequest> {
  if (!usingMocks) throw new Error('A API oferece apenas a criação e as ações de encerramento e cancelamento.')

  await checkMockClient(input.clienteId)
  return saveMock({ ...findMockRequest(id), ...input, atualizadoEm: new Date().toISOString() })
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<ServiceRequest> {
  if (!usingMocks) throw new Error('Use a ação de encerramento ou cancelamento para este atendimento.')

  return saveMock({ ...findMockRequest(id), status, atualizadoEm: new Date().toISOString() })
}

export async function closeRequest(id: string, action: 'encerrar' | 'cancelar', reason: string) {
  return withId(readRequest(await writeJson(`${requestPath(id)}/${action}`, 'POST',
    reason ? { motivo: reason } : {})), id)
}
