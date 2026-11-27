import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { useConfirmSiteLocationMutation, useGetSurveyorJobQuery } from '@/api/surveyorApi';
import { PATHS } from '@/app/paths';
import { SiteMap, type Basemap } from './SiteMap';
import styles from './MapPage.module.scss';

export function MapPage() {
  const { jobRef = '' } = useParams();
  const navigate = useNavigate();
  const { data: job, isLoading, isError } = useGetSurveyorJobQuery(jobRef);
  const [confirmLocation, { isLoading: confirming, isError: confirmFailed }] = useConfirmSiteLocationMutation();
  const [basemap, setBasemap] = useState<Basemap>('terrain');

  if (isLoading) return <p role="status">Loading map…</p>;
  if (isError || !job) {
    return (
      <Callout tone="danger">
        This job could not be found. <Link to={PATHS.SURVEYOR_ROOT}>Back to My Jobs</Link>
      </Callout>
    );
  }

  async function handleConfirm() {
    if (!job) return;
    try {
      await confirmLocation({
        jobRef,
        clientRequestId: crypto.randomUUID(),
        latitude: job.location.latitude,
        longitude: job.location.longitude,
        accuracyM: job.location.accuracyM,
        capturedAt: new Date().toISOString(),
      }).unwrap();
    } catch {
      return;
    }
    navigate(PATHS.SURVEYOR_JOB_OVERVIEW(jobRef));
  }

  return (
    <div className={styles.page}>
      <SiteMap
        jobRef={job.jobRef}
        variant="full"
        basemap={basemap}
        onBasemapChange={setBasemap}
        location={job.location.latitude || job.location.longitude ? job.location : undefined}
      />
      {confirmFailed && <Callout tone="danger">The site location could not be confirmed. Please try again.</Callout>}
      <div className={styles.actionBar}>
        <Button type="button" className={styles.wide} onClick={() => void handleConfirm()} disabled={confirming}>
          {confirming ? 'Confirming…' : 'Confirm Site Location'}
        </Button>
      </div>
    </div>
  );
}
