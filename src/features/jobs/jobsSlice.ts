import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Job } from '@/types/domain';

interface JobsState {
  entities: Record<string, Job>;
  hydrated: boolean;
  syncing: boolean;
  workerError?: string;
}

const initialState: JobsState = {
  entities: {},
  hydrated: false,
  syncing: false,
};

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    jobsHydrated(state, action: PayloadAction<Job[]>) {
      state.entities = Object.fromEntries(action.payload.map((j) => [j.id, j]));
      state.hydrated = true;
    },
    jobsReplaced(state, action: PayloadAction<Job[]>) {
      state.entities = Object.fromEntries(action.payload.map((j) => [j.id, j]));
    },
    jobsUpserted(state, action: PayloadAction<Job[]>) {
      for (const job of action.payload) {
        state.entities[job.id] = job;
      }
    },
    jobUpserted(state, action: PayloadAction<Job>) {
      state.entities[action.payload.id] = action.payload;
    },
    jobSyncCompleted(state, action: PayloadAction<{ previousId: string; job: Job }>) {
      delete state.entities[action.payload.previousId];
      state.entities[action.payload.job.id] = action.payload.job;
    },
    syncStarted(state) {
      state.syncing = true;
      state.workerError = undefined;
    },
    syncFinished(state, action: PayloadAction<string | undefined>) {
      state.syncing = false;
      state.workerError = action.payload;
    },
  },
});

export const {
  jobsHydrated, jobsReplaced, jobsUpserted, jobUpserted, jobSyncCompleted, syncStarted, syncFinished,
} = jobsSlice.actions;
export default jobsSlice.reducer;

export function selectAllJobs(state: { jobs: JobsState }): Job[] {
  return Object.values(state.jobs.entities);
}

export function selectJobById(state: { jobs: JobsState }, id: string): Job | undefined {
  return state.jobs.entities[id] ?? Object.values(state.jobs.entities).find((job) => job.clientId === id);
}

export function selectJobByJobRefOrId(state: { jobs: JobsState }, jobRefOrId: string): Job | undefined {
  const jobs = Object.values(state.jobs.entities);
  return jobs.find((job) => job.jobRef === jobRefOrId) ?? selectJobById(state, jobRefOrId);
}
