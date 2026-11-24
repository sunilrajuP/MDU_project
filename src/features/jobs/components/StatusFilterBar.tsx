import type { JobCounts } from '@/types/domain';
import styles from './StatusFilterBar.module.scss';

export type StatusFilterKey = 'total' | 'new' | 'assigned' | 'inProgress' | 'overdue' | 'submitted' | 'returned';

const PRIMARY_ROW: { key: StatusFilterKey; label: string }[] = [
  { key: 'total', label: 'Total Sites' },
  { key: 'new', label: 'Yet to Assign' },
  { key: 'assigned', label: 'Not Started' },
  { key: 'inProgress', label: 'In Progress' },
];

const SECONDARY_ROW: { key: StatusFilterKey; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'submitted', label: 'Pending QC' },
  { key: 'returned', label: 'Returned' },
];

interface StatusFilterBarProps {
  counts: JobCounts;
  overdueCount: number;
  active: StatusFilterKey;
  onChange: (key: StatusFilterKey) => void;
}

export function StatusFilterBar({ counts, overdueCount, active, onChange }: StatusFilterBarProps) {
  const valueFor = (key: StatusFilterKey) => (key === 'overdue' ? overdueCount : counts[key]);

  const renderButton = (filter: { key: StatusFilterKey; label: string }) => (
    <button
      key={filter.key}
      type="button"
      role="tab"
      aria-selected={active === filter.key}
      className={[styles.filter, active === filter.key ? styles.active : ''].join(' ')}
      onClick={() => onChange(filter.key)}
    >
      <span className={styles.count}>{valueFor(filter.key)}</span>
      <span className={styles.label}>{filter.label}</span>
    </button>
  );

  return (
    <div className={styles.bar} role="tablist" aria-label="Filter jobs by status">
      <div className={styles.row}>{PRIMARY_ROW.map(renderButton)}</div>
      <div className={styles.row}>{SECONDARY_ROW.map(renderButton)}</div>
    </div>
  );
}

