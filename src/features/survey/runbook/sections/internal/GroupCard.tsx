import { useId, useState, type PropsWithChildren, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import styles from './GroupCard.module.scss';

interface GroupCardProps {
  title: string;
  subtitle: string;
  /** Right-hand chip next to the chevron (e.g. "0/5"). */
  chip?: ReactNode;
  /** 0–100; omitted = no bar. */
  progress?: number;
  defaultOpen?: boolean;
}

/** Collapsible bordered group used for the building record, floor checklist and basement checks. */
export function GroupCard({ title, subtitle, chip, progress, defaultOpen = true, children }: Readonly<PropsWithChildren<GroupCardProps>>) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className={styles.group} aria-label={title}>
      <div className={styles.top}>
        <h3 className={styles.title}>{title}</h3>
        {chip}
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
      </div>
      <p className={styles.subtitle}>{subtitle}</p>
      {progress !== undefined && <ProgressBar value={progress} label={`${title} progress`} />}
      {open && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  );
}
