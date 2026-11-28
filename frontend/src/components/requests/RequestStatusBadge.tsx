import type { RequestStatus } from '../../types/request'
import { requestStatusLabels } from './requestStatusLabels'
import './request-status.css'

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`request-pill request-${status}`}>
      <i aria-hidden="true" />{requestStatusLabels[status]}
    </span>
  )
}
