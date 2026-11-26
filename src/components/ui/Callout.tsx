import type { PropsWithChildren } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import styles from './Callout.module.scss';

export type CalloutTone = 'info' | 'warning' | 'success' | 'danger';

interface CalloutProps {
  tone?: CalloutTone;
  className?: string;
}

const ICONS = { info: Info, warning: CircleAlert, danger: CircleAlert, success: CircleCheck } as const;

/** Inline banner used across the runbook (info / warning / success messages). */
export function Callout({ tone = 'info', className, children }: Readonly<PropsWithChildren<CalloutProps>>) {
  const Icon = ICONS[tone];
  return (
    <div
      className={[styles.callout, styles[tone], className].filter(Boolean).join(' ')}
      role={tone === 'danger' ? 'alert' : 'note'}
    >
      <Icon className={styles.icon} size={18} aria-hidden="true" />
      <div className={styles.text}>{children}</div>
    </div>
  );
}
