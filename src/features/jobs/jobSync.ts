import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import { baseApi } from '@/api/baseApi';
import { authRepo } from '@/data/repos/authRepo';
import { jobSyncRepo } from '@/data/repos/jobSyncRepo';
import { selectCurrentActor } from '@/features/auth/authSlice';
import { jobSyncCompleted, jobUpserted, syncFinished, syncStarted } from './jobsSlice';

export const syncPendingJobs = (): ThunkAction<Promise<void>, RootState, unknown, UnknownAction> =>
  async (dispatch, getState) => {
    if (getState().jobs.syncing || !navigator.onLine) return;
    const actor = selectCurrentActor(getState());
    if (!actor || (actor.role !== 'Manager' && actor.role !== 'TeamLead')) return;
    dispatch(syncStarted());
    let workerError: string | undefined;
    try {
      while (navigator.onLine) {
        const session = await authRepo.get();
        const currentActor = selectCurrentActor(getState());
        if (session?.userId !== actor.userId || session.role !== actor.role
          || currentActor?.userId !== actor.userId || currentActor.role !== actor.role) break;
        const entry = await jobSyncRepo.claim(actor);
        if (!entry) break;
        let response;
        try {
          if (entry.kind === 'create') {
            response = await dispatch(baseApi.endpoints.createJob.initiate({
              ...entry.createRequest!,
              clientRequestId: entry.clientRequestId, localJobId: entry.entityId,
            })).unwrap();
          } else if (Object.keys(entry.changes).length === 1
            && entry.changes.assignedSurveyorId !== undefined) {
            response = await dispatch(baseApi.endpoints.reassignJob.initiate({
              id: entry.entityId,
              assignedSurveyorId: entry.changes.assignedSurveyorId,
            })).unwrap();
          } else {
            response = await dispatch(baseApi.endpoints.updateJob.initiate({
              ...entry.changes, id: entry.entityId,
            })).unwrap();
          }
        } catch (failure) {
          const status = failure && typeof failure === 'object' && 'status' in failure
            && typeof failure.status === 'number' ? failure.status : 0;
          const message = failure && typeof failure === 'object' && 'message' in failure
            && typeof failure.message === 'string' ? failure.message : 'Job sync failed.';
          const job = await jobSyncRepo.fail(entry, message, (status >= 400 && status < 500) || status === 501);
          dispatch(jobUpserted(job));
          continue;
        }
        const job = await jobSyncRepo.complete(entry, response);
        dispatch(jobSyncCompleted({ previousId: entry.entityId, job }));
      }
    } catch (failure) {
      workerError = failure instanceof Error ? failure.message : 'Could not access locally saved jobs.';
    } finally {
      dispatch(syncFinished(workerError));
    }
  };
