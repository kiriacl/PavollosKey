import { useState } from 'react'
import { OperationForm } from '../../components/ui/OperationForm'
import { ReadResult } from '../../components/ui/ReadResult'
import { usePanelContext } from '../../hooks/usePanelContext'
import { useProfile } from '../../hooks/useProfile'
import { roleLabels } from '../../services/auth'
import { linkCollaborator } from '../../services/operations'

export function SettingsPage() {
  const profile = useProfile()
  const query = usePanelContext()
  const [notice, setNotice] = useState('')
  if (!profile) return null
  return (
    <div className="operation-grid">
      <section className="dashboard-card operation-card">
        <h2>Estabelecimento e acesso</h2>
        <ReadResult query={query} name="o estabelecimento">
          {(panel) => <p>{panel.estabelecimento}</p>}
        </ReadResult>
        <p>{profile.nome} · {roleLabels[profile.papel]}</p>
      </section>
      {profile.papel === 'proprietario' && (
        <section className="dashboard-card operation-card">
          <h2>Vincular colaborador</h2>
          <p>Use o UUID de uma conta já convidada e confirmada no Supabase Auth.</p>
          <OperationForm label="Vincular perfil" onSuccess={() => setNotice('Perfil vinculado com sucesso.')} run={async (data) => {
            setNotice('')
            await linkCollaborator(String(data.get('usuario_id')).trim(), String(data.get('nome')).trim(),
              data.get('papel') as 'auxiliar' | 'tecnico')
          }}>
            <label>UUID da conta<input name="usuario_id" pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" required /></label>
            <label>Nome<input name="nome" maxLength={120} required /></label>
            <label>Papel<select name="papel"><option value="auxiliar">Auxiliar</option><option value="tecnico">Técnico</option></select></label>
          </OperationForm>
          <p role="status">{notice}</p>
        </section>
      )}
    </div>
  )
}
