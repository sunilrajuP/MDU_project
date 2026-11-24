// Rehydration-on-load — standing rule H1: Dexie is the source of truth, Redux is a reflection of it.

import type { AppDispatch } from '@/store';
import { jobsRepo } from '../repos/jobsRepo';
import { usersRepo } from '../repos/usersRepo';
import { authRepo } from '../repos/authRepo';
import { jobsHydrated } from '@/features/jobs/jobsSlice';
import { usersHydrated } from '@/features/teamlead/teamSlice';
import { authHydrated, loggedOut } from '@/features/auth/authSlice';

/** Runs once on app start (and again after any job route load) to restore Redux from Dexie. */
export async function runHydrators(dispatch: AppDispatch): Promise<void> {
  const [jobs, users, session] = await Promise.all([
    jobsRepo.getAll(),
    usersRepo.getAll(),
    authRepo.get(),
  ]);

  dispatch(jobsHydrated(jobs));
  dispatch(usersHydrated(users));
  if (session) {
    dispatch(
      authHydrated({
        userId: session.userId,
        name: session.name,
        role: session.role,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiry: session.expiry,
      }),
    );
  } else {
    dispatch(loggedOut());
  }
}
