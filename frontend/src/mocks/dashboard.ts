import type { DashboardData } from '../types/dashboard'

export const demoDashboard: Omit<DashboardData, 'solicitacoes'> = {
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
