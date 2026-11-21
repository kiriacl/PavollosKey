import { demoDashboard } from '../mocks/dashboard'
import {
  requestStatuses, serviceStatuses, visitStatuses,
  type DashboardData, type DashboardRequest, type DashboardService, type DashboardVisit,
} from '../types/dashboard'
import { apiRoutes, getJson, usingMocks } from './http'

function hasId(value: unknown): value is Record<string, unknown> & { id: string } {
  return typeof value === 'object' && value !== null && 'id' in value && isText(value.id)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isRequest(value: unknown): value is DashboardRequest {
  return hasId(value) && isText(value.cliente) && isText(value.tipoServico)
    && isDate(value.dataSolicitacao) && isText(value.origem)
    && requestStatuses.some((status) => status === value.status)
}

function isService(value: unknown): value is DashboardService {
  return hasId(value) && serviceStatuses.some((status) => status === value.status)
}

function isVisit(value: unknown): value is DashboardVisit {
  return hasId(value) && visitStatuses.some((status) => status === value.status)
}

function isCollection<T extends { id: string }>(
  value: unknown, isItem: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(isItem)
    && new Set(value.map((item) => item.id)).size === value.length
}

export async function getDashboard(signal: AbortSignal): Promise<DashboardData> {
  signal.throwIfAborted()
  if (usingMocks) return demoDashboard

  const data = await getJson(apiRoutes.dashboard, signal)
  if (
    typeof data !== 'object' || data === null
    || !('solicitacoes' in data) || !isCollection(data.solicitacoes, isRequest)
    || !('servicos' in data) || !isCollection(data.servicos, isService)
    || !('visitas' in data) || !isCollection(data.visitas, isVisit)
  ) {
    throw new Error('Os dados do dashboard têm um formato inesperado.')
  }

  return { solicitacoes: data.solicitacoes, servicos: data.servicos, visitas: data.visitas }
}
