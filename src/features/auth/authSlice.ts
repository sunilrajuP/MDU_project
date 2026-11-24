import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AssignmentActor, Role } from '@/types/domain';

export interface AuthState {
  userId: string | null;
  name: string | null;
  role: Role | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiry: string | null;
  hydrated: boolean;
}

const initialState: AuthState = {
  userId: null,
  name: null,
  role: null,
  accessToken: null,
  refreshToken: null,
  expiry: null,
  hydrated: false,
};

interface SessionPayload {
  userId: string;
  name: string;
  role: Role;
  accessToken: string;
  refreshToken?: string | null;
  expiry?: string | null;
}

function sessionReceived(state: AuthState, { payload }: PayloadAction<SessionPayload>) {
  state.userId = payload.userId;
  state.name = payload.name;
  state.role = payload.role;
  state.accessToken = payload.accessToken;
  state.refreshToken = payload.refreshToken ?? null;
  state.expiry = payload.expiry ?? null;
  state.hydrated = true;
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authHydrated: sessionReceived,
    loginSucceeded: sessionReceived,
    loggedOut() {
      return { ...initialState, hydrated: true };
    },
    authRehydrationFinished(state) {
      state.hydrated = true;
    },
  },
});

export const { authHydrated, loginSucceeded, loggedOut, authRehydrationFinished } = authSlice.actions;
export default authSlice.reducer;

export function selectCurrentActor(state: { auth: AuthState }): AssignmentActor | null {
  const { userId, role } = state.auth;
  return userId && role ? { userId, role } : null;
}

export function selectAuth(state: { auth: AuthState }): AuthState {
  return state.auth;
}
