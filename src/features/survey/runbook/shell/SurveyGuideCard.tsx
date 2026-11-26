import styles from './SurveyGuideCard.module.scss';

interface SurveyGuideCardProps {
  percent: number;
  completeCount: number;
  total: number;
  /** Title of the section "Continue" leads to; null once everything is complete. */
  nextTitle: string | null;
  onContinue: () => void;
}

const RADIUS = 21;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Purple "Survey guide" card: progress ring, "X of 9 steps complete" and the next step link. */
export function SurveyGuideCard({ percent, completeCount, total, nextTitle, onContinue }: Readonly<SurveyGuideCardProps>) {
  return (
    <section className={styles.card} aria-label="Survey guide">
      <div className={styles.top}>
        <div
          className={styles.ring}
          role="progressbar"
          aria-label="Survey progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <svg viewBox="0 0 50 50" className={styles.svg} aria-hidden="true">
            <circle className={styles.track} cx="25" cy="25" r={RADIUS} />
            <circle
              className={styles.value}
              cx="25"
              cy="25"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            />
          </svg>
          <span className={styles.percent}>{percent}%</span>
        </div>
        <div className={styles.text}>
          <span className={styles.eyebrow}>SURVEY GUIDE</span>
          <span className={styles.headline}>
            {completeCount} of {total} steps complete
          </span>
        </div>
      </div>
      {nextTitle && (
        <button type="button" className={styles.next} onClick={onContinue}>
          Continue · {nextTitle} →
        </button>
      )}
    </section>
  );
}
