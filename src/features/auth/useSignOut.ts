import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks';
import { loggedOut } from '@/features/auth/authSlice';
import { authRepo } from '@/data/repos/authRepo';
import { baseApi, useLogoutMutation } from '@/api/baseApi';
import { surveyorApi } from '@/api/surveyorApi';
import { PATHS } from '@/app/paths';

/**
 * Sign-out flow shared by non-Manager layouts. Mirrors ManagerLayout's behaviour (revoke the refresh token,
 * clear the saved session only if it is still the current one, then reset cached API state).
 */
export function useSignOut() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const pending = useRef(false);

  async function signOut() {
    if (pending.current) return;
    pending.current = true;
    setSigningOut(true);
    setSignOutError('');
    try {
      const session = await authRepo.get();
      if (!session) {
        setSignOutError('Unable to find the saved session. Please reload and try again.');
        return;
      }

      let warning = '';
      if (session.refreshToken) {
        try {
          await logout({ refreshToken: session.refreshToken }).unwrap();
        } catch {
          warning = 'Signed out on this device, but the server session could not be revoked.';
        }
      } else {
        warning = 'Signed out on this device, but the server session could not be revoked because the refresh token is missing.';
      }

      if (!(await authRepo.replaceIfCurrent(session, null))) {
        setSignOutError('The session changed while signing out. Please try again.');
        return;
      }
      navigate(PATHS.LOGIN, { replace: true, state: warning ? { signOutWarning: warning } : null });
      dispatch(loggedOut());
      dispatch(baseApi.util.resetApiState());
      dispatch(surveyorApi.util.resetApiState());
    } catch {
      setSignOutError('Unable to clear the saved session. Please try signing out again.');
    } finally {
      pending.current = false;
      setSigningOut(false);
    }
  }

  return { signOut, signingOut, signOutError };
}
