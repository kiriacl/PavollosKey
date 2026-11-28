import { demoDashboard } from '../mocks/dashboard'
import type { DashboardData, DashboardRequest, DashboardService } from '../types/dashboard'
import { requestOriginLabels } from '../types/request'
import type { Role } from './auth'
import { listClients } from './clients'
import { usingMocks } from './http'
import { listBudgets, listOrders, listQuotes } from './operations'
import { listRequests } from './requests'

export async function getDashboard(signal: AbortSignal, role?: Role): Promise<DashboardData> {
  signal.throwIfAborted()
  const commercial = role !== 'tecnico'
  const [requests, clients, orders] = await Promise.all([
    commercial ? listRequests(signal) : [],
    commercial ? listClients(signal) : [],
    usingMocks ? [] : listOrders(signal),
  ])
  const names = new Map(clients.map(({ id, nome }) => [id, nome]))
  return {
    solicitacoes: requests.map(({ id, clienteId, tipoServico, descricao, dataSolicitacao, origem, status }) => ({
      id,
      cliente: names.get(clienteId) ?? 'Cliente indisponível',
      descricao: usingMocks ? tipoServico : descricao,
      dataSolicitacao,
      origem: requestOriginLabels[origem],
      status,
    })),
    servicos: usingMocks ? demoDashboard.servicos : orders.map(({ id, status }): DashboardService => ({
      id, status: status === 'em_execucao' ? 'em_andamento'
        : status === 'concluida' ? 'concluido' : status === 'cancelada' ? 'cancelado' : 'aguardando',
    })),
    ordens: usingMocks ? undefined : orders,
    visitas: usingMocks ? demoDashboard.visitas : null,
  }
}

export const budgetRequestLimit = 5
export const budgetQuoteLimit = 2

export async function listPendingDecisions(requests: readonly DashboardRequest[], signal: AbortSignal) {
  if (usingMocks) return []
  const batches = await Promise.all(requests.slice(0, budgetRequestLimit).map(async (request) => {
    const quotes = await listQuotes(request.id, signal)
    return Promise.all(quotes.slice(0, budgetQuoteLimit).map(async (quote) => {
      const budgets = await listBudgets(quote.id, signal)
      return budgets.filter(({ status }) => status === 'enviado').map((budget) => ({ budget, quote, request }))
    }))
  }))
  return batches.flat(2)
}
