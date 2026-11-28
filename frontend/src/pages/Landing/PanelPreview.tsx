import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { RequestStatusBadge } from '../../components/requests/RequestStatusBadge'
import { Icon } from '../../components/ui/Icon'
import { demoClients } from '../../mocks/clients'
import { demoDashboard } from '../../mocks/dashboard'
import { demoRequests } from '../../mocks/requests'
import { requestOriginLabels, type RequestStatus } from '../../types/request'

const tabs = [
  { id: 'overview', name: 'Visão geral', icon: 'grid' },
  { id: 'clients', name: 'Clientes', icon: 'users' },
  { id: 'requests', name: 'Solicitações', icon: 'requests' },
] as const

const demoStatuses: Record<RequestStatus, string> = {
  pendente: 'Pendente', em_atendimento: 'Em atendimento', resolvida: 'Resolvida', cancelada: 'Cancelada',
}
const requests = demoRequests.slice(0, 3)
const clientNames = new Map(demoClients.map((client) => [client.id, client.nome]))

export function PanelPreview() {
  const [active, setActive] = useState(0)
  const tabList = useRef<HTMLDivElement>(null)
  const prefix = useId()
  const panelId = prefix + '-preview'

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
    <div className="preview-window">
      <div className="preview-window-header">
        <span><Icon name="panel" size={17} /> Painel da oficina</span>
        <span className="preview-mode">Dados de demonstração</span>
      </div>
      <div className="preview-tablist" role="tablist" aria-label="Telas da demonstração" ref={tabList}>
        {tabs.map(({ id, name, icon }, index) => (
          <button key={id} id={prefix + id} type="button" role="tab" aria-selected={active === index}
            aria-controls={panelId} tabIndex={active === index ? 0 : -1} onKeyDown={navigate}
            onClick={() => setActive(index)}>
            <Icon name={icon} size={16} />{name}
          </button>
        ))}
      </div>
      <div className="preview-content" role="tabpanel" id={panelId} aria-labelledby={prefix + tabs[active].id} tabIndex={0}>
        {active === 0 && (
          <dl className="preview-stats">
            <div><dt>Solicitações</dt><dd>{demoRequests.length}</dd></div>
            <div><dt>Pendentes</dt><dd>{demoRequests.filter(({ status }) => status === 'pendente').length}</dd></div>
            <div><dt>Serviços em andamento</dt><dd>{demoDashboard.servicos.filter(({ status }) => status === 'em_andamento').length}</dd></div>
          </dl>
        )}
        {active === 1 ? (
          <ul className="preview-records">
            {demoClients.slice(0, 3).map(({ id, nome, telefone }) => (
              <li key={id}>
                <span className="preview-record-main"><Icon name="users" size={17} /><strong>{nome}</strong></span>
                <span>{telefone}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="preview-records">
            {requests.map((request) => (
              <li key={request.id}>
                <div className="preview-record-copy">
                  <strong>{request.tipoServico}</strong>
                  <span>{active === 0 ? clientNames.get(request.clienteId) : requestOriginLabels[request.origem]}</span>
                </div>
                <RequestStatusBadge status={request.status} label={demoStatuses[request.status]} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
