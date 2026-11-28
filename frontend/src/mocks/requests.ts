import type { ServiceRequest } from '../types/request'

const seed: Omit<ServiceRequest, 'criadoEm' | 'atualizadoEm' | 'endereco' | 'observacoes'>[] = [
  {
    id: 'SOL-015', clienteId: 'demo-1', tipoServico: 'Abertura residencial',
    dataSolicitacao: '2026-11-19', origem: 'whatsapp', status: 'pendente',
    descricao: 'Solicitou a abertura da porta de entrada da residência.',
  },
  {
    id: 'SOL-014', clienteId: 'demo-2', tipoServico: 'Cópia de chave automotiva',
    dataSolicitacao: '2026-11-18', origem: 'telefone', status: 'em_atendimento',
    descricao: 'Solicitou uma chave reserva para o veículo.',
  },
  {
    id: 'SOL-013', clienteId: 'demo-3', tipoServico: 'Troca de fechadura',
    dataSolicitacao: '2026-11-16', origem: 'presencial', status: 'resolvida',
    descricao: 'Pediu a substituição da fechadura da porta principal.',
  },
  {
    id: 'SOL-012', clienteId: 'demo-4', tipoServico: 'Instalação de fechadura digital',
    dataSolicitacao: '2026-11-13', origem: 'site', status: 'em_atendimento',
    descricao: 'Solicitou a instalação de uma fechadura digital já adquirida.',
  },
  {
    id: 'SOL-011', clienteId: 'demo-5', tipoServico: 'Cópia de chave residencial',
    dataSolicitacao: '2026-11-07', origem: 'presencial', status: 'pendente',
    descricao: 'Pediu duas cópias da chave de entrada.',
  },
  {
    id: 'SOL-010', clienteId: 'demo-6', tipoServico: 'Abertura de veículo',
    dataSolicitacao: '2026-10-31', origem: 'whatsapp', status: 'resolvida',
    descricao: 'Solicitou atendimento para recuperar a chave deixada no veículo.',
  },
  {
    id: 'SOL-009', clienteId: 'demo-7', tipoServico: 'Troca de cilindro',
    dataSolicitacao: '2026-10-24', origem: 'telefone', status: 'cancelada',
    descricao: 'Pediu avaliação para substituição do cilindro.',
  },
  {
    id: 'SOL-008', clienteId: 'demo-8', tipoServico: 'Reparo de fechadura',
    dataSolicitacao: '2026-10-15', origem: 'site', status: 'pendente',
    descricao: 'Relatou dificuldade para acionar a fechadura.',
  },
  {
    id: 'SOL-007', clienteId: 'demo-9', tipoServico: 'Cópia de chave tetra',
    dataSolicitacao: '2026-10-06', origem: 'presencial', status: 'resolvida',
    descricao: 'Solicitou uma cópia a partir da chave original.',
  },
  {
    id: 'SOL-006', clienteId: 'demo-10', tipoServico: 'Abertura comercial',
    dataSolicitacao: '2026-08-26', origem: 'whatsapp', status: 'em_atendimento',
    descricao: 'Pediu atendimento para a porta de acesso da loja.',
  },
  {
    id: 'SOL-005', clienteId: 'demo-11', tipoServico: 'Instalação de fechadura',
    dataSolicitacao: '2026-08-19', origem: 'site', status: 'resolvida',
    descricao: 'Solicitou a instalação de uma fechadura em porta interna.',
  },
  {
    id: 'SOL-004', clienteId: 'demo-12', tipoServico: 'Regulagem de fechadura',
    dataSolicitacao: '2026-08-04', origem: 'telefone', status: 'cancelada',
    descricao: 'Pediu ajuste no fechamento de uma porta.',
  },
  {
    id: 'SOL-003', clienteId: 'demo-13', tipoServico: 'Troca de segredo',
    dataSolicitacao: '2026-07-21', origem: 'presencial', status: 'resolvida',
    descricao: 'Pediu que a fechadura passasse a usar uma nova chave.',
  },
  {
    id: 'SOL-002', clienteId: 'demo-14', tipoServico: 'Cópia de controle de portão',
    dataSolicitacao: '2026-06-17', origem: 'whatsapp', status: 'resolvida',
    descricao: 'Solicitou uma unidade adicional do controle do portão.',
  },
  {
    id: 'SOL-001', clienteId: 'demo-15', tipoServico: 'Reparo de fechadura',
    dataSolicitacao: '2026-06-03', origem: 'telefone', status: 'pendente',
    descricao: 'Solicitou revisão de uma fechadura que trava ao fechar a porta.',
  },
]

export const demoRequests: ServiceRequest[] = seed.map((request) => {
  const timestamp = `${request.dataSolicitacao}T12:00:00.000Z`
  return {
    ...request,
    criadoEm: timestamp,
    atualizadoEm: timestamp,
    endereco: request.id === 'SOL-015' ? 'Rua das Oficinas, 120 · Vila Horizonte, São Paulo' : '',
    observacoes: request.id === 'SOL-015' ? 'Confirmar o horário antes do deslocamento.' : '',
  }
})
