import { getJson, listAll, recordPath, writeJson } from './http'

export type Channel = 'presencial' | 'whatsapp'
export type Quote = { id: string; tipo: 'inicial' | 'complementar'; criado_em: string }
export type BudgetStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado' | 'substituido' | 'cancelado'
export type BudgetSummary = { id: string; versao: number; status: BudgetStatus; validade_ate: string | null; total: number }
export type BudgetItem = { id: string; escopo: string; valor: number }
export type Budget = BudgetSummary & {
  itens: BudgetItem[]
  canal_aceite: Channel | null
  evidencia_aceite: string | null
}
export type OrderStatus = 'aguardando_atribuicao' | 'atribuida' | 'em_execucao' | 'concluida' | 'cancelada'
export type Order = {
  id: string
  escopo: string
  status: OrderStatus
  tecnico_id: string | null
  local_execucao: string | null
  observacao_execucao: string | null
  motivo_cancelamento: string | null
  criado_em: string
  cliente: { id: string; nome: string; telefone: string | null }
}
export type HistoryEvent = {
  id: string
  ator_id: string
  ocorrido_em: string
  tipo_evento: 'status' | 'atribuicao'
  status_anterior: string | null
  status_novo: string | null
  tecnico_anterior_id: string | null
  tecnico_novo_id: string | null
  atendimento_id?: string | null
  orcamento_id?: string | null
  ordem_servico_id?: string | null
  motivo: string | null
}

const quotesPath = (id: string) => `${recordPath('/atendimentos', id)}/cotacoes`
const budgetsPath = (id: string) => `${recordPath('/cotacoes', id)}/orcamentos`
const budgetPath = (id: string) => recordPath('/orcamentos', id)
const orderPath = (id: string) => recordPath('/ordens-servico', id)

export const listQuotes = (id: string, signal: AbortSignal) => listAll<Quote>(quotesPath(id), signal)
export const createQuote = (id: string, tipo: Quote['tipo']) => writeJson<Quote>(quotesPath(id), 'POST', { tipo })
export const listBudgets = (id: string, signal: AbortSignal) => listAll<BudgetSummary>(budgetsPath(id), signal)
export const createBudget = (id: string, body: { validade_ate: string | null; itens: Omit<BudgetItem, 'id'>[] }) =>
  writeJson<Budget>(budgetsPath(id), 'POST', body)
export const getBudget = (id: string, signal: AbortSignal) => getJson<Budget>(budgetPath(id), signal)
export const addBudgetItem = (id: string, body: Omit<BudgetItem, 'id'>) =>
  writeJson<BudgetItem>(`${budgetPath(id)}/itens`, 'POST', body)
export const updateBudgetStatus = (id: string, action: 'enviar' | 'aprovar' | 'recusar' | 'expirar',
  body?: { canal_aceite: Channel; evidencia_aceite: string }) =>
  writeJson<Budget>(`${budgetPath(id)}/${action}`, 'POST', body)
export const listOrders = (signal: AbortSignal) => listAll<Order>('/ordens-servico', signal)
export const getOrder = (id: string, signal: AbortSignal) => getJson<Order>(orderPath(id), signal)
export const createOrder = (item_orcamento_id: string, local_execucao: string | null) =>
  writeJson<Order>('/ordens-servico', 'POST', { item_orcamento_id, local_execucao })
export const updateOrder = (id: string, observacao_execucao: string) =>
  writeJson<Order>(orderPath(id), 'PATCH', { observacao_execucao })
export const updateOrderStatus = (id: string, action: 'atribuir' | 'iniciar' | 'concluir' | 'cancelar',
  body?: { tecnico_id: string } | { motivo: string }) =>
  writeJson<Order>(`${orderPath(id)}/${action}`, 'POST', body)
export const listRequestHistory = (id: string, signal: AbortSignal) =>
  listAll<HistoryEvent>(`${recordPath('/atendimentos', id)}/historico`, signal)
export const listOrderHistory = (id: string, signal: AbortSignal) =>
  listAll<HistoryEvent>(`${orderPath(id)}/historico`, signal)
export const listTechnicians = (signal: AbortSignal) => listAll<{ id: string; nome: string }>('/usuarios/tecnicos', signal)
export const linkCollaborator = (usuario_id: string, nome: string, papel: 'auxiliar' | 'tecnico') =>
  writeJson<{ id: string }>('/usuarios/vincular', 'POST', { usuario_id, nome, papel })

export const budgetStatusLabels: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado',
  expirado: 'Expirado', substituido: 'Substituído', cancelado: 'Cancelado',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  aguardando_atribuicao: 'Aguardando atribuição', atribuida: 'Atribuída', em_execucao: 'Em execução',
  concluida: 'Concluída', cancelada: 'Cancelada',
}
