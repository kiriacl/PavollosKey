import { emptyAddress, type ClientFieldErrors, type ClientFieldName, type ClientInput } from '../../types/client'
import { HttpError, usingMocks } from '../../services/http'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' })

export const digitsOnly = (value: string) => value.replace(/\D/g, '')
export const formatClientDate = (value: string) => dateFormat.format(new Date(value))
export const clientFieldId = (field: ClientFieldName) => `client-field-${field.replace('.', '-')}`

export function formatPhone(value: string) {
  if (!usingMocks) return value
  const digits = digitsOnly(value)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`

  const number = digits.slice(2)
  const split = number.length > 8 ? 5 : 4
  const suffix = number.length > split ? `-${number.slice(split)}` : ''
  return `(${digits.slice(0, 2)}) ${number.slice(0, split)}${suffix}`
}

export function formatCep(value: string) {
  const digits = digitsOnly(value)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function editClientValues(input: ClientInput): ClientInput {
  return {
    ...input,
    telefone: formatPhone(input.telefone),
    whatsapp: formatPhone(input.whatsapp),
    endereco: { ...input.endereco, cep: formatCep(input.endereco.cep) },
  }
}

export function normalizeClientInput(input: ClientInput): ClientInput {
  const { endereco } = input

  return {
    nome: input.nome.trim(),
    telefone: usingMocks ? digitsOnly(input.telefone) : input.telefone.trim(),
    whatsapp: digitsOnly(input.whatsapp),
    email: input.email.trim(),
    observacoes: input.observacoes.trim(),
    endereco: {
      cep: digitsOnly(endereco.cep),
      logradouro: endereco.logradouro.trim(),
      numero: endereco.numero.trim(),
      complemento: endereco.complemento.trim(),
      bairro: endereco.bairro.trim(),
      cidade: endereco.cidade.trim(),
      estado: endereco.estado.trim(),
    },
  }
}

export function validateClient(input: ClientInput): ClientFieldErrors {
  const errors: ClientFieldErrors = {}
  const phone = /^\d{10,11}$/

  if (!input.nome) errors.nome = 'Informe o nome completo.'
  if (!usingMocks && input.nome.length > 120) errors.nome = 'Use até 120 caracteres.'
  if (!usingMocks && input.telefone && (
    input.telefone.length > 40 || !/^[+().0-9\s-]+$/.test(input.telefone) || !/^\d{7,15}$/.test(digitsOnly(input.telefone))
  )) errors.telefone = 'Informe um telefone com 7 a 15 dígitos, incluindo o código do país se necessário.'
  if (usingMocks && !input.telefone) errors.telefone = 'Informe o telefone com DDD.'
  else if (usingMocks && !phone.test(input.telefone)) errors.telefone = 'Use 10 ou 11 dígitos, incluindo o DDD.'
  if (input.whatsapp && !phone.test(input.whatsapp)) errors.whatsapp = 'Use 10 ou 11 dígitos, incluindo o DDD.'
  if (input.email && (input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))) errors.email = 'Informe um e-mail válido.'
  if (input.endereco.cep && !/^\d{8}$/.test(input.endereco.cep)) errors['endereco.cep'] = 'Informe os 8 dígitos do CEP.'

  return errors
}

const fields: ClientFieldName[] = [
  'nome', 'telefone', 'whatsapp', 'email',
  ...(Object.keys(emptyAddress) as (keyof typeof emptyAddress)[]).map((key): ClientFieldName => `endereco.${key}`),
  'observacoes',
]

function hasFieldErrors(value: unknown): value is { erros: Record<string, unknown> } {
  return typeof value === 'object' && value !== null && 'erros' in value
    && typeof value.erros === 'object' && value.erros !== null
}

export function readSaveError(error: unknown): { message: string; fieldErrors: ClientFieldErrors } {
  const fieldErrors: ClientFieldErrors = {}
  if (error instanceof HttpError) {
    if (error.status === 404) return { message: 'O cadastro deste cliente não foi encontrado.', fieldErrors }
    if (error.status === 409) return { message: 'O servidor sinalizou um conflito neste cadastro.', fieldErrors }
    if (error.status === 400 || error.status === 422) {
      if (hasFieldErrors(error.body)) {
        for (const field of fields) {
          const message = error.body.erros[field]
          if (typeof message === 'string' && message.trim()) fieldErrors[field] = message
        }
      }
      return { message: error.body && !hasFieldErrors(error.body) ? error.message : 'O servidor não aceitou os dados. Revise o formulário.', fieldErrors }
    }
  }

  return { message: 'Não foi possível confirmar o salvamento. Confira a conexão e a lista de clientes antes de reenviar.', fieldErrors }
}
