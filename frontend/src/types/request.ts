// Códigos provisórios compartilhados com o Dashboard.
export const requestStatuses = ['pendente', 'em_atendimento', 'resolvida', 'cancelada'] as const
export const requestOrigins = ['presencial', 'telefone', 'whatsapp', 'site'] as const

export type RequestStatus = (typeof requestStatuses)[number]
export type RequestOrigin = (typeof requestOrigins)[number]

export const requestOriginLabels: Record<RequestOrigin, string> = {
  presencial: 'Presencial',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  site: 'Site',
}

export interface RequestInput {
  clienteId: string
  tipoServico: string
  descricao: string
  origem: RequestOrigin
  endereco: string
  dataSolicitacao: string
  observacoes: string
}

export interface ServiceRequest extends RequestInput {
  id: string
  status: RequestStatus
  criadoEm: string
  atualizadoEm: string
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return requestStatuses.some((status) => status === value)
}

export function isRequestOrigin(value: unknown): value is RequestOrigin {
  return requestOrigins.some((origin) => origin === value)
}
