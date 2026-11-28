import { getDashboard } from '../services/dashboard'
import type { MonthlyRequestCount, RequestCounts } from '../types/dashboard'
import { useAsyncData } from './useAsyncData'
import { useProfile } from './useProfile'
import type { Role } from '../services/auth'

const trendMonths = 6

async function loadDashboard(signal: AbortSignal, role?: Role) {
  const { solicitacoes, servicos, ordens, visitas } = await getDashboard(signal, role)
  const requests = solicitacoes.toSorted((first, second) =>
    second.dataSolicitacao.localeCompare(first.dataSolicitacao),
  )
  const byStatus: RequestCounts = { pendente: 0, em_atendimento: 0, resolvida: 0, cancelada: 0 }
  const countsByMonth = new Map<string, number>()

  for (const request of requests) {
    byStatus[request.status] += 1
    const month = request.dataSolicitacao.slice(0, 7)
    countsByMonth.set(month, (countsByMonth.get(month) ?? 0) + 1)
  }

  const monthly: MonthlyRequestCount[] = []
  if (requests.length > 0) {
    const latestMonth = new Date(requests[0].dataSolicitacao)
    latestMonth.setUTCDate(1)

    for (let offset = trendMonths - 1; offset >= 0; offset -= 1) {
      const month = new Date(latestMonth)
      month.setUTCMonth(month.getUTCMonth() - offset)
      monthly.push({ month, count: countsByMonth.get(month.toISOString().slice(0, 7)) ?? 0 })
    }
  }

  return {
    requests,
    ordens,
    byStatus,
    monthly,
    inProgress: servicos.filter((service) => service.status === 'em_andamento').length,
    completed: servicos.filter((service) => service.status === 'concluido').length,
    waiting: servicos.filter((service) => service.status === 'aguardando').length,
    scheduled: visitas?.filter((visit) => visit.status === 'agendada').length,
  }
}

export function useDashboard() {
  const role = useProfile()?.papel
  const load = useCallback((signal: AbortSignal) => loadDashboard(signal, role), [role])
  return useAsyncData(load)
}
import { useCallback } from 'react'
