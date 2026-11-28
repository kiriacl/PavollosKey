import { useRef, useState } from 'react'
import { ClientDialog, type ClientSelection } from '../../components/clients/ClientDialog'
import { ClientTable } from '../../components/clients/ClientTable'
import { DataState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { useClients } from '../../hooks/useClients'
import { usingMocks } from '../../services/http'
import type { Client } from '../../types/client'
import './clients.css'

export function ClientsPage() {
  const clients = useClients()
  const [selection, setSelection] = useState<ClientSelection | null>(null)
  const [notice, setNotice] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const newClientRef = useRef<HTMLButtonElement>(null)
  const listTitleRef = useRef<HTMLHeadingElement>(null)

  function open(selection: ClientSelection) {
    setNotice('')
    setSelection(selection)
  }

  function saved(client: Client) {
    const created = selection?.mode === 'create'
    clients.saveToList(client, created)
    setNotice(created ? `Cliente ${client.nome} cadastrado com sucesso.` : `Cadastro de ${client.nome} atualizado com sucesso.`)
    setSelection(null)

    // O filtro pode ocultar o contato editado, removendo o botão que abriu o diálogo.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) newClientRef.current?.focus({ preventScroll: true })
    })
  }

  function changePage(page: number) {
    if (clients.goToPage(page)) listTitleRef.current?.focus()
  }

  const total = clients.total === 1 ? '1 cliente cadastrado' : `${clients.total} clientes cadastrados`
  const results = clients.matchedTotal === 1 ? '1 resultado' : `${clients.matchedTotal} resultados`
  let listMessage = clients.search ? results : ''
  if (clients.total === 0) listMessage = 'Nenhum cliente cadastrado. Use Novo cliente para adicionar um contato.'
  else if (clients.matchedTotal === 0) listMessage = 'Nenhum cliente corresponde à pesquisa.'
  else if (clients.lastPage > 1) listMessage = `${results} · Página ${clients.page} de ${clients.lastPage}`

  return (
    <div className="clients-page">
      <div className="panel-intro clients-intro">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>Clientes</h1>
          {usingMocks && <p className="client-note">As alterações da demonstração são descartadas ao recarregar a página.</p>}
        </div>
        <button
          ref={newClientRef}
          type="button"
          className="button button-primary"
          disabled={clients.status !== 'ready'}
          onClick={() => open({ mode: 'create' })}
        >
          <Icon name="plus" size={19} /> Novo cliente
        </button>
      </div>

      <p className={notice ? 'form-notice' : 'sr-only'} role="status">{notice}</p>

      {clients.status === 'loading' && <DataState status="loading" message="Carregando os clientes…" />}
      {clients.status === 'error' && (
        <DataState
          status="error"
          message="Não foi possível carregar a lista de clientes. Confira a conexão."
          onRetry={() => {
            headingRef.current?.focus()
            clients.retry()
          }}
        />
      )}
      {clients.status === 'ready' && (
        <section className="clients-list" aria-labelledby="client-list-title">
          <div className="clients-list-tools">
            <h2 id="client-list-title" ref={listTitleRef} tabIndex={-1}>{total}</h2>
            {clients.total > 0 && (
              <label className="client-search">
                Nome ou telefone
                <span>
                  <Icon name="search" size={18} />
                  <input type="search" ref={searchRef} value={clients.search}
                    onChange={(event) => clients.changeSearch(event.target.value)} />
                </span>
              </label>
            )}
          </div>
          {clients.items.length > 0 && (
            <ClientTable clients={clients.items} onView={(id) => open({ mode: 'view', id })}
              onEdit={(id) => open({ mode: 'edit', id })} />
          )}
          <div className={listMessage ? 'clients-list-footer' : 'sr-only'}>
            <p className="client-note" role="status">{listMessage}</p>
            {clients.total > 0 && clients.matchedTotal === 0 && (
              <button className="text-link" type="button" onClick={() => {
                clients.changeSearch('')
                searchRef.current?.focus()
              }}>Limpar pesquisa</button>
            )}
            {clients.lastPage > 1 && (
              <nav className="clients-pagination" aria-label="Páginas de clientes">
                <button type="button" className="clients-secondary" aria-disabled={clients.page === 1}
                  onClick={() => changePage(clients.page - 1)}>Anterior</button>
                <button type="button" className="clients-secondary" aria-disabled={clients.page === clients.lastPage}
                  onClick={() => changePage(clients.page + 1)}>Próxima</button>
              </nav>
            )}
          </div>
        </section>
      )}

      {selection && (
        <ClientDialog selection={selection} onSaved={saved} onDismiss={() => setSelection(null)}
          onEdit={(id) => setSelection({ mode: 'edit', id })} />
      )}
    </div>
  )
}
