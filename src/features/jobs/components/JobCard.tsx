import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, ChevronRight } from 'lucide-react';
import type { Job } from '@/types/domain';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getDisplayJobStatus } from '@/features/jobs/jobStatus';
import { isJobLocked } from '@/config/rules/assignment';
import { formatDate } from '@/utils/date';
import styles from './JobCard.module.scss';

interface JobCardProps {
  job: Job;
  detailsPath: string;
  editPath?: string;
  assigneeTeamLead?: string;
  createdByName?: string;
  latestSurveyorName?: string;
}

export function JobCard({
  job,
  detailsPath,
  editPath,
  assigneeTeamLead,
  createdByName,
  latestSurveyorName,
}: JobCardProps) {
  const [addressHovered, setAddressHovered] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const creatorName = createdByName?.trim() || job.createdByName?.trim();
  const leadName = assigneeTeamLead ?? job.assigneeName
    ?? (job.leadAssignmentKnown === false ? 'Not available' : 'Unassigned');
  const updatedDate = job.updatedDate;
  const activityDate = updatedDate ?? job.createdDate;
  console.log(job,"jobss")
  const locked = isJobLocked(job);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {/* Left: identity + meta grid */}
        <div className={styles.main}>
          <div className={styles.identity}>
            <span className={styles.siteName} title={job.siteName}>{job.siteName}</span>
            <span
              className={styles.addressContainer}
              tabIndex={0}
              onMouseEnter={() => { setAddressHovered(true); setTooltipDismissed(false); }}
              onMouseLeave={() => setAddressHovered(false)}
              onFocus={() => { setAddressFocused(true); setTooltipDismissed(false); }}
              onBlur={() => setAddressFocused(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setTooltipDismissed(true);
              }}
            >
              <span className={styles.address}>{job.address}</span>
              {(addressHovered || addressFocused) && !tooltipDismissed && (
                <span className={styles.addressTooltip} role="tooltip" aria-hidden="true">{job.address}</span>
              )}
            </span>
          </div>

          {/* Two-column grid: left = created/dates, right = lead/surveyor */}
          <div className={styles.meta}>
            {/* Row 1 */}
            <span className={styles.schedule} title={`Created by: ${creatorName ?? "Not available"}`}>
              <strong className={styles.metaLabel}>Created by:</strong>{' '}
              <span className={styles.metaValue}>{creatorName ?? "Not available"}</span>
            </span>
            <span className={styles.schedule} title={`Lead: ${leadName}`}>
              <strong className={styles.metaLabel}>Lead:</strong>{' '}
              <span className={styles.metaValue}>{leadName}</span>
            </span>

            {/* Row 2 */}
            <span className={styles.schedule}>
              <strong className={styles.metaLabel}>
                {updatedDate ? 'Updated Date:' : 'Created Date:'}
              </strong>{' '}
              <span className={styles.metaValue}>
                {activityDate ? (
                  <time dateTime={activityDate}>{formatDate(activityDate)}</time>
                ) : (
                  "Not available"
                )}
              </span>
            </span>
            <span className={styles.schedule} title={`Surveyor: ${latestSurveyorName ?? '-'}`}>
              <strong className={styles.metaLabel}>Surveyor:</strong>{' '}
              <span className={styles.metaValue}>{latestSurveyorName ?? 'Unassigned'}</span>
            </span>

            {/* Row 3 */}
            <span className={styles.schedule}>
              <strong className={styles.metaLabel}>Scheduled Date:</strong>{' '}
              <span className={styles.metaValue}>
                {job.scheduledDate ? formatDate(job.scheduledDate) : 'Unscheduled'}
              </span>
            </span>
          </div>
        </div>

        {/* Right: status column, then edit button */}
        <div className={styles.side}>
          <div className={styles.statusColumn}>
            <StatusBadge status={getDisplayJobStatus(job)} />
          </div>

        </div>
      </div>

      {/* Bottom-right: navigate to site details */}
      <div className={styles.footer}>
        <Link
          to={detailsPath}
          className={styles.viewMore}
          aria-label={`View more details for ${job.siteName}`}
        >
          View More
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
        {editPath && !locked && (
          <Link
            to={editPath}
            className={styles.viewMore}
            aria-label={`Edit ${job.siteName}`}
          >
            <Pencil size={12} aria-hidden="true" />
            Edit Job 
            
          </Link>
        )}
      </div>
    </div>
  );
}