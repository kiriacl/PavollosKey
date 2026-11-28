import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { BrandMark } from '../../components/ui/Brand'
import { Icon } from '../../components/ui/Icon'
import { demoClients } from '../../mocks/clients'
import { demoDashboard } from '../../mocks/dashboard'
import { demoRequests } from '../../mocks/requests'
import { formatCivilDate } from '../../utils/dates'
import { requestOriginLabels, type RequestStatus } from '../../types/request'
import { StoryRecord } from './ServiceJourney'

const tabs = [
  { id: 'overview', name: 'Visão geral', icon: 'grid' },
  { id: 'clients', name: 'Clientes', icon: 'users' },
  { id: 'requests', name: 'Solicitações', icon: 'requests' },
  { id: 'quotes', name: 'Orçamentos', icon: 'quote' },
  { id: 'orders', name: 'Ordens de serviço', icon: 'tools' },
  { id: 'history', name: 'Histórico', icon: 'history' },
] as const

const statusLabels: Record<RequestStatus, string> = {
  pendente: 'Pendente', em_atendimento: 'Em atendimento', resolvida: 'Resolvida', cancelada: 'Cancelada',
}
const clients = new Map(demoClients.map(({ id, nome }) => [id, nome]))
const recent = demoRequests.slice(0, 3)
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
const latestMonth = new Date(recent[0].dataSolicitacao.slice(0, 7) + '-01T00:00:00Z')
const months = Array.from({ length: 6 }, (_, index) => {
  const month = new Date(Date.UTC(latestMonth.getUTCFullYear(), latestMonth.getUTCMonth() + index - 5, 1))
  const key = month.toISOString().slice(0, 7)
  return { key, label: monthFormat.format(month).replace(/\.$/, ''), total: demoRequests.filter(({ dataSolicitacao }) => dataSolicitacao.startsWith(key)).length }
})
const scale = Math.max(1, ...months.map(({ total }) => total))

function Status({ status }: { status: RequestStatus }) {
  return <span className="demo-status" data-status={status}>{statusLabels[status]}</span>
}

function Overview({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <dl className="demo-stats">
        <div><dt>Solicitações</dt><dd>{demoRequests.length}</dd></div>
        <div><dt>Pendentes</dt><dd>{demoRequests.filter(({ status }) => status === 'pendente').length}</dd></div>
        <div><dt>Serviços em andamento</dt><dd>{demoDashboard.servicos.filter(({ status }) => status === 'em_andamento').length}</dd></div>
      </dl>
      <section className="demo-activity" aria-label="Evolução das solicitações">
        <div className="demo-activity-title"><strong>Solicitações por mês</strong><span>Últimos seis meses da amostra</span></div>
        <ul className="demo-graph">
          {months.map(({ key, label, total }) => (
            <li key={key}>
              <div className="demo-bar" style={{ height: `${(total / scale) * 75}%` }} aria-hidden="true" />
              <span className="sr-only">{total} solicitações em </span><span>{label}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="demo-list-title">Solicitações recentes</div>
      <ul className="demo-rows">
        {(compact ? recent.slice(0, 2) : recent).map((request) => (
          <li key={request.id}>
            <div><strong>{request.tipoServico}</strong><span>{clients.get(request.clienteId)}</span></div>
            <Status status={request.status} />
          </li>
        ))}
      </ul>
    </>
  )
}

export function HeroPanel() {
  return (
    <div className="product-window hero-window" role="group" aria-label="Prévia do Dashboard com dados de demonstração">
      <div className="product-toolbar">
        <span><BrandMark /> <strong>Painel da oficina</strong></span><span>Dados de demonstração</span>
      </div>
      <div className="hero-window-body">
        <div className="product-rail" aria-hidden="true">
          {tabs.map(({ id, icon }, index) => <span key={id} data-selected={index === 0}><Icon name={icon} size={17} /></span>)}
        </div>
        <div className="product-overview"><p className="product-heading">Visão geral</p><Overview compact /></div>
      </div>
    </div>
  )
}

export function PanelPreview() {
  const [active, setActive] = useState(0)
  const tabList = useRef<HTMLDivElement>(null)
  const prefix = useId()

  function navigate(event: KeyboardEvent) {
    const next = {
      ArrowLeft: (active + tabs.length - 1) % tabs.length,
      ArrowRight: (active + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActive(next)
    tabList.current?.querySelectorAll('button')[next]?.focus()
  }

  return (
    <div className="product-window product-explorer">
      <div className="product-toolbar">
        <span><BrandMark /> <strong>Painel da oficina</strong></span><span>Dados de demonstração</span>
      </div>
      <div className="product-tabs" role="tablist" aria-label="Módulos da prévia" ref={tabList}>
        {tabs.map(({ id, name, icon }, index) => (
          <button key={id} id={prefix + id} type="button" role="tab" aria-selected={active === index}
            aria-controls={prefix + id + '-panel'} tabIndex={active === index ? 0 : -1}
            onKeyDown={navigate} onClick={() => setActive(index)}>
            <Icon name={icon} size={16} />{name}
          </button>
        ))}
      </div>
      {tabs.map(({ id, name }, index) => (
        <div className="product-panel" role="tabpanel" key={id} id={prefix + id + '-panel'}
          aria-labelledby={prefix + id} tabIndex={0} hidden={active !== index}>
          {active === index && (
            <>
              <p className="product-heading">{name}</p>
              {id === 'overview' && <Overview />}
              {id === 'clients' && (
                <ul className="demo-rows">
                  {demoClients.slice(0, 5).map(({ id: clientId, nome, telefone }) => (
                    <li key={clientId}><strong>{nome}</strong><span>{telefone}</span></li>
                  ))}
                </ul>
              )}
              {id === 'requests' && (
                <ul className="demo-rows">
                  {recent.map(({ id: requestId, tipoServico, origem, dataSolicitacao, status }) => (
                    <li key={requestId}>
                      <div><strong>{tipoServico}</strong><span>{requestOriginLabels[origem]} · {formatCivilDate(dataSolicitacao)}</span></div>
                      <Status status={status} />
                    </li>
                  ))}
                </ul>
              )}
              {id === 'quotes' && <StoryRecord index={3} />}
              {id === 'orders' && <StoryRecord index={5} />}
              {id === 'history' && <StoryRecord index={7} />}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
