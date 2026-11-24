import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/types/domain';
import { useAppSelector } from '@/store/hooks';
import { selectAuth } from '@/features/auth/authSlice';
import { PATHS } from './paths';

/** Convenience-only RBAC gating — the backend remains the authority. */
export function roleHome(role: Role | null): string {
  switch (role) {
    case 'Manager':
    case 'TeamLead':
      return PATHS.MANAGEMENT_DASHBOARD;
    case 'Surveyor':
      return PATHS.SURVEYOR_ROOT;
    case 'QC':
      return PATHS.QC_ROOT;
    case 'Designer':
      return PATHS.DESIGNER_ROOT;
    default:
      return PATHS.LOGIN;
  }
}

export function RequireAuth({ children }: PropsWithChildren) {
  const auth = useAppSelector(selectAuth);
  const location = useLocation();

  if (!auth.hydrated) return null;
  if (!auth.userId) return <Navigate to={PATHS.LOGIN} state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: PropsWithChildren<{ roles: Role[] }>) {
  const auth = useAppSelector(selectAuth);

  if (!auth.hydrated) return null;
  if (!auth.userId) return <Navigate to={PATHS.LOGIN} replace />;
  if (!auth.role || !roles.includes(auth.role)) return <Navigate to={roleHome(auth.role)} replace />;
  return <>{children}</>;
}
