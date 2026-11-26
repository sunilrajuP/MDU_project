import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Input } from '@/components/ui/Input';
import { useRecommendBfdMutation } from '@/api/surveyorApi';
import type { BfdRecommendation } from '@/types/surveyor';
import { BFD_FIGURE, BFD_STEPS, BFD_TOTAL, type BfdStep } from '../../config/bfdConfig';
import styles from './BfdCarousel.module.scss';

interface BfdCarouselProps {
  jobRef: string;
  initialAnswers: Record<string, string>;
  onCancel: () => void;
  onSave: (answers: Record<string, string>, figure: string, recommendation: BfdRecommendation) => void;
}

const WHOLE_NUMBER = /^\d+$/;

function stepError(step: BfdStep, answers: Record<string, string>): string | null {
  const value = (answers[step.code] ?? '').trim();
  if (value === '') return step.type === 'yesNo' ? 'Choose Yes or No.' : 'Enter a number.';
  if (step.type === 'count' && !WHOLE_NUMBER.test(value)) return 'Enter a whole number.';
  return null;
}

/**
 * Inline step carousel (inside the BFD section, not a new page). Steps 1..6 collect the answers; the final
 * slide shows the recommendation for confirmation. [TBC] step wording comes from config until the six
 * "BFD Selector / Tablet / Question" frames are read.
 */
export function BfdCarousel({ jobRef, initialAnswers, onCancel, onSave }: Readonly<BfdCarouselProps>) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [recommendation, setRecommendation] = useState<{ figure: string; value: BfdRecommendation } | null>(null);
  const [recommend, { isLoading, isError }] = useRecommendBfdMutation();

  const slides = BFD_TOTAL + 1; // six questions + recommendation
  const onResult = index === BFD_TOTAL;
  const step = BFD_STEPS[index];
  const error = step && attempted ? stepError(step, answers) : null;

  const set = (code: string, value: string) => setAnswers((current) => ({ ...current, [code]: value }));

  async function next() {
    if (step) {
      if (stepError(step, answers)) {
        setAttempted(true);
        return;
      }
      setAttempted(false);
      if (index < BFD_TOTAL - 1) {
        setIndex(index + 1);
        return;
      }
      try {
        const result = await recommend({ jobRef, answers }).unwrap();
        setRecommendation({ figure: result.figure, value: result.recommendation });
        setIndex(BFD_TOTAL);
      } catch {
        // surfaced via isError below
      }
    }
  }

  return (
    <section className={styles.carousel} aria-label="BFD Selector">
      <div className={styles.top}>
        <h3 className={styles.title}>BFD Selector · {BFD_FIGURE}</h3>
        <button type="button" className={styles.close} onClick={onCancel}>
          Close
        </button>
      </div>

      <div className={styles.indicator} aria-live="polite">
        <span className={styles.count}>{onResult ? 'Recommendation' : `Question ${index + 1} of ${BFD_TOTAL}`}</span>
        <ol className={styles.dots} aria-label="BFD selector steps">
          {Array.from({ length: slides }, (_, position) => (
            <li
              key={position}
              className={[styles.dot, position === index ? styles.dotActive : '', position < index ? styles.dotDone : '']
                .filter(Boolean)
                .join(' ')}
              aria-current={position === index ? 'step' : undefined}
            />
          ))}
        </ol>
      </div>

      <div className={styles.viewport}>
        <div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>
          {BFD_STEPS.map((entry, position) => (
            <div key={entry.code} className={styles.slide} inert={position !== index} aria-hidden={position !== index}>
              <p className={styles.prompt}>{entry.prompt}</p>
              {entry.type === 'count' ? (
                <Input
                  label={entry.prompt}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={answers[entry.code] ?? ''}
                  onChange={(event) => set(entry.code, event.target.value)}
                  error={position === index ? (error ?? undefined) : undefined}
                />
              ) : (
                <>
                  <ChoiceGroup
                    label={entry.prompt}
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ]}
                    value={answers[entry.code] || null}
                    onChange={(value) => set(entry.code, value)}
                  />
                  {position === index && error && (
                    <span className={styles.error} role="alert">
                      {error}
                    </span>
                  )}
                </>
              )}
              {entry.note && (
                <Input
                  label={`${entry.note.label} (optional)`}
                  value={answers[entry.note.code] ?? ''}
                  onChange={(event) => set(entry.note!.code, event.target.value)}
                />
              )}
            </div>
          ))}

          <div className={styles.slide} inert={!onResult} aria-hidden={!onResult}>
            {recommendation && (
              <div className={styles.result}>
                <span className={styles.eyebrow}>RECOMMENDED BFD · {recommendation.figure.toUpperCase()}</span>
                <span className={styles.code}>{recommendation.value.code}</span>
                <span className={styles.name}>{recommendation.value.name}</span>
                <span className={styles.line}>{recommendation.value.spec}</span>
                <span className={styles.line}>{recommendation.value.rationale}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isError && <Callout tone="danger">The recommendation could not be calculated. Please try again.</Callout>}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setAttempted(false);
            setIndex((current) => Math.max(0, current - 1));
          }}
          disabled={index === 0 || isLoading}
        >
          Previous
        </Button>
        {onResult ? (
          <Button
            type="button"
            onClick={() => recommendation && onSave(answers, recommendation.figure, recommendation.value)}
            disabled={!recommendation}
          >
            Save selection
          </Button>
        ) : (
          <Button type="button" onClick={() => void next()} disabled={isLoading}>
            {index === BFD_TOTAL - 1 ? (isLoading ? 'Calculating…' : 'Get recommendation') : 'Next'}
          </Button>
        )}
      </div>
    </section>
  );
}
