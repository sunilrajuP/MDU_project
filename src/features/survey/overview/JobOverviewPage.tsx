import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusChip } from '@/components/ui/StatusChip';
import { useGetSiteInfoQuery, useGetSurveyorJobQuery, useStartSurveyMutation } from '@/api/surveyorApi';
import { PATHS } from '@/app/paths';
import { formatClock, formatCoordinates, formatShortDateUpper } from '../format';
import { DISPLAY_STATUS } from '../jobs/jobPresentation';
import { SiteMap, type Basemap } from './SiteMap';
import { useGpsFix } from './useGpsFix';
import styles from './JobOverviewPage.module.scss';

export function JobOverviewPage() {
  const { jobRef = '' } = useParams();
  const navigate = useNavigate();
  const { data: job, isLoading, isError } = useGetSurveyorJobQuery(jobRef);
  const { data: siteInfoData } = useGetSiteInfoQuery(jobRef);
  const [startSurvey, { isLoading: starting, isError: startFailed }] = useStartSurveyMutation();
  const [basemap, setBasemap] = useState<Basemap>('terrain');
  const gps = useGpsFix();

  if (isLoading) return <p role="status">Loading job…</p>;
  if (isError || !job) {
    return (
      <Callout tone="danger">
        This job could not be found. <Link to={PATHS.SURVEYOR_ROOT}>Back to My Jobs</Link>
      </Callout>
    );
  }

  const point = gps.fix ?? job.location;
  const contact = siteInfoData?.siteInfo.stakeholder;
  const actionLabel = job.status === 'returned' ? 'Rework' : job.surveyStarted ? 'Continue Survey' : 'Start Survey';

  async function handleStart() {
    // A survey that already exists is resumed as-is; otherwise the runbook is created first.
    if (!job?.surveyStarted) {
      try {
        await startSurvey({ jobRef }).unwrap();
      } catch {
        return;
      }
    }
    navigate(PATHS.SURVEYOR_JOB_RUNBOOK(jobRef));
  }

  return (
    <div className={styles.page}>
      <Card className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.meta}>
            {job.jobRef} · SCHEDULED {formatShortDateUpper(job.scheduledDate)}
          </span>
          <StatusBadge status={DISPLAY_STATUS[job.status]} />
        </div>
        <h2 className={styles.title}>{job.siteName}</h2>
        <p className={styles.address}>{job.address}</p>
        <p className={styles.address}>
          Assigned to {job.assignedTo} ·{' '}
          <span className={styles.sync}>
            <Check size={12} aria-hidden="true" /> Synced {formatClock(job.sync.lastSyncedAt)}
          </span>
        </p>
      </Card>

      <div className={styles.columns}>
        <Card className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>Site location</h3>
            {job.location.confirmed && <StatusChip tone="success">Confirmed</StatusChip>}
          </div>
          <SiteMap
            jobRef={job.jobRef}
            variant="preview"
            basemap={basemap}
            onBasemapChange={setBasemap}
            onLocate={gps.locate}
          />
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} aria-hidden="true" /> MDU location
            </span>
            <span aria-hidden="true">·</span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} aria-hidden="true" /> Current GPS
            </span>
          </div>
          <p className={styles.coordinates}>
            {formatCoordinates(point.latitude, point.longitude)} · accuracy ±{point.accuracyM} m
          </p>
          {gps.error && (
            <p className={styles.error} role="alert">
              {gps.error}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className={styles.wide}
            onClick={() => navigate(PATHS.SURVEYOR_JOB_MAP(jobRef))}
          >
            Open Map
          </Button>
        </Card>

        <Card className={styles.panel}>
          <h3 className={styles.panelTitle}>Contacts &amp; access</h3>
          {contact ? (
            <p className={styles.summary}>
              {contact.name.value} · {contact.role.value}
              <br />
              {contact.phone.value}
            </p>
          ) : (
            <p className={styles.summary}>Site contact and access details.</p>
          )}
          <Button
            type="button"
            variant="outline"
            className={styles.wide}
            onClick={() => navigate(PATHS.SURVEYOR_JOB_SITE_INFO(jobRef))}
          >
            Edit contacts &amp; access
          </Button>
        </Card>
      </div>

      {startFailed && <Callout tone="danger">The survey could not be started. Please try again.</Callout>}

      <div className={styles.actionBar}>
        <Button type="button" className={styles.wide} onClick={() => void handleStart()} disabled={starting}>
          {starting ? 'Starting…' : actionLabel}
        </Button>
      </div>
    </div>
  );
}
