import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/api/baseApi';
import { surveyorApi } from '@/api/surveyorApi';
import authReducer from '@/features/auth/authSlice';
import jobsReducer from '@/features/jobs/jobsSlice';
import teamReducer from '@/features/teamlead/teamSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    jobs: jobsReducer,
    team: teamReducer,
    [baseApi.reducerPath]: baseApi.reducer,
    [surveyorApi.reducerPath]: surveyorApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware, surveyorApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
