import { emptyClient, type Client } from '../types/client'

const contacts = [
  {
    id: 'demo-1',
    nome: 'Mariana Costa',
    telefone: '11900000001',
    whatsapp: '11900000001',
    email: 'mariana@example.com',
    endereco: {
      cep: '00000000',
      logradouro: 'Rua das Oficinas',
      numero: '120',
      complemento: 'Apto 32',
      bairro: 'Vila Horizonte',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    observacoes: 'Prefere contato por WhatsApp no período da tarde.',
  },
  { id: 'demo-2', nome: 'Rafael Almeida', telefone: '2130000002', whatsapp: '21900000002' },
  { id: 'demo-3', nome: 'Camila Nogueira', telefone: '31900000003', email: 'camila@example.com' },
  { id: 'demo-4', nome: 'João Mendes', telefone: '61900000004', whatsapp: '61900000004', email: 'joao@example.com' },
  { id: 'demo-5', nome: 'Beatriz Lima', telefone: '41900000005', whatsapp: '41900000005' },
  { id: 'demo-6', nome: 'André Ribeiro', telefone: '5130000006', email: 'andre@example.com' },
  { id: 'demo-7', nome: 'Sofia Barbosa', telefone: '71900000007', whatsapp: '71900000007' },
  { id: 'demo-8', nome: 'Lucas Ferreira', telefone: '81900000008' },
  { id: 'demo-9', nome: 'Elisa Carvalho', telefone: '85900000009', email: 'elisa@example.com' },
  { id: 'demo-10', nome: 'Pedro Martins', telefone: '47900000010', whatsapp: '47900000010' },
  { id: 'demo-11', nome: 'Helena Souza', telefone: '27900000011' },
  { id: 'demo-12', nome: 'Tiago Rocha', telefone: '62900000012', whatsapp: '62900000012' },
  { id: 'demo-13', nome: 'Isabela Dias', telefone: '92900000013', email: 'isabela@example.com' },
  { id: 'demo-14', nome: 'Felipe Santos', telefone: '11900000014' },
  { id: 'demo-15', nome: 'Alice Moreira', telefone: '11900000015' },
]

export const demoClients: Client[] = contacts.map((contact, index) => ({
  ...emptyClient,
  ...contact,
  criadoEm: new Date(Date.UTC(2026, 10, 19 - index, 14)).toISOString(),
}))
