import type { ChangeEvent, ComponentPropsWithoutRef } from 'react'
import type { ClientFieldName } from '../../types/client'
import { clientFieldId, digitsOnly } from './clientFormat'

function cursorAfterDigits(value: string, count: number) {
  let index = 0
  while (index < value.length && count > 0) {
    if (/\d/.test(value[index])) count -= 1
    index += 1
  }
  return index
}

interface ClientFieldProps extends Omit<ComponentPropsWithoutRef<'input'>, 'name' | 'onChange' | 'value'> {
  name: ClientFieldName
  label: string
  value: string
  error?: string
  mask?: (value: string) => string
  multiline?: boolean
  onChange: (value: string) => void
}

export function ClientField({ name, label, value, error, mask, multiline, onChange, ...inputProps }: ClientFieldProps) {
  const id = clientFieldId(name)
  const attributes = {
    id,
    name,
    value,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  }

  function changeInput(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    if (!mask) {
      onChange(input.value)
      return
    }

    const raw = input.value
    let digits = digitsOnly(raw)
    let beforeCursor = digitsOnly(raw.slice(0, input.selectionStart ?? raw.length)).length
    const direction = (event.nativeEvent as InputEvent).inputType

    // Ao apagar só um separador, remova o dígito na direção escolhida pelo usuário.
    if (raw.length < value.length && digits === digitsOnly(value)) {
      const index = direction === 'deleteContentBackward' ? beforeCursor - 1 : beforeCursor
      if ((direction === 'deleteContentBackward' || direction === 'deleteContentForward') && index >= 0) {
        digits = digits.slice(0, index) + digits.slice(index + 1)
        if (direction === 'deleteContentBackward') beforeCursor = index
      }
    }

    const formatted = mask(digits)
    const cursor = cursorAfterDigits(formatted, beforeCursor)
    input.value = formatted
    input.setSelectionRange(cursor, cursor)
    onChange(formatted)
  }

  return (
    <div className="client-field">
      <label htmlFor={id}>{label}{inputProps.required && <span aria-hidden="true"> *</span>}</label>
      {multiline ? (
        <textarea {...attributes} rows={4} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...inputProps} {...attributes} onChange={changeInput} />
      )}
      {error && <p id={`${id}-error`} className="client-field-error">{error}</p>}
    </div>
  )
}
