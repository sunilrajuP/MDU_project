import type { PropsWithChildren } from 'react';
import { Check, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import type { SectionKey } from '@/types/surveyor';
import type { SectionSummary } from '../model/types';
import styles from './SectionAccordion.module.scss';

interface SectionAccordionProps {
  sectionKey: SectionKey;
  /** 1-based position in the runbook. */
  position: number;
  title: string;
  subtitle: string;
  summary: SectionSummary;
  /** First unfinished section: gets the purple outline and a "Current" chip. */
  isCurrent: boolean;
  expanded: boolean;
  /** After a successful submit every section is read-only (controls inside the body are disabled). */
  readOnly?: boolean;
  onToggle: () => void;
}

/** One of the 9 runbook rows: icon, title, state chip + progress, and the section body when expanded. */
export function SectionAccordion({
  sectionKey,
  position,
  title,
  subtitle,
  summary,
  isCurrent,
  expanded,
  readOnly = false,
  onToggle,
  children,
}: Readonly<PropsWithChildren<SectionAccordionProps>>) {
  const complete = summary.status === 'complete';
  const locked = summary.status === 'locked';
  const showCurrent = isCurrent && !complete && !locked;
  const chip = showCurrent && summary.chip.startsWith('Draft') ? summary.chip.replace('Draft', 'Current') : summary.chip;
  const tone = showCurrent && summary.tone === 'neutral' ? 'brand' : summary.tone;
  const headerId = `runbook-${sectionKey}-header`;
  const bodyId = `runbook-${sectionKey}-body`;

  return (
    <section
      id={`runbook-${sectionKey}`}
      className={[styles.row, expanded || showCurrent ? styles.outlined : ''].filter(Boolean).join(' ')}
      data-status={summary.status}
    >
      <h2 className={styles.heading}>
        <button
          type="button"
          id={headerId}
          className={styles.header}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className={styles.top}>
            <span
              className={[styles.icon, complete ? styles.iconDone : '', showCurrent ? styles.iconCurrent : ''].filter(Boolean).join(' ')}
              aria-hidden="true"
            >
              {complete ? <Check size={16} /> : locked ? <Lock size={16} /> : position}
            </span>
            <span className={styles.title}>{title}</span>
            {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </span>
          <span className={styles.subtitle}>{subtitle}</span>
          <span className={styles.status}>
            <StatusChip tone={tone}>{chip}</StatusChip>
            <ProgressBar value={summary.progress * 100} tone={complete ? 'success' : 'brand'} label={`${title} progress`} />
          </span>
        </button>
      </h2>
      {expanded && (
        <div id={bodyId} role="region" aria-labelledby={headerId} className={styles.body}>
          <fieldset className={styles.fieldset} disabled={readOnly}>
            {children}
          </fieldset>
        </div>
      )}
    </section>
  );
}
