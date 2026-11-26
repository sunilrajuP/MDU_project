import type { PropsWithChildren } from 'react';
import styles from './StatusChip.module.scss';

export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';

interface StatusChipProps {
  tone?: ChipTone;
  className?: string;
}

/** Small pill for item/section state (Captured, Missing, Required, Draft ...). */
export function StatusChip({ tone = 'neutral', className, children }: Readonly<PropsWithChildren<StatusChipProps>>) {
  return <span className={[styles.chip, styles[tone], className].filter(Boolean).join(' ')}>{children}</span>;
}
