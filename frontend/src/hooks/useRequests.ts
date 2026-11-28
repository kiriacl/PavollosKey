import { useMemo, useState } from 'react'
import { listClients } from '../services/clients'
import { listRequests } from '../services/requests'
import { usingMocks } from '../services/http'
import type { RequestOrigin, RequestStatus, ServiceRequest } from '../types/request'
import { useAsyncData } from './useAsyncData'

const pageSize = 6
const initialFilters = { text: '', status: '', origin: '', order: 'newest' } satisfies RequestFilters

export interface RequestFilters {
  text: string
  status: RequestStatus | ''
  origin: RequestOrigin | ''
  order: 'newest' | 'oldest'
}

async function loadRequests(signal: AbortSignal) {
  const [requests, clients] = await Promise.all([listRequests(signal), listClients(signal)])
  return {
    requests,
    clients: new Map(clients.map((client) => [client.id, client])),
  }
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('pt-BR')
}

function compareDate(first: ServiceRequest, second: ServiceRequest) {
  return first.dataSolicitacao.localeCompare(second.dataSolicitacao)
    || Date.parse(first.criadoEm) - Date.parse(second.criadoEm)
    || first.id.localeCompare(second.id, 'pt-BR', { numeric: true })
}

export function useRequests() {
  const { result, retry, updateData } = useAsyncData(loadRequests)
  const [filters, setFilters] = useState<RequestFilters>(initialFilters)
  const [requestedPage, setRequestedPage] = useState(1)
  const data = result.status === 'ready' ? result.data : undefined

  const filtered = useMemo(() => {
    if (!data) return []
    const query = normalize(filters.text)
    const direction = filters.order === 'newest' ? -1 : 1
    return data.requests.filter((request) => {
      const clientName = data.clients.get(request.clienteId)?.nome ?? ''
      return (!filters.status || request.status === filters.status)
        && (!filters.origin || request.origem === filters.origin)
        && normalize(`${clientName} ${usingMocks ? request.tipoServico : request.descricao}`).includes(query)
    }).sort((first, second) => direction * compareDate(first, second))
  }, [data, filters])

  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(requestedPage, lastPage)

  function changeFilters(next: RequestFilters) {
    setFilters(next)
    setRequestedPage(1)
  }

  function goToPage(next: number) {
    if (next < 1 || next > lastPage) return false
    setRequestedPage(next)
    return true
  }

  function saveToList(request: ServiceRequest) {
    updateData((current) => ({
      ...current,
      requests: current.requests.some(({ id }) => id === request.id)
        ? current.requests.map((item) => item.id === request.id ? request : item)
        : [request, ...current.requests],
    }))
  }

  return {
    result, retry, filters, changeFilters, goToPage, saveToList, page, lastPage,
    clearFilters: () => changeFilters(initialFilters),
    hasFilters: filters.text !== '' || filters.status !== '' || filters.origin !== '' || filters.order !== 'newest',
    matchedTotal: filtered.length,
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
  }
}
