import styles from './ProgressBar.module.scss';

interface ProgressBarProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  tone?: 'brand' | 'success';
  label: string;
  className?: string;
}

export function ProgressBar({ value, tone = 'brand', label, className }: Readonly<ProgressBarProps>) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      className={[styles.track, className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div className={[styles.fill, styles[tone]].join(' ')} style={{ width: `${clamped}%` }} />
    </div>
  );
}
