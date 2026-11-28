import { usingMocks } from '../../services/http'
import { requestOrigins, requestStatuses, type RequestStatus } from '../../types/request'

export const requestStatusLabels: Record<RequestStatus, string> = {
  pendente: usingMocks ? 'Pendente' : 'Aberto',
  em_atendimento: 'Em atendimento',
  resolvida: usingMocks ? 'Resolvida' : 'Encerrado',
  cancelada: usingMocks ? 'Cancelada' : 'Cancelado',
}

export const visibleRequestStatuses = usingMocks ? requestStatuses : (['pendente', 'resolvida', 'cancelada'] as const)
export const visibleRequestOrigins = usingMocks ? requestOrigins : (['presencial', 'whatsapp'] as const)
