const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const apiBase = configuredBase.replace(/\/+$/, '')

export const usingMocks = configuredBase === ''

export const apiRoutes = {
  panelContext: '/painel/contexto',
  clients: '/clientes',
  requests: '/atendimentos',
} as const

export class HttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
      ? body.message : `Resposta HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

export const sessionExpired = 'pavollos:session-expired'

export function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof HttpError && error.body ? error.message : fallback
}

export async function requestJson<T = unknown>(path: string, options: RequestInit): Promise<T> {
  if (apiBase !== '/api') throw new Error('Configure VITE_API_BASE_URL=/api para usar a API na mesma origem.')
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  const response = await fetch(apiBase + path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) {
    if (response.status === 401 && !options.signal?.aborted && path !== '/auth/login' && path !== '/perfil') {
      window.dispatchEvent(new Event(sessionExpired))
    }
    throw new HttpError(response.status, await response.json().catch(() => null))
  }
  return response.status === 204 ? undefined as T : response.json()
}

export function getJson<T = unknown>(path: string, signal: AbortSignal) {
  return requestJson<T>(path, { signal })
}

export function writeJson<T = unknown>(path: string, method: 'POST' | 'PATCH', body: object = {}) {
  return requestJson<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const recordPath = (collection: string, id: string) => `${collection}/${encodeURIComponent(id)}`

export async function listAll<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const records: T[] = []
  const pageSize = 100
  const separator = path.includes('?') ? '&' : '?'
  for (let offset = 0; offset <= 10_000; offset += pageSize) {
    const page = await getJson<T[]>(`${path}${separator}limite=${pageSize}&deslocamento=${offset}`, signal)
    if (!Array.isArray(page)) throw new Error('A API retornou uma lista em formato inesperado.')
    records.push(...page)
    if (page.length < pageSize) return records
  }
  throw new Error('A lista excede o limite de paginação da API.')
}
