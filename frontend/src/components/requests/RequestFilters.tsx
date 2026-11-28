import type { RequestFilters as FilterValues } from '../../hooks/useRequests'
import { isRequestOrigin, isRequestStatus, requestOriginLabels } from '../../types/request'
import { usingMocks } from '../../services/http'
import { Icon } from '../ui/Icon'
import { requestStatusLabels, visibleRequestOrigins, visibleRequestStatuses } from './requestStatusLabels'

export function RequestFilters({ filters, hasFilters, onChange, onClear }: {
  filters: FilterValues
  hasFilters: boolean
  onChange: (filters: FilterValues) => void
  onClear: () => void
}) {
  return (
    <div className="request-list-filters">
      <label className="request-list-search">
        {usingMocks ? 'Cliente ou tipo de serviço' : 'Cliente ou descrição'}
        <span>
          <Icon name="search" size={18} />
          <input id="request-list-search" type="search" value={filters.text}
            onChange={(event) => onChange({ ...filters, text: event.target.value })} />
        </span>
      </label>
      <label>
        Status
        <select value={filters.status} onChange={(event) => {
          const status = event.target.value
          onChange({ ...filters, status: isRequestStatus(status) ? status : '' })
        }}>
          <option value="">Todos</option>
          {visibleRequestStatuses.map((status) => <option key={status} value={status}>{requestStatusLabels[status]}</option>)}
        </select>
      </label>
      <label>
        Origem
        <select value={filters.origin} onChange={(event) => {
          const origin = event.target.value
          onChange({ ...filters, origin: isRequestOrigin(origin) ? origin : '' })
        }}>
          <option value="">Todas</option>
          {visibleRequestOrigins.map((origin) => <option key={origin} value={origin}>{requestOriginLabels[origin]}</option>)}
        </select>
      </label>
      <label>
        Ordenar por data
        <select value={filters.order} onChange={(event) => {
          onChange({ ...filters, order: event.target.value === 'oldest' ? 'oldest' : 'newest' })
        }}>
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigas</option>
        </select>
      </label>
      {hasFilters && <button type="button" className="text-link" onClick={onClear}>Limpar filtros</button>}
    </div>
  )
}
