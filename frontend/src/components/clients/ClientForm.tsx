import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { createClient, updateClient } from '../../services/clients'
import { usingMocks } from '../../services/http'
import { emptyClient, type Client, type ClientAddress, type ClientFieldErrors, type ClientFieldName, type ClientInput } from '../../types/client'
import { ClientField } from './ClientField'
import { clientFieldId, editClientValues, formatCep, formatPhone, normalizeClientInput, readSaveError, validateClient } from './clientFormat'

const addressFields = [
  { name: 'logradouro', label: 'Logradouro', autoComplete: 'address-line1' },
  { name: 'numero', label: 'Número' },
  { name: 'complemento', label: 'Complemento', autoComplete: 'address-line2' },
  { name: 'bairro', label: 'Bairro', autoComplete: 'address-level3' },
  { name: 'cidade', label: 'Cidade', autoComplete: 'address-level2' },
  { name: 'estado', label: 'Estado', autoComplete: 'address-level1' },
] satisfies { name: keyof ClientAddress; label: string; autoComplete?: string }[]

interface ClientFormProps {
  client?: Client
  saving: boolean
  onSaving: (saving: boolean) => void
  onSaved: (client: Client) => void
  onCancel: () => void
}

export function ClientForm({ client, saving, onSaving, onSaved, onCancel }: ClientFormProps) {
  const [values, setValues] = useState(() => editClientValues(client ?? emptyClient))
  const [errors, setErrors] = useState<ClientFieldErrors>({})
  const [message, setMessage] = useState('')
  const inFlight = useRef(false)
  const focusError = useRef(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    if (!focusError.current) return
    focusError.current = false
    const first = Object.keys(errors)[0] as ClientFieldName | undefined
    if (first) document.getElementById(clientFieldId(first))?.focus()
    else summaryRef.current?.focus()
  }, [errors])

  function clearFieldError(field: ClientFieldName) {
    if (!errors[field]) return

    const remaining = { ...errors }
    delete remaining[field]
    setErrors(remaining)
    if (Object.keys(remaining).length === 0) setMessage('')
  }

  function setContact(field: keyof Omit<ClientInput, 'endereco'>, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    clearFieldError(field)
  }

  function setAddress(field: keyof ClientAddress, value: string) {
    setValues((current) => ({ ...current, endereco: { ...current.endereco, [field]: value } }))
    clearFieldError(`endereco.${field}`)
  }

  function showErrors(fieldErrors: ClientFieldErrors, feedback: string) {
    focusError.current = true
    setErrors(fieldErrors)
    setMessage(feedback)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return

    const formData = new FormData(event.currentTarget)
    const input = normalizeClientInput({
      ...values,
      nome: String(formData.get('nome') ?? ''),
      telefone: String(formData.get('telefone') ?? ''),
      email: String(formData.get('email') ?? ''),
    })
    const fieldErrors = validateClient(input)
    if (Object.keys(fieldErrors).length > 0) {
      showErrors(fieldErrors, 'Revise os campos destacados.')
      return
    }

    inFlight.current = true
    onSaving(true)
    setErrors({})
    setMessage('')
    try {
      const saved = client ? await updateClient(client.id, input) : await createClient(input)
      onSaved(saved)
    } catch (error) {
      const feedback = readSaveError(error)
      showErrors(feedback.fieldErrors, feedback.message)
    } finally {
      inFlight.current = false
      onSaving(false)
    }
  }

  return (
    <form className="client-form" noValidate onSubmit={submit}>
      <p className="client-note">{usingMocks ? 'Nome completo e telefone são obrigatórios.' : 'Informe o nome completo. Telefone e e-mail são opcionais.'}</p>
      <fieldset disabled={saving}>
        <legend>Dados de contato</legend>
        <div className="client-form-grid">
          <ClientField
            name="nome"
            label="Nome completo"
            autoComplete="name"
            required
            value={values.nome}
            error={errors.nome}
            onChange={(value) => setContact('nome', value)}
          />
          <ClientField
            name="telefone"
            label="Telefone"
            type="tel"
            autoComplete="tel-national"
            required={usingMocks}
            value={values.telefone}
            error={errors.telefone}
            mask={usingMocks ? formatPhone : undefined}
            onChange={(value) => setContact('telefone', value)}
          />
          {usingMocks && <ClientField
            name="whatsapp"
            label="WhatsApp"
            type="tel"
            autoComplete="off"
            value={values.whatsapp}
            error={errors.whatsapp}
            mask={formatPhone}
            onChange={(value) => setContact('whatsapp', value)}
          />}
          <ClientField
            name="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={values.email}
            error={errors.email}
            onChange={(value) => setContact('email', value)}
          />
        </div>
      </fieldset>

      {usingMocks && <fieldset disabled={saving}>
        <legend>Endereço</legend>
        <div className="client-form-grid">
          <ClientField
            name="endereco.cep"
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            value={values.endereco.cep}
            error={errors['endereco.cep']}
            mask={formatCep}
            onChange={(value) => setAddress('cep', value)}
          />
          {addressFields.map(({ name, label, autoComplete }) => (
            <ClientField
              key={name}
              name={`endereco.${name}`}
              label={label}
              autoComplete={autoComplete}
              value={values.endereco[name]}
              error={errors[`endereco.${name}`]}
              onChange={(value) => setAddress(name, value)}
            />
          ))}
        </div>
      </fieldset>}

      {usingMocks && <fieldset disabled={saving}>
        <ClientField
          name="observacoes"
          label="Observações"
          multiline
          value={values.observacoes}
          error={errors.observacoes}
          onChange={(value) => setContact('observacoes', value)}
        />
      </fieldset>}

      {message && <p ref={summaryRef} tabIndex={-1} role="alert" className="form-error">{message}</p>}
      <p className="sr-only" role="status">{saving ? 'Salvando cadastro…' : ''}</p>
      <div className="client-dialog-actions">
        <button type="button" className="button clients-secondary" disabled={saving} onClick={onCancel}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar cliente'}
        </button>
      </div>
    </form>
  )
}
