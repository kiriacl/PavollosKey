import { useState } from 'react'
import { RecordHistory } from '../../components/requests/RecordHistory'
import { ReadResult } from '../../components/ui/ReadResult'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useProfile } from '../../hooks/useProfile'
import { listOrders } from '../../services/operations'
import { listRequests } from '../../services/requests'
import { formatCivilDate } from '../../utils/dates'

const loadRequests = (signal: AbortSignal) => listRequests(signal)

export function HistoryPage() {
  const profile = useProfile()
  const [order, setOrder] = useState(profile?.papel === 'tecnico')
  return (
    <section className="dashboard-card operation-card">
      <h2>Eventos por registro</h2>
      {profile?.papel !== 'tecnico' && (
        <label className="operation-select">Tipo de registro
          <select value={order ? 'ordem' : 'atendimento'} onChange={(event) => setOrder(event.target.value === 'ordem')}>
            <option value="atendimento">Atendimentos</option>
            <option value="ordem">Ordens de serviço</option>
          </select>
        </label>
      )}
      {order ? <OrderHistory /> : <RequestHistory />}
    </section>
  )
}

function OrderHistory() {
  const query = useAsyncData(listOrders)
  const [id, setId] = useState('')
  return (
    <ReadResult query={query} name="as ordens de serviço">
      {(orders) => orders.length ? (
        <>
          <label className="operation-select">Ordem de serviço
            <select value={id} onChange={(event) => setId(event.target.value)}>
              <option value="">Selecione uma ordem</option>
              {orders.map((order) => <option key={order.id} value={order.id}>{order.cliente.nome} · {order.escopo}</option>)}
            </select>
          </label>
          {id && <RecordHistory key={id} recordId={id} order />}
        </>
      ) : <p>Nenhuma ordem de serviço disponível.</p>}
    </ReadResult>
  )
}

function RequestHistory() {
  const query = useAsyncData(loadRequests)
  const [id, setId] = useState('')
  return (
    <ReadResult query={query} name="os atendimentos">
      {(requests) => requests.length ? (
        <>
          <label className="operation-select">Atendimento
            <select value={id} onChange={(event) => setId(event.target.value)}>
              <option value="">Selecione um atendimento</option>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>{formatCivilDate(request.dataSolicitacao)} · {request.descricao}</option>
              ))}
            </select>
          </label>
          {id && <RecordHistory key={id} recordId={id} />}
        </>
      ) : <p>Nenhum atendimento disponível.</p>}
    </ReadResult>
  )
}
