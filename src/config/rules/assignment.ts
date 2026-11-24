// Assignment authorization rule — single source of truth (survey-workflow.agent.md).
// Do not duplicate or re-derive this logic anywhere else in the codebase.

import type { AssignmentActor, Job, TeamMembership } from '@/types/domain';

export function isJobLocked(job: Job): boolean {
  return job.status === 'submitted' || job.status === 'approved' || job.status === 'pending_qc';
}

export function canEditJob(currentUser: AssignmentActor, job: Job): boolean {
  const canRetryOwnEdit = job.dirty && job.pendingEditBy?.userId === currentUser.userId
    && job.pendingEditBy.role === currentUser.role;
  return (currentUser.role === 'Manager' || currentUser.role === 'TeamLead')
    && (canAssign(currentUser, job) || canRetryOwnEdit) && !isJobLocked(job);
}

export function canAssign(currentUser: AssignmentActor, job: Job): boolean {
  if (currentUser.role === 'Manager' || currentUser.role === 'TeamLead') return true;
  if (currentUser.userId === job.createdBy.userId) return true; // creator right
  if (job.assignedTo?.role === 'TeamLead' && currentUser.userId === job.assignedTo.userId) {
    return true; // the Team Lead a job is currently assigned to may re-assign it downward
  }
  return false;
}

export function validAssignmentTargets(
  currentUser: AssignmentActor,
  teamMembership: TeamMembership,
): AssignmentActor[] {
  if (currentUser.role === 'Manager') return teamMembership.allTeamLeads;
  if (currentUser.role === 'TeamLead') return teamMembership.surveyorsOf();
  return []; // Surveyors/QC/Designer never assign
}
