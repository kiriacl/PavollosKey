import { useCallback, useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { HttpError } from '../../services/http'
import { getRequest } from '../../services/requests'
import type { Client } from '../../types/client'
import type { ServiceRequest } from '../../types/request'
import { DataState } from '../ui/DataState'
import { Modal } from '../ui/Modal'
import { RequestDetails } from './RequestDetails'
import { RequestForm } from './RequestForm'

export type RequestSelection = { mode: 'create' } | { mode: 'view' | 'edit'; id: string }

interface RequestDialogProps {
  selection: RequestSelection
  clients: ReadonlyMap<string, Client>
  onDismiss: () => void
  onEdit: (id: string) => void
  onSaved: (request: ServiceRequest) => void
  onStatusSaved: (request: ServiceRequest) => void
}

const titles = { create: 'Nova solicitação', edit: 'Editar solicitação', view: 'Detalhes da solicitação' }

export function RequestDialog({ selection, clients, onDismiss, onEdit, onSaved, onStatusSaved }: RequestDialogProps) {
  const [saving, setSaving] = useState(false)
  const formProps = { clients, saving, onSaving: setSaving, onCancel: onDismiss, onSaved }

  return (
    <Modal title={titles[selection.mode]} saving={saving} onDismiss={onDismiss}>
      {selection.mode === 'create' ? <RequestForm {...formProps} /> : (
        <RequestRecord
          key={selection.id}
          id={selection.id}
          editing={selection.mode === 'edit'}
          onEdit={() => onEdit(selection.id)}
          onStatusSaved={onStatusSaved}
          {...formProps}
        />
      )}
    </Modal>
  )
}

function RequestRecord({ id, editing, onEdit, onStatusSaved, ...formProps }: Omit<Parameters<typeof RequestForm>[0], 'request'> & {
  id: string
  editing: boolean
  onEdit: () => void
  onStatusSaved: (request: ServiceRequest) => void
}) {
  const load = useCallback((signal: AbortSignal) => getRequest(id, signal), [id])
  const { result, retry } = useAsyncData(load)

  if (result.status === 'loading') return <DataState status="loading" message="Carregando solicitação…" />
  if (result.status === 'error') {
    if (result.error instanceof HttpError && result.error.status === 404) {
      return <p className="state-box" role="alert">Solicitação não encontrada. Volte à lista para consultar outro registro.</p>
    }
    return <DataState status="error" message="Não foi possível carregar a solicitação." onRetry={retry} />
  }

  const request = result.data
  if (editing) return <RequestForm request={request} {...formProps} />
  return (
    <RequestDetails request={request} client={formProps.clients.get(request.clienteId)} saving={formProps.saving}
      onSaving={formProps.onSaving} onEdit={onEdit} onStatusSaved={onStatusSaved} onReload={retry} />
  )
}
