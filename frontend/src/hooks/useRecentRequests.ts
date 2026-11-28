import { useState } from 'react'
import type { DashboardRequest } from '../types/dashboard'
import type { RequestStatus } from '../types/request'

type StatusFilter = RequestStatus | 'all'
const pageSize = 6

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('pt-BR')
}

export function useRecentRequests(requests: DashboardRequest[]) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const normalizedQuery = normalizeName(query)
  const filtered = requests.filter((request) =>
    (status === 'all' || request.status === status)
    && normalizeName(request.cliente).includes(normalizedQuery),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize

  function changeQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function changeStatus(value: StatusFilter) {
    setStatus(value)
    setPage(1)
  }

  function clearFilters() {
    setQuery('')
    setStatus('all')
    setPage(1)
  }

  return {
    query,
    status,
    hasFilters: query !== '' || status !== 'all',
    page: currentPage,
    pageCount,
    total: filtered.length,
    visibleRequests: filtered.slice(start, start + pageSize),
    changeQuery,
    changeStatus,
    clearFilters,
    setPage,
  }
}
