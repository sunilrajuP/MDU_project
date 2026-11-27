import { Check, CircleAlert, Clock } from 'lucide-react';
import type { SyncState } from '@/types/surveyor';
import { formatClock } from '../format';
import styles from './SyncBadge.module.scss';

interface SyncBadgeProps {
  state: SyncState;
  lastSyncedAt: string;
  /** Returned jobs show "Data retained" instead of the sync state (as in the Figma card). */
  dataRetained?: boolean;
}

export function SyncBadge({ state, lastSyncedAt, dataRetained }: Readonly<SyncBadgeProps>) {
  if (dataRetained) {
    return (
      <span className={[styles.badge, styles.ok].join(' ')}>
        <Check size={11} aria-hidden="true" /> Data retained
      </span>
    );
  }
  if (state === 'pending') {
    return (
      <span className={[styles.badge, styles.pending].join(' ')}>
        <Clock size={11} aria-hidden="true" /> Pending sync
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className={[styles.badge, styles.failed].join(' ')}>
        <CircleAlert size={11} aria-hidden="true" /> Sync failed
      </span>
    );
  }
  // return (
  //   <span className={[styles.badge, styles.ok].join(' ')}>
  //     <Check size={11} aria-hidden="true" /> Synced {formatClock(lastSyncedAt)}
  //   </span>
  // );
}
