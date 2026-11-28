import { useState } from 'react'
import { listClients } from '../services/clients'
import type { Client } from '../types/client'
import { useAsyncData } from './useAsyncData'

const pageSize = 6

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('pt-BR')
}

export function useClients() {
  const { result, retry, updateData } = useAsyncData(listClients)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const clients = result.status === 'ready' ? result.data : []
  const nameQuery = normalizeName(search)
  const phoneQuery = /^[\d\s()+.-]+$/.test(nameQuery) ? nameQuery.replace(/\D/g, '') : ''
  const matching = clients.filter(({ nome, telefone, whatsapp }) =>
    normalizeName(nome).includes(nameQuery)
    || (phoneQuery && [telefone, whatsapp].some((phone) => phone.replace(/\D/g, '').includes(phoneQuery))),
  )
  const lastPage = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(page, lastPage)
  const offset = (currentPage - 1) * pageSize

  function changeSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function goToPage(value: number) {
    if (value < 1 || value > lastPage) return false
    setPage(value)
    return true
  }

  function saveToList(client: Client, created: boolean) {
    updateData((records) => {
      if (records.some(({ id }) => id === client.id)) {
        return records.map((record) => record.id === client.id ? client : record)
      }
      return [client, ...records]
    })
    if (created) changeSearch('')
  }

  return {
    status: result.status,
    retry,
    search,
    changeSearch,
    total: clients.length,
    matchedTotal: matching.length,
    page: currentPage,
    lastPage,
    goToPage,
    items: matching.slice(offset, offset + pageSize),
    saveToList,
  }
}
