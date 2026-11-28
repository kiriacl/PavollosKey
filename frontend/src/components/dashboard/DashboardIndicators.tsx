import { Icon, type IconName } from '../ui/Icon'
import { usingMocks } from '../../services/http'

interface DashboardIndicatorsProps {
  total?: number
  pending?: number
  inProgress: number
  scheduled?: number
  completed: number
}

const indicatorCards = [
  { field: 'total', label: 'Total de solicitações', icon: 'requests' },
  { field: 'pending', label: usingMocks ? 'Solicitações pendentes' : 'Atendimentos abertos', icon: 'clock' },
  { field: 'inProgress', label: 'Serviços em andamento', icon: 'tools' },
  { field: 'scheduled', label: 'Visitas agendadas', icon: 'calendar' },
  { field: 'completed', label: 'Serviços concluídos', icon: 'check' },
] satisfies { field: keyof DashboardIndicatorsProps; label: string; icon: IconName }[]

const numberFormat = new Intl.NumberFormat('pt-BR')

export function DashboardIndicators(values: DashboardIndicatorsProps) {
  return (
    <dl className="dashboard-indicators">
      {indicatorCards.filter(({ field }) => field === 'scheduled' || values[field] !== undefined).map(({ field, label, icon }) => (
        <div key={field} className={`dashboard-card dashboard-indicator indicator-${field}`}>
          <dt>{label}</dt>
          <dd>
            <span className="icon-tile"><Icon name={icon} /></span>
            <span>{values[field] === undefined ? <small>Sem dados da API</small> : numberFormat.format(values[field])}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
