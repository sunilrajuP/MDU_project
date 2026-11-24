import type { AssignmentActor, Job, JobCounts, JobDisplayStatus } from '@/types/domain';

export function isJobOverdue(job: Job): boolean {
  if (!job.scheduledDate || job.status === 'submitted') return false;

  const scheduledDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(job.scheduledDate);
  if (!scheduledDate) return false;

  const scheduledDay = new Date(
    Number(scheduledDate[1]),
    Number(scheduledDate[2]) - 1,
    Number(scheduledDate[3]),
  );
  if (
    scheduledDay.getFullYear() !== Number(scheduledDate[1])
    || scheduledDay.getMonth() !== Number(scheduledDate[2]) - 1
    || scheduledDay.getDate() !== Number(scheduledDate[3])
  ) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return scheduledDay < today;
}

export function getDisplayJobStatus(job: Job): JobDisplayStatus {
  return isJobOverdue(job) ? 'overdue' : job.status;
}

/** Management roles share access to the jobs returned by the backend. */
export function scopeJobsToActor(jobs: Job[], actor: AssignmentActor | null): Job[] {
  if (!actor) return [];
  if (actor.role === 'Manager' || actor.role === 'TeamLead') return jobs;
  return [];
}

/** Approved jobs are excluded from the dashboard total per the Figma "Approved excluded" caption. */
export function computeJobCounts(jobs: Job[]): JobCounts {
  const visible = jobs.filter((j) => j.status !== 'approved');
  return {
    total: visible.length,
    new: visible.filter((j) => j.status === 'new' && !isJobOverdue(j)).length,
    assigned: visible.filter((j) => (j.status === 'assigned_teamlead' || j.status === 'assigned_surveyor') && !isJobOverdue(j)).length,
    inProgress: visible.filter((j) => j.status === 'in_progress').length,
    submitted: visible.filter((j) => j.status === 'submitted' || j.status === 'pending_qc').length,
    returned: visible.filter((j) => j.status === 'returned').length,
    approved: jobs.filter((j) => j.status === 'approved').length,
  };
}
