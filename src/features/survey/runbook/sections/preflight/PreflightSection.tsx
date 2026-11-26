import { ChevronRight, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { useGetRunbookConfigQuery } from '@/api/surveyorApi';
import type { SectionKey } from '@/types/surveyor';
import { joinList } from '../../logic/common';
import { SECTION_ORDER } from '../../model/defaults';
import { useRunbook } from '../../state/runbookContext';
import styles from './PreflightSection.module.scss';

/** Short names used in the "02 · Floor Plans" tags and the "X and Y are complete" sentence. */
const SHORT: Partial<Record<SectionKey, string>> = {
  whs: 'WHS',
  bfd: 'BFD selection',
  external: 'External Network & Site Entry',
  internal: 'Internal Network',
  floorPlans: 'Floor Plans',
  nbnDesign: 'NBN Design Inputs',
  bom: 'BoM Review & Confirm',
};

const pad = (position: number) => String(position).padStart(2, '0');

/** Section 8: Pre-flight Validation. Every figure and card here is derived from the other sections' state. */
export function PreflightSection() {
  const { issues, progress, summaries, openSection } = useRunbook();
  useGetRunbookConfigQuery(); // titles are static here; keeps the config warm for navigation

  const groups = issues.length;
  const completeSections = SECTION_ORDER.filter((key) => key !== 'preflight' && key !== 'signoff' && summaries[key].status === 'complete');
  const completeNames = completeSections.map((key) => SHORT[key] ?? key);

  let sentence = `${progress.completeCount} of ${progress.total} survey steps complete. `;
  if (completeNames.length === 0) sentence += 'No steps are complete yet; ';
  else sentence += `${joinList(completeNames)} ${completeNames.length === 1 ? 'is' : 'are'} complete; `;
  sentence += groups === 0 ? 'validation has passed.' : 'validation has not passed.';

  return (
    <>
      {groups > 0 ? (
        <Callout tone="warning">
          Outstanding mandatory checks · Survey cannot be submitted until all required evidence and confirmations pass.
        </Callout>
      ) : (
        <Callout tone="success">All mandatory checks pass. The survey is ready for sign-off.</Callout>
      )}

      <div className={styles.summary}>
        <h3 className={styles.percent}>{progress.percent}% complete</h3>
        <ProgressBar value={progress.percent} label="Survey completion" />
        <p className={styles.sentence}>{sentence}</p>
        {groups > 0 && <StatusChip tone="warning">{groups} outstanding groups</StatusChip>}
      </div>

      {groups > 0 && (
        <ul className={styles.issues} aria-label="Outstanding items">
          {issues.map((issue, index) => (
            <li key={`${issue.sectionKey}-${index}`}>
              <button type="button" className={styles.issue} onClick={() => openSection(issue.sectionKey)}>
                <CircleAlert size={22} className={styles.alert} aria-hidden="true" />
                <span className={styles.issueText}>
                  <span className={styles.tag}>
                    {pad(SECTION_ORDER.indexOf(issue.sectionKey) + 1)} · {SHORT[issue.sectionKey]}
                  </span>
                  <span className={styles.issueTitle}>{issue.title}</span>
                  <span className={styles.issueDetail}>{issue.detail}</span>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" disabled={groups === 0} onClick={() => issues[0] && openSection(issues[0].sectionKey)}>
        Fix Outstanding Items
      </Button>
      <Button type="button" variant="secondary" disabled={groups > 0} onClick={() => openSection('signoff')}>
        Submit survey
      </Button>
      <p className={styles.footnote}>
        Submission remains disabled while mandatory checks are outstanding. Offline pending sync does not mean submitted.
      </p>
    </>
  );
}
