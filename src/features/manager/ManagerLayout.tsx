import { useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { LayoutGrid, PlusCircle } from 'lucide-react';
import { AppShell } from '@/layouts/AppShell';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loggedOut, selectAuth } from '@/features/auth/authSlice';
import { authRepo } from '@/data/repos/authRepo';
import { baseApi, useLogoutMutation } from '@/api/baseApi';
import { PATHS } from '@/app/paths';

const DEFAULT_TITLE = 'Site/Job Overview';

export function ManagerLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const auth = useAppSelector(selectAuth);
  const [logout] = useLogoutMutation();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const signOutPending = useRef(false);
  const isTeamLead = auth.role === 'TeamLead';

  const dashboardPath = PATHS.MANAGEMENT_DASHBOARD;
  const createPath = PATHS.MANAGEMENT_CREATE_JOB;

  // Order matters: put more specific patterns before general ones.
  const titleRoutes: { path: string; title: string }[] = [
    { path: createPath, title: 'Create Job' },
    { path: dashboardPath, title: 'Site/Job Overview' },
    { path: PATHS.MANAGEMENT_EDIT_JOB_ROUTE, title: 'Edit Job' },
    { path: PATHS.MANAGEMENT_JOB_DETAILS_ROUTE, title: 'Job Details' },
  ];

  const title =
    titleRoutes.find((r) => matchPath({ path: r.path, end: true }, pathname))?.title ??
    DEFAULT_TITLE;

  async function handleSignOut() {
    if (signOutPending.current) return;
    signOutPending.current = true;
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

      if (!await authRepo.replaceIfCurrent(session, null)) {
        setSignOutError('The session changed while signing out. Please try again.');
        return;
      }
      navigate(PATHS.LOGIN, { replace: true, state: warning ? { signOutWarning: warning } : null });
      dispatch(loggedOut());
      dispatch(baseApi.util.resetApiState());
    } catch {
      setSignOutError('Unable to clear the saved session. Please try signing out again.');
    } finally {
      signOutPending.current = false;
      setSigningOut(false);
    }
  }

  const navItems = [
    { to: dashboardPath, label: 'Dashboard', icon: <LayoutGrid size={20} />, end: true },
    { to: createPath, label: 'Create Job', icon: <PlusCircle size={20} /> },
  ];

  const bottomNavItems = [
    { to: dashboardPath, label: 'Dashboard', icon: <LayoutGrid size={20} />, end: true },
    { to: createPath, label: 'Create', icon: <PlusCircle size={20} /> },
  ];

  return (
    <NotificationProvider>
      <AppShell
        title={title}
        roleLabel={isTeamLead ? 'Team Lead' : 'Manager'}
        userName={auth.name ?? ''}
        navItems={navItems}
        bottomNavItems={bottomNavItems}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      >
        {signOutError && <p role="alert">{signOutError}</p>}
        <Outlet />
      </AppShell>
    </NotificationProvider>
  );
}