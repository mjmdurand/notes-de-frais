import type { ReportStatus } from '../types'
import { STATUS_COLORS, STATUS_LABELS } from '../types'

export default function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
