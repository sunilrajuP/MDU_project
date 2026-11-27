import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PATHS } from '@/app/paths';
import type { SurveyorJobSummary } from '@/types/surveyor';
import { formatShortDate, formatShortDateUpper } from '../format';
import { SyncBadge } from './SyncBadge';
import styles from './ReturnedView.module.scss';

/** Orange "Returned · action required" banner (reason + retention note). */
export function ReturnedBanner({ job }: Readonly<{ job: SurveyorJobSummary }>) {
  if (!job.returned) return null;
  return (
    <div className={styles.banner} role="note">
      <p className={styles.bannerTitle}>Returned · action required</p>
      <p className={styles.bannerReason}>{job.returned.reason}</p>
      {job.returned.dataRetained && (
        <p className={styles.bannerMeta}>Data retained · {formatShortDate(job.returned.returnedAt.slice(0, 10))}</p>
      )}
    </div>
  );
}

/** Returned-job card. The whole card opens the runbook for rework. */
export function ReturnedJobCard({ job, surveyorName }: Readonly<{ job: SurveyorJobSummary; surveyorName: string }>) {
  return (
    <Card className={styles.card}>
      <Link
        to={PATHS.SURVEYOR_JOB_RUNBOOK(job.jobRef)}
        state={{ startSurvey: true }}
        className={styles.link}
        aria-label={`Rework ${job.siteName} ${job.jobRef}`}
      >
        <span className={styles.meta}>
          {job.jobRef} · {formatShortDateUpper(job.scheduledDate)}
        </span>
        <h3 className={styles.title}>{job.siteName}</h3>
        <span className={styles.address}>{job.address}</span>
        <StatusBadge status="returned" />
        <span className={styles.sync}>
          {surveyorName} · <SyncBadge state={job.sync.state} lastSyncedAt={job.sync.lastSyncedAt} />
        </span>
        {job.returned?.dataRetained && <span className={styles.retained}>Your submitted evidence is retained.</span>}
      </Link>
    </Card>
  );
}
