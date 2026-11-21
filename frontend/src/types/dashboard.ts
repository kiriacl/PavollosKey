// Estados provisórios do contrato de leitura do Dashboard.
export const requestStatuses = ['pendente', 'em_atendimento', 'resolvida', 'cancelada'] as const
export const serviceStatuses = ['aguardando', 'em_andamento', 'concluido'] as const
export const visitStatuses = ['agendada', 'realizada', 'cancelada'] as const

export type RequestStatus = (typeof requestStatuses)[number]

export interface DashboardRequest {
  id: string
  cliente: string
  tipoServico: string
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
  visitas: DashboardVisit[]
}

export type RequestCounts = Record<RequestStatus, number>

export interface MonthlyRequestCount {
  month: Date
  count: number
}
