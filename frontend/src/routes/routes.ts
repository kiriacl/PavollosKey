import type { IconName } from '../components/ui/Icon'
import { isModuleId, type ModuleId } from '../types/panel'

interface ModuleInfo {
  title: string
  icon: IconName
  description: string
  scope: string[]
}

export const modules: Record<ModuleId, ModuleInfo> = {
  clientes: {
    title: 'Clientes',
    icon: 'users',
    description: 'Cadastro e consulta das pessoas atendidas.',
    scope: ['Pesquisar clientes', 'Cadastrar um cliente', 'Consultar e editar o cadastro'],
  },
  solicitacoes: {
    title: 'Solicitações',
    icon: 'requests',
    description: 'Pedidos de serviço e canais de entrada.',
    scope: [
      'Filtrar por origem e situação',
      'Consultar cliente, serviço e data de criação',
      'Abrir os detalhes da solicitação',
    ],
  },
  visitas: {
    title: 'Visitas',
    icon: 'calendar',
    description: 'Agenda dos atendimentos externos.',
    scope: [
      'Consultar agendamentos',
      'Ver endereço e situação da visita',
      'Exibir a taxa de deslocamento informada pela API',
    ],
  },
  orcamentos: {
    title: 'Orçamentos',
    icon: 'quote',
    description: 'Valores apresentados e aprovações.',
    scope: [
      'Criar cotações e versões de orçamento',
      'Incluir itens e consultar o total calculado',
      'Registrar a decisão do cliente',
    ],
  },
  servicos: {
    title: 'Serviços',
    icon: 'tools',
    description: 'Acompanhamento dos trabalhos da oficina.',
    scope: ['Consultar ordens de serviço', 'Atribuir e acompanhar a execução', 'Registrar observações e conclusão'],
  },
  estoque: {
    title: 'Estoque',
    icon: 'box',
    description: 'Materiais e movimentações da oficina.',
    scope: [
      'Consultar materiais e quantidades',
      'Cadastrar materiais',
      'Registrar movimentações conforme o contrato da API',
    ],
  },
  historico: {
    title: 'Histórico',
    icon: 'history',
    description: 'Consulta de atendimentos anteriores.',
    scope: ['Consultar os eventos de um atendimento', 'Consultar as mudanças de uma ordem de serviço'],
  },
  configuracoes: {
    title: 'Configurações',
    icon: 'settings',
    description: 'Dados e preferências do estabelecimento.',
    scope: ['Consultar o estabelecimento e o perfil', 'Vincular colaboradores com o perfil de proprietário'],
  },
}

export const panelHref = (id?: ModuleId, params?: Record<string, string>) => {
  const query = new URLSearchParams(params).toString()
  return (id ? `#/painel/${id}` : '#/painel') + (query ? `?${query}` : '')
}
export const requestHref = (id: string) => `${panelHref('solicitacoes')}/${encodeURIComponent(id)}`

export const sections = [
  { id: 'inicio', label: 'Início' },
  { id: 'funcionalidades', label: 'A rotina' },
  { id: 'atendimento', label: 'A jornada' },
  { id: 'projeto', label: 'O produto' },
] as const

type Route =
  { page: 'landing' } | { page: 'overview' } | { page: 'module'; id: ModuleId; requestId?: string; query: URLSearchParams } | { page: 'missing' }

export function parseRoute(hash: string): Route {
  if (!hash.startsWith('#/')) return { page: 'landing' }
  const [segment, search] = hash.slice(1).split('?', 2)
  const path = segment.replace(/\/+$/, '')
  const query = new URLSearchParams(search)
  if (!path) return { page: 'landing' }
  if (path === '/painel') return { page: 'overview' }
  const [, parent, id, ...extra] = path.split('/')
  if (parent === 'painel' && isModuleId(id) && extra.length === 0) return { page: 'module', id, query }
  if (parent === 'painel' && id === 'solicitacoes' && extra.length === 1) {
    try {
      const requestId = decodeURIComponent(extra[0])
      if (requestId.trim() && requestId !== '.' && requestId !== '..') return { page: 'module', id, requestId, query }
    } catch {
      return { page: 'missing' }
    }
  }
  return { page: 'missing' }
}
