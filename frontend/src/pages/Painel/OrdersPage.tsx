import { useCallback, useState } from 'react'
import { RecordHistory } from '../../components/requests/RecordHistory'
import { OperationForm } from '../../components/ui/OperationForm'
import { ReadResult } from '../../components/ui/ReadResult'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useProfile } from '../../hooks/useProfile'
import {
  getOrder, listOrders, listTechnicians, orderStatusLabels, updateOrder, updateOrderStatus, type Order,
} from '../../services/operations'
import { formatTimestamp } from '../../utils/dates'

export function OrdersPage() {
  const query = useAsyncData(listOrders)
  const [orderId, setOrderId] = useState('')
  return (
    <div className="operation-grid">
      <section className="dashboard-card operation-card">
        <h2>Ordens de serviço</h2>
        <ReadResult query={query} name="as ordens de serviço">
          {(orders) => orders.length ? (
            <label className="operation-select">Ordem
              <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                <option value="">Selecione uma ordem</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.cliente.nome} · {order.escopo} · {orderStatusLabels[order.status]}
                  </option>
                ))}
              </select>
            </label>
          ) : <p>Nenhuma ordem de serviço disponível.</p>}
        </ReadResult>
      </section>
      {orderId && <OrderDetails key={orderId} id={orderId} onChange={(saved) =>
        query.updateData((orders) => orders.map((order) => order.id === saved.id ? saved : order))
      } />}
    </div>
  )
}

function OrderDetails({ id, onChange }: { id: string; onChange: (order: Order) => void }) {
  const profile = useProfile()
  const load = useCallback((signal: AbortSignal) => getOrder(id, signal), [id])
  const query = useAsyncData(load)
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)

  function save(order: Order) {
    query.updateData(() => order)
    onChange(order)
    setRevision((current) => current + 1)
    setNotice('Ordem atualizada.')
  }

  return (
    <section className="dashboard-card operation-card">
      <h2>Detalhes da ordem</h2>
      <p role="status">{notice}</p>
      <ReadResult query={query} name="a ordem">
        {(order) => (
          <>
            <dl className="request-details-grid">
              <div><dt>Cliente</dt><dd>{order.cliente.nome}</dd></div>
              <div><dt>Telefone</dt><dd>{order.cliente.telefone || 'Não informado'}</dd></div>
              <div><dt>Status</dt><dd>{orderStatusLabels[order.status]}</dd></div>
              <div><dt>Criação</dt><dd>{formatTimestamp(order.criado_em)}</dd></div>
              <div><dt>Local de execução</dt><dd>{order.local_execucao || 'Não informado'}</dd></div>
              <div><dt>Técnico atribuído</dt><dd>{order.tecnico_id || 'Aguardando atribuição'}</dd></div>
              <div><dt>Escopo</dt><dd>{order.escopo}</dd></div>
              {order.observacao_execucao && <div><dt>Observação de execução</dt><dd>{order.observacao_execucao}</dd></div>}
              {order.motivo_cancelamento && <div><dt>Motivo do cancelamento</dt><dd>{order.motivo_cancelamento}</dd></div>}
            </dl>
            <div key={revision}>
              {profile?.papel === 'proprietario' && !['concluida', 'cancelada'].includes(order.status) && (
                <>
                  <AssignTechnician order={order} onSave={save} />
                  <details>
                    <summary>Cancelar ordem</summary>
                    <OperationForm label="Confirmar cancelamento" run={async (data) => {
                      save(await updateOrderStatus(id, 'cancelar', { motivo: String(data.get('motivo')).trim() }))
                    }}>
                      <label>Motivo<textarea name="motivo" maxLength={1000} required /></label>
                    </OperationForm>
                  </details>
                </>
              )}
              {profile?.papel === 'tecnico' && profile.id === order.tecnico_id && (
                <>
                  {order.status === 'atribuida' && <OperationForm label="Iniciar serviço" run={async () => {
                    save(await updateOrderStatus(id, 'iniciar'))
                  }} />}
                  {(order.status === 'atribuida' || order.status === 'em_execucao') && (
                    <OperationForm label="Salvar observação" run={async (data) => {
                      save(await updateOrder(id, String(data.get('observacao')).trim()))
                    }}>
                      <label>Observação de execução<textarea name="observacao" maxLength={2000} required defaultValue={order.observacao_execucao ?? ''} /></label>
                    </OperationForm>
                  )}
                  {order.status === 'em_execucao' && <OperationForm label="Concluir serviço" run={async () => {
                    save(await updateOrderStatus(id, 'concluir'))
                  }} />}
                </>
              )}
              <details>
                <summary>Histórico da ordem</summary>
                <RecordHistory recordId={id} order />
              </details>
            </div>
            <button className="text-link" type="button" onClick={query.retry}>Atualizar ordem</button>
          </>
        )}
      </ReadResult>
    </section>
  )
}

function AssignTechnician({ order, onSave }: { order: Order; onSave: (order: Order) => void }) {
  const query = useAsyncData(listTechnicians)
  return (
    <details>
      <summary>Atribuir técnico</summary>
      <ReadResult query={query} name="os técnicos">
        {(technicians) => technicians.length ? (
          <OperationForm label="Salvar atribuição" run={async (data) => {
            onSave(await updateOrderStatus(order.id, 'atribuir', { tecnico_id: String(data.get('tecnico')) }))
          }}>
            <label>Técnico
              <select name="tecnico" required defaultValue="">
                <option value="">Selecione um técnico</option>
                {technicians.filter(({ id }) => id !== order.tecnico_id).map(({ id, nome }) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
          </OperationForm>
        ) : <p>Nenhum técnico ativo cadastrado.</p>}
      </ReadResult>
    </details>
  )
}
