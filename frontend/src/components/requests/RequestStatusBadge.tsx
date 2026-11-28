import type { RequestStatus } from '../../types/request'
import { requestStatusLabels } from './requestStatusLabels'
import './request-status.css'

export function RequestStatusBadge({ status, label = requestStatusLabels[status] }: { status: RequestStatus; label?: string }) {
  return (
    <span className={`request-pill request-${status}`}>
      <i aria-hidden="true" />{label}
    </span>
  )
}
