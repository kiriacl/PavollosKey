import type { ReactNode } from 'react'
import type { RequestFieldName } from '../../hooks/useRequestWrite'

interface InputAttributes {
  id: string
  name: string
  required?: boolean
  'aria-invalid'?: true
  'aria-describedby'?: string
}

interface RequestFieldProps {
  name: RequestFieldName
  label: string
  required?: boolean
  error?: string
  children: (attributes: InputAttributes) => ReactNode
}

export function RequestField({ name, label, required, error, children }: RequestFieldProps) {
  const id = `request-field-${name}`

  return (
    <div className="request-field">
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {children({
        id, name, required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${id}-error` : undefined,
      })}
      {error && <p id={`${id}-error`} className="request-field-error">{error}</p>}
    </div>
  )
}
