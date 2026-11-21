const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const apiBase = configuredBase.replace(/\/+$/, '')

export const usingMocks = configuredBase === ''

export const apiRoutes = {
  panelContext: '/painel/contexto',
  dashboard: '/painel/dashboard',
} as const

export async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(apiBase + path, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`Resposta HTTP ${response.status}`)
  return response.json()
}
