import { useCallback, useState } from 'react'
import { RequestStatusBadge } from '../../components/requests/RequestStatusBadge'
import { OperationForm } from '../../components/ui/OperationForm'
import { ReadResult } from '../../components/ui/ReadResult'
import { useAsyncData } from '../../hooks/useAsyncData'
import { listClients } from '../../services/clients'
import {
  addBudgetItem, budgetStatusLabels, createBudget, createOrder, createQuote, getBudget, listBudgets,
  listQuotes, updateBudgetStatus, type Budget, type BudgetItem, type Channel, type Quote,
} from '../../services/operations'
import { listRequests } from '../../services/requests'
import type { RequestStatus } from '../../types/request'
import { formatTimestamp } from '../../utils/dates'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

async function loadRequests(signal: AbortSignal) {
  const [requests, clients] = await Promise.all([listRequests(signal), listClients(signal)])
  const names = new Map(clients.map(({ id, nome }) => [id, nome]))
  return requests.map((request) => ({ ...request, cliente: names.get(request.clienteId) }))
}

type BudgetSelection = { atendimento?: string; cotacao?: string; orcamento?: string }

export function BudgetsPage({ selection }: { selection?: BudgetSelection }) {
  const query = useAsyncData(loadRequests)
  const [requestId, setRequestId] = useState(selection?.atendimento ?? '')
  return (
    <div className="operation-grid">
      <section className="dashboard-card operation-card">
        <ReadResult query={query} name="os atendimentos">
          {(requests) => requests.length ? (
            <label className="operation-select">Atendimento
              <select value={requestId} onChange={(event) => setRequestId(event.target.value)}>
                <option value="">Selecione um atendimento</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>{request.cliente ?? 'Cliente'} · {request.descricao}</option>
                ))}
              </select>
            </label>
          ) : <p>Nenhum atendimento disponível para cotação.</p>}
        </ReadResult>
      </section>
      {query.result.status === 'ready' && query.result.data.map((request) => request.id === requestId && (
        <Quotes key={request.id} requestId={request.id} open={request.status === 'pendente'} status={request.status}
          selection={request.id === selection?.atendimento ? selection : undefined} />
      ))}
    </div>
  )
}

function Quotes({ requestId, open, status, selection }: { requestId: string; open: boolean; status: RequestStatus; selection?: BudgetSelection }) {
  const load = useCallback((signal: AbortSignal) => listQuotes(requestId, signal), [requestId])
  const query = useAsyncData(load)
  const [quoteId, setQuoteId] = useState(selection?.cotacao ?? '')
  const [notice, setNotice] = useState('')
  return (
    <>
      <section className="dashboard-card operation-card">
        <h2>Cotações <RequestStatusBadge status={status} /></h2>
        <p role="status">{notice}</p>
        <ReadResult query={query} name="as cotações">
          {(quotes) => (
            <>
              {quotes.length ? (
                <label className="operation-select">Cotação
                  <select value={quoteId} onChange={(event) => setQuoteId(event.target.value)}>
                    <option value="">Selecione uma cotação</option>
                    {quotes.map((quote) => (
                      <option key={quote.id} value={quote.id}>{quote.tipo === 'inicial' ? 'Inicial' : 'Complementar'} · {formatTimestamp(quote.criado_em)}</option>
                    ))}
                  </select>
                </label>
              ) : <p>Nenhuma cotação cadastrada.</p>}
              {open && <details>
                <summary>Nova cotação</summary>
                <OperationForm label="Criar cotação" run={async (data) => {
                  const quote = await createQuote(requestId, data.get('tipo') as Quote['tipo'])
                  setQuoteId(quote.id)
                }} onSuccess={() => { setNotice('Cotação criada.'); query.retry() }}>
                  <label>Tipo
                    <select name="tipo" defaultValue="inicial">
                      <option value="inicial">Inicial</option>
                      <option value="complementar">Complementar</option>
                    </select>
                  </label>
                </OperationForm>
              </details>}
            </>
          )}
        </ReadResult>
      </section>
      {quoteId && query.result.status === 'ready' && query.result.data.some(({ id }) => id === quoteId)
        && <BudgetVersions key={quoteId} quoteId={quoteId} open={open}
          initialBudget={quoteId === selection?.cotacao ? selection?.orcamento : undefined} />}
    </>
  )
}

function readItem(data: FormData): Omit<BudgetItem, 'id'> {
  return { escopo: String(data.get('escopo')).trim(), valor: Number(data.get('valor')) }
}

function ItemFields() {
  return (
    <>
      <label>Escopo<textarea name="escopo" maxLength={1000} required /></label>
      <label>Valor (R$)<input type="number" name="valor" min="0" max="9999999999.99" step="0.01" required /></label>
    </>
  )
}

function BudgetVersions({ quoteId, open, initialBudget = '' }: { quoteId: string; open: boolean; initialBudget?: string }) {
  const load = useCallback((signal: AbortSignal) => listBudgets(quoteId, signal), [quoteId])
  const query = useAsyncData(load)
  const [budgetId, setBudgetId] = useState(initialBudget)
  const [notice, setNotice] = useState('')
  return (
    <>
      <section className="dashboard-card operation-card">
        <h2>Versões de orçamento</h2>
        <p role="status">{notice}</p>
        <ReadResult query={query} name="os orçamentos">
          {(budgets) => budgets.length ? (
            <label className="operation-select">Orçamento
              <select value={budgetId} onChange={(event) => setBudgetId(event.target.value)}>
                <option value="">Selecione uma versão</option>
                {budgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    Versão {budget.versao} · {budgetStatusLabels[budget.status]} · {currency.format(budget.total)}
                  </option>
                ))}
              </select>
            </label>
          ) : <p>Nenhuma versão cadastrada.</p>}
        </ReadResult>
        {open && <details>
          <summary>Novo orçamento</summary>
          <OperationForm label="Criar versão" run={async (data) => {
            const validity = String(data.get('validade'))
            const budget = await createBudget(quoteId, {
              validade_ate: validity ? new Date(validity).toISOString() : null,
              itens: [readItem(data)],
            })
            setBudgetId(budget.id)
          }} onSuccess={() => { setNotice('Versão criada.'); query.retry() }}>
            <label>Validade no horário deste dispositivo<input type="datetime-local" name="validade" /></label>
            <ItemFields />
          </OperationForm>
        </details>}
      </section>
      {budgetId && query.result.status === 'ready' && query.result.data.some(({ id }) => id === budgetId)
      && <BudgetDetails key={budgetId} id={budgetId} open={open} onChange={(saved) => {
        query.updateData((budgets) => budgets.map((budget) => budget.id === saved.id ? saved : budget))
      }} />}
    </>
  )
}

function BudgetDetails({ id, open, onChange }: { id: string; open: boolean; onChange: (budget: Budget) => void }) {
  const load = useCallback((signal: AbortSignal) => getBudget(id, signal), [id])
  const query = useAsyncData(load)
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)

  function save(budget: Budget) {
    query.updateData(() => budget)
    onChange(budget)
    setRevision((current) => current + 1)
  }

  return (
    <section className="dashboard-card operation-card">
      <h2>Detalhes do orçamento</h2>
      <p role="status">{notice}</p>
      <ReadResult query={query} name="o orçamento">
        {(budget) => (
          <>
            <p>{budgetStatusLabels[budget.status]} · {currency.format(budget.total)}</p>
            <p>{budget.validade_ate ? `Válido até ${formatTimestamp(budget.validade_ate)}` : 'Sem validade informada'}</p>
            {budget.evidencia_aceite && <p>Decisão por {budget.canal_aceite === 'whatsapp' ? 'WhatsApp' : 'atendimento presencial'} · {budget.evidencia_aceite}</p>}
            {budget.itens.length ? (
              <ul className="operation-list">
                {budget.itens.map((item) => (
                  <li key={item.id}>
                    <strong>{item.escopo}</strong> · {currency.format(item.valor)}
                    {open && budget.status === 'aprovado' && <CreateOrder itemId={item.id} />}
                  </li>
                ))}
              </ul>
            ) : <p>Nenhum item incluído.</p>}
            <div key={revision}>
              {open && budget.status === 'rascunho' && (
                <>
                  <OperationForm label="Adicionar item" run={async (data) => {
                    await addBudgetItem(id, readItem(data))
                    const current = await getBudget(id, new AbortController().signal).catch(() => null)
                    if (current) save(current)
                    else query.retry()
                    setNotice('Item adicionado.')
                  }}><ItemFields /></OperationForm>
                  {budget.itens.length > 0 && <OperationForm label="Registrar envio" run={async () => {
                    save(await updateBudgetStatus(id, 'enviar'))
                    setNotice('Envio registrado.')
                  }} />}
                </>
              )}
              {open && budget.status === 'enviado' && (
                <>
                  <p>Registre a decisão depois de receber a resposta do cliente.</p>
                  <OperationForm label="Registrar decisão" run={async (data) => {
                    save(await updateBudgetStatus(id, data.get('decisao') as 'aprovar' | 'recusar', {
                      canal_aceite: data.get('canal') as Channel, evidencia_aceite: String(data.get('evidencia')).trim(),
                    }))
                    setNotice('Decisão registrada.')
                  }}>
                    <label>Decisão<select name="decisao"><option value="aprovar">Aprovar</option><option value="recusar">Recusar</option></select></label>
                    <label>Canal<select name="canal"><option value="presencial">Presencial</option><option value="whatsapp">WhatsApp</option></select></label>
                    <label>Evidência<textarea name="evidencia" maxLength={2000} required /></label>
                  </OperationForm>
                  <OperationForm label="Registrar expiração" run={async () => {
                    save(await updateBudgetStatus(id, 'expirar'))
                    setNotice('Expiração registrada.')
                  }} />
                </>
              )}
            </div>
            <button type="button" className="text-link" onClick={query.retry}>Atualizar orçamento</button>
          </>
        )}
      </ReadResult>
    </section>
  )
}

function CreateOrder({ itemId }: { itemId: string }) {
  const [orderId, setOrderId] = useState('')
  return (
    <details>
      <summary>Gerar ordem de serviço</summary>
      <OperationForm label="Gerar ou recuperar ordem" run={async (data) => {
        const order = await createOrder(itemId, String(data.get('local')).trim() || null)
        setOrderId(order.id)
      }}>
        <label>Local de execução<input name="local" maxLength={500} /></label>
      </OperationForm>
      {orderId && <p role="status">Ordem disponível em <a className="text-link" href="#/painel/servicos">Serviços</a> · {orderId}</p>}
    </details>
  )
}
