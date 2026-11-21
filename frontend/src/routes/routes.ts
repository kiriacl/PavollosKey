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
      'Consultar orçamentos',
      'Exibir serviço, deslocamento e total recebidos da API',
      'Acompanhar a aprovação',
    ],
  },
  servicos: {
    title: 'Serviços',
    icon: 'tools',
    description: 'Acompanhamento dos trabalhos da oficina.',
    scope: ['Consultar atendimentos', 'Acompanhar serviços em andamento', 'Registrar a conclusão'],
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
    scope: ['Consultar solicitações anteriores', 'Revisitar os serviços realizados'],
  },
  configuracoes: {
    title: 'Configurações',
    icon: 'settings',
    description: 'Dados e preferências do estabelecimento.',
    scope: ['Consultar os dados do estabelecimento', 'Ajustar preferências conforme as permissões aprovadas'],
  },
}

export const panelHref = (id?: ModuleId) => (id ? `#/painel/${id}` : '#/painel')

export const sections = [
  { id: 'inicio', label: 'Início' },
  { id: 'funcionalidades', label: 'Funcionalidades' },
  { id: 'projeto', label: 'Sobre o projeto' },
] as const

type Route =
  { page: 'landing' } | { page: 'overview' } | { page: 'module'; id: ModuleId } | { page: 'missing' }

export function parseRoute(hash: string): Route {
  if (!hash.startsWith('#/')) return { page: 'landing' }
  const path = hash.slice(1).replace(/\/+$/, '')
  if (!path) return { page: 'landing' }
  if (path === '/painel') return { page: 'overview' }
  const [, parent, id, ...extra] = path.split('/')
  if (parent === 'painel' && isModuleId(id) && extra.length === 0) return { page: 'module', id }
  return { page: 'missing' }
}
