import type { MonthlyRequestCount, RequestCounts } from '../../types/dashboard'
import { requestStatusLabels, visibleRequestStatuses } from '../requests/requestStatusLabels'
import '../requests/request-status.css'

const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
const fullMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

interface DashboardChartsProps {
  byStatus: RequestCounts
  monthly: MonthlyRequestCount[]
}

export function DashboardCharts({ byStatus, monthly }: DashboardChartsProps) {
  const largestStatus = Math.max(1, ...Object.values(byStatus))
  const largestMonth = Math.max(1, ...monthly.map(({ count }) => count))
  const firstMonth = monthly.at(0)?.month
  const lastMonth = monthly.at(-1)?.month

  return (
    <div className="dashboard-charts">
      <section className="dashboard-card dashboard-chart" aria-labelledby="dashboard-status-title">
        <h2 id="dashboard-status-title">Solicitações por status</h2>
        {monthly.length === 0 ? (
          <p className="dashboard-note">Nenhuma solicitação para agrupar por status.</p>
        ) : (
          <ul className="status-chart" role="list">
            {visibleRequestStatuses.map((status) => (
              <li key={status} className={`request-${status}`}>
                <span><i aria-hidden="true" />{requestStatusLabels[status]}</span>
                <div className="status-chart-track" aria-hidden="true">
                  <div style={{ width: `${(byStatus[status] / largestStatus) * 100}%` }} />
                </div>
                <strong>{byStatus[status]}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="dashboard-card dashboard-chart" aria-labelledby="dashboard-trend-title">
        <h2 id="dashboard-trend-title">Evolução de solicitações</h2>
        {firstMonth && lastMonth ? (
          <>
            <p className="dashboard-note">{fullMonth.formatRange(firstMonth, lastMonth)}</p>
            <ol className="trend-chart" role="list">
              {monthly.map(({ month, count }) => {
                const label = month.toISOString().slice(0, 7)
                return (
                  <li key={label}>
                    <div className="trend-chart-column">
                      <div className="trend-chart-bar" style={{ height: `${(count / largestMonth) * 100}%` }}>
                        <strong>{count}</strong>
                      </div>
                    </div>
                    <time dateTime={label}>
                      <span className="sr-only">{fullMonth.format(month)}</span>
                      <span aria-hidden="true">{shortMonth.format(month).replace(/\.$/, '')}</span>
                    </time>
                  </li>
                )
              })}
            </ol>
          </>
        ) : (
          <p className="dashboard-note">Nenhuma solicitação para montar a série mensal.</p>
        )}
      </section>
    </div>
  )
}
