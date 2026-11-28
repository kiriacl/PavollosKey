import { useRef } from 'react'
import { DashboardCharts } from '../../components/dashboard/DashboardCharts'
import { DashboardIndicators } from '../../components/dashboard/DashboardIndicators'
import { RecentRequests } from '../../components/dashboard/RecentRequests'
import { AreaCard } from '../../components/ui/AreaCard'
import { DataState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { StatusLabel } from '../../components/ui/StatusLabel'
import { useDashboard } from '../../hooks/useDashboard'
import { usePanelContext } from '../../hooks/usePanelContext'
import { useProfile } from '../../hooks/useProfile'
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

export function OverviewPage() {
  const { result, retry } = useDashboard()
  const indicatorsHeading = useRef<HTMLHeadingElement>(null)
  const technical = useProfile()?.papel === 'tecnico'

  return (
    <>
      <div className="panel-intro">
        <p className="eyebrow">
          <span />
          Painel administrativo
        </p>
        <h1>Visão geral</h1>
        <p>{technical ? 'Acompanhe as ordens de serviço atribuídas a você.'
          : usingMocks ? 'Acompanhe os indicadores de solicitações, serviços e visitas do estabelecimento.'
          : 'Acompanhe os atendimentos e as ordens de serviço do estabelecimento.'}</p>
      </div>
      <div className="dashboard-layout">
        <section aria-labelledby="dashboard-indicators-title">
          <h2 id="dashboard-indicators-title" ref={indicatorsHeading} tabIndex={-1}>Indicadores</h2>
          {result.status === 'loading' && (
            <DataState status="loading" message="Carregando os dados do dashboard…" />
          )}
          {result.status === 'error' && (
            <DataState
              status="error"
              message="Os dados do dashboard estão indisponíveis. Confira a conexão e tente novamente."
              onRetry={() => {
                indicatorsHeading.current?.focus()
                retry()
              }}
            />
          )}
          {result.status === 'ready' && (
            <DashboardIndicators
              total={technical ? undefined : result.data.requests.length}
              pending={technical ? undefined : result.data.byStatus.pendente}
              inProgress={result.data.inProgress}
              scheduled={result.data.scheduled}
              completed={result.data.completed}
            />
          )}
        </section>
        {result.status === 'ready' && !technical && (
          <>
            <DashboardCharts byStatus={result.data.byStatus} monthly={result.data.monthly} />
            <RecentRequests requests={result.data.requests} />
          </>
        )}
      </div>
      <PanelShortcuts />
    </>
  )
}

function PanelShortcuts() {
  const { result, retry } = usePanelContext()
  return (
    <section aria-labelledby="atalhos-titulo">
      <div className="shortcuts-heading">
        <h2 id="atalhos-titulo">Atalhos do painel</h2>
        {result.status === 'ready' && (
          <span>
            <Icon name="shop" size={17} />
            {result.data.estabelecimento}
          </span>
        )}
      </div>
      {result.status === 'loading' && (
        <DataState status="loading" message="Carregando os atalhos do painel…" />
      )}
      {result.status === 'error' && (
        <DataState
          status="error"
          message="Os atalhos do painel estão indisponíveis. Confira a conexão e tente novamente."
          onRetry={retry}
        />
      )}
      {result.status === 'ready' && (result.data.atalhos.length === 0 ? (
        <DataState status="empty" message="Nenhum atalho disponível. Use o menu para acessar os módulos." />
      ) : (
        <div className="shortcut-grid">
          {result.data.atalhos.map((id) => (
            <AreaCard
              key={id}
              href={panelHref(id)}
              icon={modules[id].icon}
              title={modules[id].title}
              description={modules[id].description}
            />
          ))}
        </div>
      ))}
    </section>
  )
}

export function ModulePage({ id, requestId }: { id: ModuleId; requestId?: string }) {
  if (id === 'clientes') return <ClientsPage />
  if (id === 'solicitacoes') return <RequestsPage requestId={requestId} />

  const info = modules[id]
  const waitingForApi = id === 'visitas' || id === 'estoque'
  const livePage = !usingMocks && {
    orcamentos: <BudgetsPage />,
    servicos: <OrdersPage />,
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
