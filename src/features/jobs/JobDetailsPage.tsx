import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useGetJobQuery, useGetJobsQuery } from '@/api/baseApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAllUsers } from '@/features/teamlead/teamSlice';
import { selectJobByJobRefOrId } from '@/features/jobs/jobsSlice';
import { getDisplayJobStatus } from '@/features/jobs/jobStatus';
import { transitionJobLocalFirst } from '@/features/review/reviewThunks';
import { ApproveReturnDialog } from '@/features/review/ApproveReturnDialog';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/utils/date';
import type { TransitionAction } from '@/types/domain';
import styles from './JobDetailsPage.module.scss';





interface JobDetailsPageProps {
  backPath: string;
}

/** basement 2, above ground 12 -> "B2 / B1 / GF / L1–12" */
function formatFloors(basement = 0, above = 0): string {
  const parts: string[] = [];
  for (let i = basement; i >= 1; i--) parts.push(`B${i}`);
  parts.push('GF');
  if (above === 1) parts.push('L1');
  else if (above > 1) parts.push(`L1–${above}`);
  return parts.join(' / ');
}

export function JobDetailsPage({ backPath }: JobDetailsPageProps) {
  const { jobRef = '' } = useParams();
  const users = useAppSelector(selectAllUsers);
  const job = useAppSelector((state) => selectJobByJobRefOrId(state, jobRef));
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useGetJobsQuery();
  useGetJobQuery(job?.id ?? '', { skip: !job, refetchOnMountOrArgChange: true });


  const [transitionAction, setTransitionAction] = useState<TransitionAction | null>(null);
  const [transitionError, setTransitionError] = useState<string>();
  const [transitioning, setTransitioning] = useState(false);

  if (!job) return <p className={styles.empty}>Loading job…</p>;

  const leadName =
    job.assigneeName ?? (job.assignedTo?.role === 'TeamLead'
      ? users.find((u) => u.id === job.assignedTo?.userId)?.name : undefined) ?? 'Unassigned';
  const surveyorName = job.latestSurveyorName ?? 'Unassigned';


  async function handleTransition(reason: string, comments: string) {
    if (!job || !transitionAction) return;
    setTransitioning(true);
    setTransitionError(undefined);
    try {
      await dispatch(transitionJobLocalFirst({ job, action: transitionAction, reason, comments })).unwrap();
      setTransitionAction(null);
    } catch (err) {
      setTransitionError(typeof err === 'string' ? err : 'Could not record the decision.');
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Job summary */}
      <div className={styles.footerInner}>
        <Link
          to={backPath}
          className={styles.backLink}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            void navigate(-1);
          }}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Back
        </Link>
      </div>
      <Card className={styles.card}>
        <div className={styles.identityRow}>
          <div>
            <span className={styles.code}>Site/Job Name</span>
            <h2 className={styles.siteName}>{job.siteName}</h2>
          </div>
          <div>
            <StatusBadge status={getDisplayJobStatus(job)} />
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div>
            <span className={styles.label}>Created by</span>
            <p className={styles.value}>{job.createdByName ?? 'Not available'}</p>
          </div>
          <div>
            <span className={styles.label}>Lead</span>
            <p className={styles.value}>{leadName}</p>
          </div>
          <div>
            <span className={styles.label}>Created Date</span>
            <p className={styles.value}>{formatDate(job.createdDate) ?? "-"}</p>
          </div>
          <div>
            <span className={styles.label}>Updated date</span>
            <p className={styles.value}>{formatDate(job.updatedDate) ?? "-"}</p>
          </div>
          <div>
            <span className={styles.label}>Scheduled date</span>
            <p className={styles.value}>
              {job.scheduledDate ? formatDate(job.scheduledDate) : 'Unscheduled'}
            </p>
          </div>
        </div>
        <div>
          <span className={styles.label}>Comments</span>
          <p className={styles.value}>
            {job.siteDetails.notes || '—'}
          </p>
        </div>
      </Card>

      {/* Site information */}
      {/* Site information */}
      <Card className={styles.card}>
        <h3 className={styles.cardTitle}>Site information</h3>

        <p className={styles.address}>{job.address}</p>

        <hr className={styles.divider} />

        <div className={styles.infoGrid}>
          <div>
            <span className={styles.label}>Building name</span>
            <p className={styles.value}>{job.buildingName || '—'}</p>
          </div>
          <div>
            <span className={styles.label}>Basement levels</span>
            <p className={styles.value}>{job.basementLevels ?? '—'}</p>
          </div>
          <div>
            <span className={styles.label}>Floors</span>
            <p className={styles.value}>
              {formatFloors(job.basementLevels, job.floorsAboveGround)}
            </p>
          </div>
          <div>
            <span className={styles.label}>EUP</span>
            <p className={styles.value}>{job.eupCount ?? '—'}</p>
          </div>
        </div>
      </Card>

      {/* Surveyor */}
      <Card className={styles.card}>
        <h3 className={styles.cardTitle}>Surveyor</h3>
        <div className={styles.infoGrid}>
          <div>
            <span className={styles.label}>Assigned to</span>
            <p className={styles.value}>{surveyorName}</p>
          </div>
        </div>
      </Card>

      {transitionAction && (
        <ApproveReturnDialog
          action={transitionAction}
          submitting={transitioning}
          errorMessage={transitionError}
          onConfirm={handleTransition}
          onClose={() => setTransitionAction(null)}
        />
      )}
    </div>
  );
}