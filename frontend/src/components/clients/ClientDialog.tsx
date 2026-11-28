import { useCallback, useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getClient } from '../../services/clients'
import { HttpError } from '../../services/http'
import type { Client } from '../../types/client'
import { DataState } from '../ui/DataState'
import { Modal } from '../ui/Modal'
import { ClientDetails } from './ClientDetails'
import { ClientForm } from './ClientForm'

export type ClientSelection = { mode: 'create' } | { mode: 'view' | 'edit'; id: string }

interface ClientDialogProps {
  selection: ClientSelection
  onEdit: (id: string) => void
  onDismiss: () => void
  onSaved: (client: Client) => void
}

const titles = {
  create: 'Novo cliente',
  edit: 'Editar cliente',
  view: 'Detalhes do cliente',
}

export function ClientDialog({ selection, onEdit, onDismiss, onSaved }: ClientDialogProps) {
  const [saving, setSaving] = useState(false)
  const formProps = { saving, onSaving: setSaving, onCancel: onDismiss, onSaved }

  return (
    <Modal title={titles[selection.mode]} saving={saving} onDismiss={onDismiss}>
      {selection.mode === 'create' ? (
        <ClientForm {...formProps} />
      ) : (
        <ClientRecord id={selection.id} editing={selection.mode === 'edit'}
          onEdit={() => onEdit(selection.id)} {...formProps} />
      )}
    </Modal>
  )
}

function ClientRecord({ id, editing, onEdit, ...formProps }: Omit<Parameters<typeof ClientForm>[0], 'client'> & {
  id: string
  editing: boolean
  onEdit: () => void
}) {
  const load = useCallback((signal: AbortSignal) => getClient(id, signal), [id])
  const { result, retry } = useAsyncData(load)

  if (result.status === 'loading') return <DataState status="loading" message="Carregando cadastro…" />
  if (result.status === 'error') {
    if (result.error instanceof HttpError && result.error.status === 404) {
      return <p className="state-box" role="alert">Cliente não encontrado. Volte à lista para consultar outro cadastro.</p>
    }
    return <DataState status="error" message="Não foi possível carregar o cadastro." onRetry={retry} />
  }

  return editing ? <ClientForm client={result.data} {...formProps} /> : <ClientDetails client={result.data} onEdit={onEdit} />
}
