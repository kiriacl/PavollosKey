import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { apiErrorMessage, HttpError } from '../../services/http'

export function OperationForm({ label, run, onSuccess, onBusy, children }: {
  label: string
  run: (data: FormData) => Promise<void>
  onSuccess?: () => void
  onBusy?: (busy: boolean) => void
  children?: ReactNode
}) {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    inFlight.current = true
    setBusy(true)
    onBusy?.(true)
    setError('')
    try {
      await run(data)
      form.reset()
      onSuccess?.()
    } catch (problem) {
      const message = apiErrorMessage(problem, 'Não foi possível confirmar a operação. Confira os registros antes de tentar novamente.')
      setError(problem instanceof HttpError && problem.status === 409
        ? `${message} Consulte os dados atualizados antes de tentar novamente.` : message)
    } finally {
      inFlight.current = false
      setBusy(false)
      onBusy?.(false)
    }
  }

  return (
    <form className="operation-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        {children}
        <button className="button button-primary" type="submit">{busy ? 'Salvando…' : label}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
