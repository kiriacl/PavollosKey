import { useCallback } from 'react'
import { DashboardCharts } from '../../components/dashboard/DashboardCharts'
import { RecentRequests } from '../../components/dashboard/RecentRequests'
import { RequestStatusBadge } from '../../components/requests/RequestStatusBadge'
import { DataState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useDashboard } from '../../hooks/useDashboard'
import { useProfile } from '../../hooks/useProfile'
import { workActions } from '../../routes/panelNavigation'
import { panelHref, requestHref } from '../../routes/routes'
import { budgetQuoteLimit, budgetRequestLimit, listPendingDecisions } from '../../services/dashboard'
import { usingMocks } from '../../services/http'
import { orderStatusLabels, type Order } from '../../services/operations'
import type { DashboardRequest } from '../../types/dashboard'
import { formatCivilDate } from '../../utils/dates'
import './workbench.css'

type Snapshot = Extract<ReturnType<typeof useDashboard>['result'], { status: 'ready' }>['data']
const currentDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo',
})

function QuickActions() {
  const links = workActions(useProfile()?.papel)
  return (
    <section className="work-actions" aria-labelledby="work-actions-title">
      <h2 id="work-actions-title">Ações rápidas</h2>
      <ul>
        {links.map(({ title, href, icon }, index) => (
          <li key={title}><a href={href} data-primary={index === 0}>
            <Icon name={icon} size={18} /><span>{title}</span><Icon name="arrow" size={16} />
          </a></li>
        ))}
      </ul>
    </section>
  )
}

function OverviewSummary({ snapshot, technical }: { snapshot: Snapshot; technical: boolean }) {
  const metrics = [
    ...(technical
      ? [{ title: 'Aguardando início', value: snapshot.waiting }]
      : [{ title: 'Atendimentos em aberto', value: snapshot.byStatus.pendente }]),
    { title: 'Serviços em execução', value: snapshot.inProgress },
    { title: 'Serviços concluídos', value: snapshot.completed },
  ]
  return (
    <>
      <dl className="work-metrics">
        {metrics.map(({ value, title }) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="work-summary-note">{technical ? 'Ordens atribuídas ao seu perfil'
        : `${snapshot.requests.length} solicitações registradas${snapshot.scheduled === undefined ? '' : ` · ${snapshot.scheduled} visitas agendadas`}`}</p>
    </>
  )
}

function OpenRequests({ requests }: { requests: DashboardRequest[] }) {
  return (
    <section className="work-surface" aria-labelledby="work-open-title">
      <header className="work-section-header">
        <div><h2 id="work-open-title">Atendimentos que pedem ação</h2><p>Registros em aberto mais recentes.</p></div>
        <span className="work-count" aria-label={`${requests.length} em aberto`}>{requests.length}</span>
      </header>
      {requests.length === 0 ? <p className="work-empty">Nenhum atendimento em aberto.</p> : (
        <ul className="work-list">
          {requests.slice(0, 4).map((request) => (
            <li key={request.id}><a href={requestHref(request.id)}>
              <span className="work-list-icon"><Icon name="requests" size={18} /></span>
              <span className="work-list-copy">
                <strong>{request.descricao}</strong><span>{request.cliente} · {formatCivilDate(request.dataSolicitacao)}</span>
              </span>
              <RequestStatusBadge status={request.status} />
              <Icon className="work-row-arrow" name="diagonal" size={15} />
            </a></li>
          ))}
        </ul>
      )}
      <a className="work-section-link" href={panelHref('solicitacoes')}>Consultar atendimentos <Icon name="arrow" size={15} /></a>
    </section>
  )
}

function OrderQueue({ orders, technical, inProgress }: { orders?: Order[]; technical: boolean; inProgress: number }) {
  const active = orders?.filter(({ status }) => ['em_execucao', 'atribuida', 'aguardando_atribuicao'].includes(status))
  const ordered = active?.toSorted((first, second) => Number(second.status === 'em_execucao') - Number(first.status === 'em_execucao'))
  return (
    <section className="work-surface" aria-labelledby="work-orders-title">
      <header className="work-section-header">
        <div><h2 id="work-orders-title">{technical ? 'Minhas ordens' : 'Ordens de serviço'}</h2><p>Em execução e aguardando andamento.</p></div>
        <Icon name="tools" size={21} />
      </header>
      {!ordered ? (
        <div className="work-empty"><p><strong>{inProgress} serviços em execução na amostra.</strong></p>
          <p>O detalhe das ordens está disponível com a API.</p>
          <a className="text-link" href="#projeto">Explorar a prévia</a>
        </div>
      ) : ordered.length === 0 ? <p className="work-empty">Nenhuma ordem em andamento ou aguardando ação.</p> : (
        <ul className="work-list">
          {ordered.slice(0, 4).map((order) => (
            <li key={order.id}><a href={panelHref('servicos', { ordem: order.id })}>
              <span className="work-list-icon"><Icon name="tools" size={18} /></span>
              <span className="work-list-copy"><strong>{order.escopo}</strong><span>{order.cliente.nome}</span></span>
              <span className="work-order-status" data-running={order.status === 'em_execucao'}>{orderStatusLabels[order.status]}</span>
              <Icon className="work-row-arrow" name="diagonal" size={15} />
            </a></li>
          ))}
        </ul>
      )}
      {ordered && <a className="work-section-link" href={panelHref('servicos')}>Consultar ordens <Icon name="arrow" size={15} /></a>}
    </section>
  )
}

function BudgetDecisions({ requests }: { requests: DashboardRequest[] }) {
  const load = useCallback((signal: AbortSignal) => listPendingDecisions(requests, signal), [requests])
  const { result, retry } = useAsyncData(load)
  return (
    <section className="work-surface work-budget" aria-labelledby="work-budget-title">
      <header className="work-section-header">
        <div><h2 id="work-budget-title">Orçamentos aguardando decisão</h2>
          <p>Até {budgetQuoteLimit} cotações por atendimento, entre os {budgetRequestLimit} atendimentos em aberto mais recentes.</p></div>
        <Icon name="quote" size={21} />
      </header>
      {result.status === 'loading' && <DataState status="loading" message="Consultando orçamentos…" />}
      {result.status === 'error' && <DataState status="error" message="Não foi possível consultar os orçamentos." onRetry={retry} />}
      {result.status === 'ready' && (result.data.length === 0
        ? <p className="work-empty">Nenhum orçamento enviado nas cotações consultadas.</p>
        : <ul className="work-list">
          {result.data.slice(0, 4).map(({ budget, quote, request }) => (
            <li key={budget.id}><a href={panelHref('orcamentos', { atendimento: request.id, cotacao: quote.id, orcamento: budget.id })}>
              <span className="work-list-icon"><Icon name="quote" size={18} /></span>
              <span className="work-list-copy"><strong>{request.cliente}</strong><span>{request.descricao} · Versão {budget.versao}</span></span>
              <span className="work-order-status">Enviado</span>
              <Icon className="work-row-arrow" name="diagonal" size={15} />
            </a></li>
          ))}
        </ul>)}
      <a href={panelHref('orcamentos')} className="work-section-link">Consultar todos os atendimentos para orçamento <Icon name="arrow" size={15} /></a>
    </section>
  )
}

export function OperationsOverview() {
  const role = useProfile()?.papel
  const technical = role === 'tecnico'
  const { result, retry } = useDashboard()
  const snapshot = result.status === 'ready' ? result.data : undefined
  const open = snapshot?.requests.filter(({ status }) => status === 'pendente') ?? []

  return (
    <div className="operations-overview">
      <div className="work-intro">
        <div>
          <h1>Central de operações</h1>
          <p>{technical ? 'Confira suas ordens e retome os serviços em execução.'
            : 'Acompanhe os chamados e organize o próximo trabalho da oficina.'}</p>
        </div>
        <span><Icon name="calendar" size={17} />{currentDate.format(new Date())}</span>
      </div>

      <div className="work-lead">
        <section className="work-summary" data-surface="night" aria-labelledby="work-summary-title">
          <div className="work-summary-heading"><Icon name="shop" size={19} /><span>{technical ? 'Seu trabalho' : 'Operação da oficina'}</span></div>
          <h2 id="work-summary-title">O que pede atenção</h2>
          {result.status === 'loading' && <DataState status="loading" message="Carregando os dados da operação…" />}
          {result.status === 'error' && <DataState status="error" message="Não foi possível carregar a operação." onRetry={retry} />}
          {snapshot && <OverviewSummary snapshot={snapshot} technical={technical} />}
        </section>
        <QuickActions />
      </div>

      {snapshot && (
        <>
          <div className={technical ? 'work-queue work-queue-single' : 'work-queue'}>
            {!technical && <OpenRequests requests={open} />}
            <div className="work-queue-side">
              <OrderQueue orders={snapshot.ordens} technical={technical} inProgress={snapshot.inProgress} />
              {!technical && (usingMocks ? (
                <section className="work-surface work-budget" aria-labelledby="work-demo-budget-title">
                  <header className="work-section-header"><div><h2 id="work-demo-budget-title">Orçamentos aguardando decisão</h2>
                    <p>As versões enviadas são consultadas na API.</p></div><Icon name="quote" size={21} /></header>
                  <div className="work-empty"><a className="text-link" href="#projeto">Abrir prévia dos módulos</a></div>
                </section>
              ) : <BudgetDecisions requests={open} />)}
            </div>
          </div>
          {!technical && (
            <>
              <section className="work-analysis" aria-labelledby="work-analysis-title">
                <h2 id="work-analysis-title">Desempenho da operação</h2>
                <DashboardCharts byStatus={snapshot.byStatus} monthly={snapshot.monthly} />
              </section>
              <RecentRequests requests={snapshot.requests} />
            </>
          )}
        </>
      )}
    </div>
  )
}
