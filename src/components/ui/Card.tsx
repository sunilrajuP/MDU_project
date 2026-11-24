import type { PropsWithChildren } from 'react';
import styles from './Card.module.scss';

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={[styles.card, className].filter(Boolean).join(' ')}>{children}</div>;
}
