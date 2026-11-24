import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '@/store';
import { baseApi } from '@/api/baseApi';
import { jobsRepo } from '@/data/repos/jobsRepo';
import type { Job, TransitionAction } from '@/types/domain';
import { jobUpserted } from '@/features/jobs/jobsSlice';

interface TransitionInput {
  job: Job;
  action: TransitionAction;
  reason: string;
  comments?: string;
}

export const transitionJobLocalFirst = createAsyncThunk<
  Job,
  TransitionInput,
  { dispatch: AppDispatch; state: RootState }
>('review/transitionLocalFirst', async ({ job, action, reason, comments }, { dispatch, rejectWithValue }) => {
  const optimistic: Job = {
    ...job,
    status: action === 'approve' ? 'approved' : 'returned',
    attempt: job.attempt + 1,
    dirty: true,
    syncStatus: 'pending',
  };

  await jobsRepo.upsert(optimistic);
  dispatch(jobUpserted(optimistic));

  try {
    const result = await dispatch(
      baseApi.endpoints.transitionJob.initiate({ id: job.id, action, reason, comments }),
    ).unwrap();
    return result.job;
  } catch (err) {
    await jobsRepo.markDirty(job.id, true, 'failed');
    dispatch(jobUpserted({ ...optimistic, syncStatus: 'failed' }));
    return rejectWithValue(err instanceof Error ? err.message : 'Could not record the decision.');
  }
});
