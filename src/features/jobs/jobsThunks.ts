import { createAsyncThunk } from '@reduxjs/toolkit';
import { baseApi } from '@/api/baseApi';
import type { AppDispatch, RootState } from '@/store';
import { jobsRepo } from '@/data/repos/jobsRepo';
import { canAssign, canEditJob, isJobLocked, validAssignmentTargets } from '@/config/rules/assignment';
import { selectCurrentActor } from '@/features/auth/authSlice';
import { selectAllUsers, selectTeamMembership } from '@/features/teamlead/teamSlice';
import type { AssignmentActor, Job, SiteDetails } from '@/types/domain';
import { jobUpserted, selectJobById } from './jobsSlice';
import { syncPendingJobs } from './jobSync';
import type { JobChanges } from '@/types/jobSync';

async function saveAndSync(job: Job, changes: JobChanges, dispatch: AppDispatch): Promise<Job> {
  const saved = await jobsRepo.saveLocal(job, changes);
  dispatch(jobUpserted(saved));
  await dispatch(syncPendingJobs());
  const result = (await jobsRepo.getById(saved.id))
    ?? (saved.clientId ? await jobsRepo.getByClientId(saved.clientId) : undefined);
  if (!result) throw new Error('The saved job could not be loaded from this device.');
  return result;
}

async function cacheConfirmedJob(job: Job, dispatch: AppDispatch): Promise<Job> {
  await jobsRepo.upsert(job);
  dispatch(jobUpserted(job));
  return job;
}

interface CreateJobInput {
  siteName: string;
  siteAddress: string;
  latitude?: number;
  longitude?: number;
  scheduledDate: string;
  assignedSurveyorId: number | null;
  notes: string;
  request?: { id: string; createdDate: string };
}

export const createJob = createAsyncThunk<
  Job,
  CreateJobInput,
  { dispatch: AppDispatch; state: RootState }
>('jobs/create', async (input, { dispatch, getState, rejectWithValue }) => {
  const state = getState();
  const actor = selectCurrentActor(state);
  if (!actor || (actor.role !== 'Manager' && actor.role !== 'TeamLead')) {
    return rejectWithValue('You are not permitted to create a job.');
  }
  if (!navigator.onLine) return rejectWithValue('Connect to the internet to create a job.');
  if (!input.siteName.trim() || !input.siteAddress.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)) {
    return rejectWithValue('Enter a site name, address, and valid scheduled date.');
  }
  if (input.assignedSurveyorId !== null && (
    !Number.isSafeInteger(input.assignedSurveyorId) || input.assignedSurveyorId <= 0 ||
    !validAssignmentTargets(actor, selectTeamMembership(state)).some(
      (candidate) => candidate.userId === String(input.assignedSurveyorId),
    )
  )) {
    return rejectWithValue('Select an eligible assignee.');
  }
  const assignedTo = input.assignedSurveyorId === null ? undefined
    : validAssignmentTargets(actor, selectTeamMembership(state)).find(
      (candidate) => candidate.userId === String(input.assignedSurveyorId),
    );
  const createdBy = state.auth.name?.trim() || undefined;
  const server = await dispatch(baseApi.endpoints.createJob.initiate({
    siteName: input.siteName.trim(), siteAddress: input.siteAddress.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    scheduledDate: input.scheduledDate,
    createdDate: input.request?.createdDate ?? new Date().toISOString(),
    createdBy,
    assignedSurveyorId: input.assignedSurveyorId,
    comments: input.notes,
    clientRequestId: input.request?.id ?? crypto.randomUUID(),
  }, { track: false })).unwrap();
  const confirmedAssignment = actor.role === 'TeamLead' ? server.assignedSurveyor : server.assignedTo;
  const confirmedTarget = assignedTo && confirmedAssignment?.userId === assignedTo.userId ? assignedTo : undefined;
  return cacheConfirmedJob({
    ...server,
    createdByName: server.createdByName ?? createdBy,
    assigneeName: actor.role === 'TeamLead' ? server.assigneeName : server.assigneeName ?? (confirmedTarget
      ? selectAllUsers(state).find((user) => user.id === confirmedTarget.userId)?.name : undefined),
    latestSurveyorName: server.latestSurveyorName ?? (actor.role === 'TeamLead' && confirmedTarget
      ? selectAllUsers(state).find((user) => user.id === confirmedTarget.userId)?.name : undefined),
    assignmentHistory: confirmedTarget ? [{
      byUserId: actor.userId, byRole: actor.role,
      toUserId: confirmedTarget.userId, toRole: confirmedTarget.role, timestamp: server.updatedAt,
    }] : server.assignmentHistory,
  }, dispatch);
});

interface AssignJobInput {
  job: Job;
  assignedTo: AssignmentActor;
  actor: AssignmentActor;
}

export const assignJobLocalFirst = createAsyncThunk<
  Job,
  AssignJobInput,
  { dispatch: AppDispatch; state: RootState }
>('jobs/assignLocalFirst', async ({ job: requestedJob, assignedTo, actor }, { dispatch, getState, rejectWithValue }) => {
  const currentActor = selectCurrentActor(getState());
  const job = selectJobById(getState(), requestedJob.id);
  if (!job || !currentActor || currentActor.userId !== actor.userId || currentActor.role !== actor.role
    || !canAssign(actor, job)) {
    return rejectWithValue('You are not permitted to assign this job.');
  }
  if (isJobLocked(job)) {
    return rejectWithValue('Job is already submitted/approved and cannot be reassigned.');
  }
  if (
    !Number.isSafeInteger(Number(assignedTo.userId)) || Number(assignedTo.userId) <= 0 ||
    !validAssignmentTargets(actor, selectTeamMembership(getState())).some(
      (candidate) => candidate.userId === assignedTo.userId && candidate.role === assignedTo.role,
    )
  ) {
    return rejectWithValue('Select an eligible assignee.');
  }

  const optimistic: Job = {
    ...job,
    ...(actor.role === 'TeamLead'
      ? { assignedSurveyor: assignedTo,
          latestSurveyorName: selectAllUsers(getState()).find((user) => user.id === assignedTo.userId)?.name }
      : { assignedTo, assigneeName: selectAllUsers(getState()).find((user) => user.id === assignedTo.userId)?.name }),
    status: actor.role === 'TeamLead'
      && !['new', 'YetToAssign', 'assigned_teamlead', 'assigned_surveyor'].includes(job.status)
      ? job.status : assignedTo.role === 'TeamLead' ? 'assigned_teamlead' : 'assigned_surveyor',
    assignmentHistory: [
      ...job.assignmentHistory,
      { byUserId: actor.userId, byRole: actor.role, toUserId: assignedTo.userId, toRole: assignedTo.role, timestamp: new Date().toISOString() },
    ],
    dirty: true,
    syncStatus: 'pending',
    pendingEditBy: actor,
  };

  return saveAndSync(optimistic, { assignedSurveyorId: Number(assignedTo.userId) }, dispatch);
});

interface EditJobInput {
  id: string;
  siteName: string;
  siteAddress: string;
  latitude?: number;
  longitude?: number;
  scheduledDate: string;
  notes: string;
  /** undefined keeps the existing assignment; null explicitly unassigns it. */
  assignedTo?: AssignmentActor | null;
}

export const editJob = createAsyncThunk<
  Job,
  EditJobInput,
  { dispatch: AppDispatch; state: RootState }
>('jobs/edit', async (input, { dispatch, getState, rejectWithValue }) => {
  const state = getState();
  const job = selectJobById(state, input.id);
  const actor = selectCurrentActor(state);
  if (!job || !actor || !canEditJob(actor, job)) {
    return rejectWithValue('You are not permitted to edit this job, or it is locked for review.');
  }
  if (!navigator.onLine) return rejectWithValue('Connect to the internet to edit a job.');
  if (job.dirty) return rejectWithValue('Wait for pending job changes to sync before editing.');
  if (!input.siteName.trim() || !input.siteAddress.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)) {
    return rejectWithValue('Enter a site name, address, and valid scheduled date.');
  }
  const target = input.assignedTo;
  const assignedSurveyorId = target === undefined ? undefined : target ? Number(target.userId) : null;
  if (target && (
    !Number.isSafeInteger(Number(target.userId)) || Number(target.userId) <= 0 ||
    !validAssignmentTargets(actor, selectTeamMembership(state)).some(
      (candidate) => candidate.userId === target.userId && candidate.role === target.role,
    )
  )) {
    return rejectWithValue('Select an eligible assignee.');
  }

  const server = await dispatch(baseApi.endpoints.updateJob.initiate({
    id: job.id,
    siteName: input.siteName.trim(),
    siteAddress: input.siteAddress.trim(),
    scheduledDate: input.scheduledDate,
    comments: input.notes,
    updatedDate: new Date().toISOString(),
    ...(assignedSurveyorId !== undefined ? { assignedSurveyorId } : {}),
  }, { track: false })).unwrap();
  const confirmedAssignment = actor.role === 'TeamLead' ? server.assignedSurveyor : server.assignedTo;
  const previousAssignment = actor.role === 'TeamLead' ? job.assignedSurveyor : job.assignedTo;
  const confirmedTarget = target && confirmedAssignment?.userId === target.userId ? target : undefined;
  const changedAssignment = confirmedTarget
    && (confirmedTarget.userId !== previousAssignment?.userId || confirmedTarget.role !== previousAssignment?.role);
  return cacheConfirmedJob({
    ...server,
    latitude: server.latitude ?? (server.address === input.siteAddress.trim() ? input.latitude : undefined),
    longitude: server.longitude ?? (server.address === input.siteAddress.trim() ? input.longitude : undefined),
    assignedTo: actor.role === 'TeamLead' ? server.assignedTo : confirmedTarget ?? server.assignedTo,
    assignedSurveyor: actor.role === 'TeamLead' ? confirmedTarget ?? server.assignedSurveyor : server.assignedSurveyor,
    assigneeName: actor.role === 'TeamLead' ? server.assigneeName : server.assigneeName ?? (confirmedTarget
      ? selectAllUsers(state).find((user) => user.id === confirmedTarget.userId)?.name : undefined),
    latestSurveyorName: server.latestSurveyorName ?? (actor.role === 'TeamLead' && confirmedTarget
      ? selectAllUsers(state).find((user) => user.id === confirmedTarget.userId)?.name : undefined),
    assignmentHistory: changedAssignment ? [...server.assignmentHistory, {
      byUserId: actor.userId, byRole: actor.role,
      toUserId: confirmedTarget.userId, toRole: confirmedTarget.role, timestamp: server.updatedAt,
    }] : server.assignmentHistory,
  }, dispatch);
});

interface EditSiteDetailsInput {
  job: Job;
  siteDetails: Partial<SiteDetails>;
}

export const editSiteDetailsLocalFirst = createAsyncThunk<
  Job,
  EditSiteDetailsInput,
  { dispatch: AppDispatch; state: RootState }
>('jobs/editSiteDetailsLocalFirst', async ({ job, siteDetails }, { dispatch, getState, rejectWithValue }) => {
  const actor = selectCurrentActor(getState());
  if (!actor || !canEditJob(actor, job)) {
    return rejectWithValue('You are not permitted to edit this job.');
  }
  if (isJobLocked(job)) {
    return rejectWithValue('Job is already submitted/approved and cannot be edited.');
  }

  const optimistic: Job = {
    ...job,
    siteDetails: { ...job.siteDetails, ...siteDetails },
    dirty: true,
    syncStatus: 'pending',
    pendingEditBy: actor,
  };

  return saveAndSync(optimistic, { siteDetails }, dispatch);
});
