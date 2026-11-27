import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { SurveyorJobSummary } from '@/types/surveyor';
import { formatShortDate } from '../format';
import { DISPLAY_STATUS, jobAction } from './jobPresentation';
import { SyncBadge } from './SyncBadge';
import styles from './SurveyorJobCard.module.scss';

export function SurveyorJobCard({ job }: Readonly<{ job: SurveyorJobSummary }>) {
  const navigate = useNavigate();
  const action = jobAction(job);

  return (
    <Card className={styles.card}>
      <article className={styles.body} aria-label={`${job.siteName} ${job.jobRef}`}>
        <div className={styles.identity}>
          <div className={styles.titles}>
            <h3 className={styles.title}>{job.siteName}</h3>
            <span className={styles.ref}>{job.jobRef}</span>
          </div>
          <StatusBadge status={DISPLAY_STATUS[job.status]} />
        </div>

        <p className={styles.address}>{job.address}</p>

        <div className={styles.meta}>
          <span>{formatShortDate(job.scheduledDate)}</span>
          <SyncBadge
            state={job.sync.state}
            lastSyncedAt={job.sync.lastSyncedAt}
            dataRetained={job.returned?.dataRetained}
          />
        </div>

        {job.progress && (
          <div className={styles.progress}>
            <span className={styles.progressText}>
              {job.progress.percent}% complete · {job.progress.currentStep}
            </span>
            <ProgressBar value={job.progress.percent} label={`${job.siteName} survey progress`} />
          </div>
        )}

        {action && (
          <Button
            type="button"
            variant="outline"
            className={styles.action}
            onClick={() => navigate(action.to, { state: { startSurvey: job.status !== 'not_started' } })}
            aria-label={`${action.label} for ${job.siteName}`}
          >
            {action.label}
          </Button>
        )}
      </article>
    </Card>
  );
}
