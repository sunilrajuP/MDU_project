import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatCompletedAt } from '../../../format';
import { BFD_STEPS, BFD_TOTAL, answerDisplay } from '../../config/bfdConfig';
import { answeredBfd } from '../../logic/bfd';
import { useRunbook } from '../../state/runbookContext';
import { BfdCarousel } from './BfdCarousel';
import styles from './BfdSection.module.scss';

/** Section 2: BFD Selection Wizard. Result as drawn in Figma, plus the inline selector carousel. */
export function BfdSection() {
  const { jobRef, model, update, setCompleted } = useRunbook();
  const data = model.data.bfd;
  const selection = data.selection;
  const [selectorOpen, setSelectorOpen] = useState(false);

  const noTv = data.answers.fibreTv === 'no';
  const noFdt = data.answers.fdtLikely === 'no';

  return (
    <>
      {selection ? (
        <>
          <div className={styles.hero}>
            <span className={styles.eyebrow}>RECOMMENDED BFD · {selection.figure.toUpperCase()}</span>
            <span className={styles.code}>{selection.code}</span>
            <span className={styles.name}>{selection.name}</span>
            <span className={styles.line}>{selection.spec}</span>
            <span className={styles.line}>{selection.rationale}</span>
          </div>

          <Callout tone="success">
            Selection saved · {formatCompletedAt(selection.savedAt)} · {answeredBfd(data)} of {BFD_TOTAL} answers recorded.
          </Callout>

          <section aria-label="Decision trail">
            <h3 className={styles.trailTitle}>Decision trail · {selection.figure}</h3>
            <dl className={styles.trail}>
              {BFD_STEPS.map((step) => (
                <div key={step.code} className={styles.trailRow}>
                  <dt>{step.prompt}</dt>
                  <dd>{answerDisplay(step, data.answers)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className={styles.note}>
            Recommendation follows the supplied {selection.figure} example. Review the six site answers if requirements
            change{noTv && noFdt ? '; no Fibre TV or FDT is selected' : ''}.
          </p>
        </>
      ) : (
        <Callout tone="info">No BFD selected yet. Open the BFD Selector and answer the six questions to get a recommendation.</Callout>
      )}

      {selectorOpen && (
        <BfdCarousel
          jobRef={jobRef}
          initialAnswers={data.answers}
          onCancel={() => setSelectorOpen(false)}
          onSave={(answers, figure, recommendation) => {
            const savedAt = new Date().toISOString();
            update('bfd', () => ({ answers, selection: { ...recommendation, figure, savedAt } }));
            setCompleted('bfd', true);
            setSelectorOpen(false);
          }}
        />
      )}

      {!selectorOpen && (
        <div className={styles.actions}>
          <Button type="button" onClick={() => setSelectorOpen(true)}>
            Open BFD Selector
          </Button>
          {selection && (
            <Button type="button" variant="outline" onClick={() => setSelectorOpen(true)}>
              Edit Answers
            </Button>
          )}
        </div>
      )}

      {selection && <StatusChip tone="success">Completed</StatusChip>}
    </>
  );
}
