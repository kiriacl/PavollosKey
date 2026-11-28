import { useCallback } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { budgetStatusLabels, listOrderHistory, listRequestHistory, orderStatusLabels } from '../../services/operations'
import { formatTimestamp } from '../../utils/dates'
import { ReadResult } from '../ui/ReadResult'

const labels: Record<string, string> = {
  ...budgetStatusLabels, ...orderStatusLabels, aberto: 'Aberto', encerrado: 'Encerrado', cancelado: 'Cancelado',
}

export function RecordHistory({ recordId, order = false }: { recordId: string; order?: boolean }) {
  const load = useCallback((signal: AbortSignal) =>
    (order ? listOrderHistory : listRequestHistory)(recordId, signal), [order, recordId])
  const query = useAsyncData(load)
  return (
    <ReadResult query={query} name="os eventos">
      {(events) => events.length ? (
        <ul className="operation-list">
          {events.map((event) => (
            <li key={event.id}>
              <time dateTime={event.ocorrido_em}>{formatTimestamp(event.ocorrido_em)}</time>
              {event.tipo_evento === 'atribuicao' ? (
                <p>Atribuição de técnico {event.tecnico_anterior_id ? `${event.tecnico_anterior_id} → ` : ''}{event.tecnico_novo_id}</p>
              ) : (
                <p>{event.status_anterior ? `${labels[event.status_anterior] ?? event.status_anterior} → ` : ''}{event.status_novo ? labels[event.status_novo] ?? event.status_novo : 'Status registrado'}</p>
              )}
              <p>Responsável {event.ator_id}</p>
              {event.ordem_servico_id && !order && <p>Ordem {event.ordem_servico_id}</p>}
              {event.orcamento_id && <p>Orçamento {event.orcamento_id}</p>}
              {event.motivo && <p>{event.motivo}</p>}
            </li>
          ))}
        </ul>
      ) : <p className="state-box">Nenhum evento registrado.</p>}
    </ReadResult>
  )
}
