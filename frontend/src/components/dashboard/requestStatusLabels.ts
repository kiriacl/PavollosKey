import type { RequestStatus } from '../../types/dashboard'

export const requestStatusLabels: Record<RequestStatus, string> = {
  pendente: 'Pendente',
  em_atendimento: 'Em atendimento',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
}
