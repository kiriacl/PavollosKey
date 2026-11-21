import type { DashboardData } from '../types/dashboard'

export const demoDashboard: DashboardData = {
  solicitacoes: [
    {
      id: 'SOL-015', cliente: 'Mariana Costa', tipoServico: 'Abertura residencial',
      dataSolicitacao: '2026-11-19', origem: 'WhatsApp', status: 'pendente',
    },
    {
      id: 'SOL-014', cliente: 'Rafael Almeida', tipoServico: 'Cópia de chave automotiva',
      dataSolicitacao: '2026-11-18', origem: 'Telefone', status: 'em_atendimento',
    },
    {
      id: 'SOL-013', cliente: 'Camila Nogueira', tipoServico: 'Troca de fechadura',
      dataSolicitacao: '2026-11-16', origem: 'Balcão', status: 'resolvida',
    },
    {
      id: 'SOL-012', cliente: 'João Mendes', tipoServico: 'Instalação de fechadura digital',
      dataSolicitacao: '2026-11-13', origem: 'Site', status: 'em_atendimento',
    },
    {
      id: 'SOL-011', cliente: 'Beatriz Lima', tipoServico: 'Cópia de chave residencial',
      dataSolicitacao: '2026-11-07', origem: 'Balcão', status: 'pendente',
    },
    {
      id: 'SOL-010', cliente: 'André Ribeiro', tipoServico: 'Abertura de veículo',
      dataSolicitacao: '2026-10-31', origem: 'WhatsApp', status: 'resolvida',
    },
    {
      id: 'SOL-009', cliente: 'Sofia Barbosa', tipoServico: 'Troca de cilindro',
      dataSolicitacao: '2026-10-24', origem: 'Telefone', status: 'cancelada',
    },
    {
      id: 'SOL-008', cliente: 'Lucas Ferreira', tipoServico: 'Reparo de fechadura',
      dataSolicitacao: '2026-10-15', origem: 'Site', status: 'pendente',
    },
    {
      id: 'SOL-007', cliente: 'Elisa Carvalho', tipoServico: 'Cópia de chave tetra',
      dataSolicitacao: '2026-10-06', origem: 'Balcão', status: 'resolvida',
    },
    {
      id: 'SOL-006', cliente: 'Pedro Martins', tipoServico: 'Abertura comercial',
      dataSolicitacao: '2026-08-26', origem: 'WhatsApp', status: 'em_atendimento',
    },
    {
      id: 'SOL-005', cliente: 'Helena Souza', tipoServico: 'Instalação de fechadura',
      dataSolicitacao: '2026-08-19', origem: 'Site', status: 'resolvida',
    },
    {
      id: 'SOL-004', cliente: 'Tiago Rocha', tipoServico: 'Regulagem de fechadura',
      dataSolicitacao: '2026-08-04', origem: 'Telefone', status: 'cancelada',
    },
    {
      id: 'SOL-003', cliente: 'Isabela Dias', tipoServico: 'Troca de segredo',
      dataSolicitacao: '2026-07-21', origem: 'Balcão', status: 'resolvida',
    },
    {
      id: 'SOL-002', cliente: 'Felipe Santos', tipoServico: 'Cópia de controle de portão',
      dataSolicitacao: '2026-06-17', origem: 'WhatsApp', status: 'resolvida',
    },
    {
      id: 'SOL-001', cliente: 'Alice Moreira', tipoServico: 'Reparo de fechadura',
      dataSolicitacao: '2026-06-03', origem: 'Telefone', status: 'pendente',
    },
  ],
  servicos: [
    { id: 'SER-01', status: 'em_andamento' },
    { id: 'SER-02', status: 'em_andamento' },
    { id: 'SER-03', status: 'em_andamento' },
    { id: 'SER-04', status: 'em_andamento' },
    { id: 'SER-05', status: 'concluido' },
    { id: 'SER-06', status: 'concluido' },
    { id: 'SER-07', status: 'concluido' },
    { id: 'SER-08', status: 'concluido' },
    { id: 'SER-09', status: 'concluido' },
    { id: 'SER-10', status: 'aguardando' },
  ],
  visitas: [
    { id: 'VIS-01', status: 'agendada' },
    { id: 'VIS-02', status: 'agendada' },
    { id: 'VIS-03', status: 'agendada' },
    { id: 'VIS-04', status: 'realizada' },
    { id: 'VIS-05', status: 'cancelada' },
  ],
}
