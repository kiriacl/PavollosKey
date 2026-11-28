import { demoClients } from '../mocks/clients'
import { emptyAddress, type Client, type ClientInput } from '../types/client'
import { isTimestamp } from '../utils/dates'
import { apiRoutes, getJson, HttpError, listAll, recordPath, usingMocks, writeJson } from './http'

let clients = [...demoClients]
let nextDemoId = 1

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  throw new Error('O cadastro de cliente tem um campo em formato inesperado.')
}

function readClient(value: unknown): Client {
  if (
    !isObject(value) || typeof value.id !== 'string' || !value.id.trim()
    || value.id === '.' || value.id === '..'
    || typeof value.nome !== 'string' || !value.nome.trim()
    || !isTimestamp(value.criado_em)
  ) {
    throw new Error('O cadastro de cliente tem um formato inesperado.')
  }

  return {
    id: value.id,
    nome: value.nome,
    telefone: readText(value.telefone),
    whatsapp: '',
    email: readText(value.email),
    endereco: { ...emptyAddress },
    observacoes: '',
    criadoEm: value.criado_em,
  }
}

const clientPath = (id: string) => recordPath(apiRoutes.clients, id)

export async function listClients(signal: AbortSignal): Promise<Client[]> {
  signal.throwIfAborted()
  if (usingMocks) return clients

  const data = await listAll(apiRoutes.clients, signal)

  const records = data.map(readClient)
  if (new Set(records.map(({ id }) => id)).size !== records.length) {
    throw new Error('A lista de clientes contém identificadores repetidos.')
  }

  return records.toSorted((first, second) => Date.parse(second.criadoEm) - Date.parse(first.criadoEm))
}

export async function getClient(id: string, signal: AbortSignal): Promise<Client> {
  signal.throwIfAborted()
  if (usingMocks) {
    const client = clients.find((record) => record.id === id)
    if (!client) throw new HttpError(404, null)
    return client
  }

  const client = readClient(await getJson(clientPath(id), signal))
  if (client.id !== id) throw new Error('O servidor retornou outro cadastro.')
  return client
}

async function writeClient(path: string, method: 'POST' | 'PATCH', input: ClientInput) {
  const data = await writeJson(path, method, {
    nome: input.nome, telefone: input.telefone || null, email: input.email || null,
  })
  return readClient(data)
}

export async function createClient(input: ClientInput): Promise<Client> {
  if (!usingMocks) return writeClient(apiRoutes.clients, 'POST', input)

  const client = { ...input, id: `demo-novo-${nextDemoId++}`, criadoEm: new Date().toISOString() }
  clients = [client, ...clients]
  return client
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  if (!usingMocks) {
    const client = await writeClient(clientPath(id), 'PATCH', input)
    if (client.id !== id) throw new Error('O servidor retornou outro cadastro.')
    return client
  }

  const current = clients.find((record) => record.id === id)
  if (!current) throw new HttpError(404, null)

  const client = { ...current, ...input }
  clients = clients.map((record) => record.id === id ? client : record)
  return client
}
