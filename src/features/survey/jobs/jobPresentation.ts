import { PATHS } from '@/app/paths';
import type { JobDisplayStatus } from '@/types/domain';
import type { SurveyorJobStatus, SurveyorJobSummary } from '@/types/surveyor';

/** Reuses the shared StatusBadge by mapping Surveyor job states onto its display statuses. */
export const DISPLAY_STATUS: Record<SurveyorJobStatus, JobDisplayStatus> = {
  not_started: 'assigned_surveyor',
  in_progress: 'in_progress',
  returned: 'returned',
  submitted: 'pending_qc',
};

export interface JobAction {
  label: string;
  to: string;
}

/**
 * The card button. Not started jobs go through the Job Overview (location + contacts) first;
 * started and returned jobs resume straight in the runbook. Submitted jobs have no action.
 */
export function jobAction(job: SurveyorJobSummary): JobAction | null {
  switch (job.status) {
    case 'not_started':
      return { label: 'Start Survey', to: PATHS.SURVEYOR_JOB_OVERVIEW(job.jobRef) };
    case 'in_progress':
      return { label: 'Continue Survey', to: PATHS.SURVEYOR_JOB_RUNBOOK(job.jobRef) };
    case 'returned':
      return { label: 'Rework', to: PATHS.SURVEYOR_JOB_RUNBOOK(job.jobRef) };
    default:
      return null;
  }
}
