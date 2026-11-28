import type { RequestStatus } from './request'
import type { Order } from '../services/operations'

export const serviceStatuses = ['aguardando', 'em_andamento', 'concluido', 'cancelado'] as const
export const visitStatuses = ['agendada', 'realizada', 'cancelada'] as const

export interface DashboardRequest {
  id: string
  cliente: string
  descricao: string
  dataSolicitacao: string // Data civil no formato AAAA-MM-DD.
  origem: string
  status: RequestStatus
}

export interface DashboardService {
  id: string
  status: (typeof serviceStatuses)[number]
}

export interface DashboardVisit {
  id: string
  status: (typeof visitStatuses)[number]
}

export interface DashboardData {
  solicitacoes: DashboardRequest[]
  servicos: DashboardService[]
  ordens?: Order[]
  visitas: DashboardVisit[] | null
}

export type RequestCounts = Record<RequestStatus, number>

export interface MonthlyRequestCount {
  month: Date
  count: number
}
