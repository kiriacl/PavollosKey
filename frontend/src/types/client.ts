export interface ClientAddress {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

export interface ClientInput {
  nome: string
  telefone: string
  whatsapp: string
  email: string
  endereco: ClientAddress
  observacoes: string
}

export interface Client extends ClientInput {
  id: string
  criadoEm: string
}

export type ClientFieldName = keyof Omit<ClientInput, 'endereco'> | `endereco.${keyof ClientAddress}`
export type ClientFieldErrors = Partial<Record<ClientFieldName, string>>

export const emptyAddress: ClientAddress = {
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
}

export const emptyClient: ClientInput = {
  nome: '', telefone: '', whatsapp: '', email: '', endereco: emptyAddress, observacoes: '',
}
