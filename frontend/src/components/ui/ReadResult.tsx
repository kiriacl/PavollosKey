import type { ReactNode } from 'react'
import type { useAsyncData } from '../../hooks/useAsyncData'
import { apiErrorMessage } from '../../services/http'
import { DataState } from './DataState'

export function ReadResult<T>({ query, name, children }: {
  query: ReturnType<typeof useAsyncData<T>>
  name: string
  children: (data: T) => ReactNode
}) {
  const { result, retry } = query
  if (result.status === 'loading') return <DataState status="loading" message={`Carregando ${name}…`} />
  if (result.status === 'error') {
    return <DataState status="error" message={apiErrorMessage(result.error, `Não foi possível carregar ${name}.`)} onRetry={retry} />
  }
  return children(result.data)
}
