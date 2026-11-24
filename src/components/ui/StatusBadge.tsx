import type { JobDisplayStatus } from '@/types/domain';
import styles from './StatusBadge.module.scss';

const STATUS_LABEL: Record<JobDisplayStatus, string> = {
  new: 'Yet to Assign',
  YetToAssign: 'Yet to Assign',
  assigned_teamlead: 'Not Started',
  assigned_surveyor: 'Not Started',
  in_progress: 'In Progress',
  submitted: 'Pending QC',
  pending_qc: 'Pending QC',
  returned: 'Returned',
  approved: 'Approved',
  overdue: 'Overdue',
};

export function StatusBadge({ status }: { status: JobDisplayStatus }) {
  const statusClass = status === 'YetToAssign' ? 'new' : status;
  return <span className={[styles.badge, styles[statusClass]].join(' ')}>{STATUS_LABEL[status]}</span>;
}
