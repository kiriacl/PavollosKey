import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { HttpError } from '../services/http'
import type { RequestInput, ServiceRequest } from '../types/request'

export type RequestFieldName = keyof RequestInput | 'status'
export type RequestFieldErrors = Partial<Record<RequestFieldName, string>>
const fieldNames: RequestFieldName[] = ['clienteId', 'tipoServico', 'descricao', 'origem', 'dataSolicitacao', 'endereco', 'observacoes', 'status']

interface WriteProblem {
  message: string
  fields: RequestFieldErrors
}

function readWriteError(error: unknown): WriteProblem {
  const fields: RequestFieldErrors = {}
  if (error instanceof HttpError) {
    if (error.status === 404) return { message: 'Esta solicitação não foi encontrada.', fields }
    if (error.status === 409) return { message: 'O servidor sinalizou um conflito nesta solicitação.', fields }
    if (error.status === 400 || error.status === 422) {
      const body = error.body
      if (typeof body === 'object' && body !== null && 'erros' in body && typeof body.erros === 'object' && body.erros !== null) {
        const submittedErrors = body.erros as Record<string, unknown>
        for (const field of fieldNames) {
          const message = submittedErrors[field]
          if (typeof message === 'string' && message.trim()) fields[field] = message
        }
      }
      return { message: 'message' in (body && typeof body === 'object' ? body : {}) ? error.message
        : 'O servidor não aceitou os dados. Revise os campos e tente novamente.', fields }
    }
  }

  return { message: 'Não foi possível confirmar o salvamento. Confira a conexão e a listagem antes de reenviar.', fields }
}

export function useRequestWrite(
  formRef: RefObject<HTMLFormElement | null>, onSaving: (value: boolean) => void, onSaved: (request: ServiceRequest) => void,
) {
  const pending = useRef(false)
  const focusProblem = useRef(false)
  const [problem, setProblem] = useState<WriteProblem | null>(null)

  useLayoutEffect(() => {
    if (!focusProblem.current || !problem) return
    focusProblem.current = false
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.focus()
  }, [formRef, problem])

  function reportProblem(next: WriteProblem) {
    focusProblem.current = true
    setProblem(next)
  }

  async function save(operation: () => Promise<ServiceRequest>) {
    if (pending.current) return
    pending.current = true
    onSaving(true)
    setProblem(null)
    try {
      onSaved(await operation())
    } catch (error) {
      reportProblem(readWriteError(error))
    } finally {
      pending.current = false
      onSaving(false)
    }
  }

  return { problem, setProblem, reportProblem, save }
}
