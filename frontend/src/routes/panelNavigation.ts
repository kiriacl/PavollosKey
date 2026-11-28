import type { IconName } from '../components/ui/Icon'
import type { Role } from '../services/auth'
import { usingMocks } from '../services/http'
import { moduleIds, type ModuleId } from '../types/panel'
import { panelHref } from './routes'

export const panelGroups: { title: string; ids: ModuleId[] }[] = [
  { title: 'Atendimento', ids: ['solicitacoes', 'clientes', 'orcamentos'] },
  { title: 'Oficina', ids: ['servicos', 'visitas', 'estoque'] },
  { title: 'Registros', ids: ['historico', 'configuracoes'] },
]

const technicalModules: ModuleId[] = ['servicos', 'historico', 'configuracoes']

export function panelModules(role?: Role): readonly ModuleId[] {
  return role === 'tecnico' ? technicalModules : moduleIds
}

export type WorkLink = { title: string; href: string; icon: IconName }

export function workActions(role?: Role): WorkLink[] {
  const orders: WorkLink = { title: role === 'tecnico' ? 'Minhas ordens' : 'Acompanhar ordens', href: panelHref('servicos'), icon: 'tools' }
  if (role === 'tecnico') return [orders, { title: 'Consultar histórico', href: panelHref('historico'), icon: 'history' }]
  const actions: WorkLink[] = [
    { title: 'Cadastrar cliente', href: panelHref('clientes', { acao: 'novo' }), icon: 'users' },
    { title: 'Registrar solicitação', href: panelHref('solicitacoes', { acao: 'novo' }), icon: 'plus' },
    { title: 'Consultar atendimentos', href: panelHref('solicitacoes'), icon: 'requests' },
  ]
  return usingMocks ? actions : [...actions, { title: 'Consultar orçamentos', href: panelHref('orcamentos'), icon: 'quote' }, orders]
}
