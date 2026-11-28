import { Icon } from '../../components/ui/Icon'
import { StatusLabel } from '../../components/ui/StatusLabel'
import { modules, panelHref } from '../../routes/routes'
import { usingMocks } from '../../services/http'
import type { ModuleId } from '../../types/panel'
import { ClientsPage } from '../Clientes/ClientsPage'
import { RequestsPage } from '../Solicitacoes/RequestsPage'
import { BudgetsPage } from './BudgetsPage'
import { HistoryPage } from './HistoryPage'
import { OrdersPage } from './OrdersPage'
import { SettingsPage } from './SettingsPage'
import './dashboard.css'

export function ModulePage({ id, requestId, query }: { id: ModuleId; requestId?: string; query: URLSearchParams }) {
  const create = query.get('acao') === 'novo'
  if (id === 'clientes') return <ClientsPage create={create} />
  if (id === 'solicitacoes') return <RequestsPage requestId={requestId} create={create} />

  const info = modules[id]
  const waitingForApi = id === 'visitas' || id === 'estoque'
  const livePage = !usingMocks && {
    orcamentos: <BudgetsPage key={query.toString()} selection={{
      atendimento: query.get('atendimento') ?? undefined,
      cotacao: query.get('cotacao') ?? undefined,
      orcamento: query.get('orcamento') ?? undefined,
    }} />,
    servicos: <OrdersPage key={query.toString()} initialOrder={query.get('ordem') ?? undefined} />,
    historico: <HistoryPage />,
    configuracoes: <SettingsPage />,
    visitas: null,
    estoque: null,
  }[id]
  return (
    <>
      <div className="panel-intro">
        <p className="eyebrow">
          <span />
          Área de trabalho
        </p>
        <h1>{info.title}</h1>
        <p>{info.description}</p>
      </div>
      {livePage || <section className="scope-card" aria-labelledby="escopo-titulo">
        <div className="scope-heading">
          <span className="icon-tile">
            <Icon name={info.icon} size={25} />
          </span>
          <StatusLabel proposal={waitingForApi}>{waitingForApi ? 'Aguardando API' : 'Disponível no modo API'}</StatusLabel>
        </div>
        <h2 id="escopo-titulo">{waitingForApi ? 'Escopo previsto' : 'O que você pode fazer com a API'}</h2>
        <p>{id === 'visitas' ? 'A API ainda não disponibiliza agenda de visitas.'
          : id === 'estoque' ? 'A API ainda não disponibiliza cadastro e movimentações de estoque.'
          : 'Acesse este módulo com uma sessão autenticada no modo API.'}</p>
        <ul>
          {info.scope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <a href={panelHref()} className="text-link">
          Voltar à visão geral
        </a>
      </section>}
    </>
  )
}
