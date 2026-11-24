import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ManagerLayout } from '@/features/manager/ManagerLayout';
import { ManagerDashboardPage } from '@/features/manager/ManagerDashboardPage';
import { CreateJobPage } from '@/features/createJob/CreateJobPage';
import { JobDetailsPage } from '@/features/jobs/JobDetailsPage';
import { SurveyorHome } from '@/features/stubs/SurveyorHome';
import { QcHome } from '@/features/stubs/QcHome';
import { DesignerHome } from '@/features/stubs/DesignerHome';
import { RequireRole } from './guards';
import { PATHS } from './paths';

export const router = createBrowserRouter([
  { path: PATHS.LOGIN, element: <LoginPage /> },

  {
    path: '/',
    element: (
      <RequireRole roles={['Manager', 'TeamLead']}>
        <ManagerLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to={PATHS.MANAGEMENT_DASHBOARD} replace /> },
      { path: PATHS.MANAGEMENT_DASHBOARD.slice(1), element: <ManagerDashboardPage /> },
      {
        path: PATHS.MANAGEMENT_CREATE_JOB.slice(1),
        element: <CreateJobPage backPath={PATHS.MANAGEMENT_DASHBOARD} />,
      },
      {
        path: PATHS.MANAGEMENT_EDIT_JOB_ROUTE.slice(1),
        element: <CreateJobPage backPath={PATHS.MANAGEMENT_DASHBOARD} />,
      },
      {
        path: PATHS.MANAGEMENT_JOB_DETAILS_ROUTE.slice(1),
        element: <JobDetailsPage backPath={PATHS.MANAGEMENT_DASHBOARD} />,
      },
    ],
  },

  // Out of scope for this task — stubbed only because nav/role-home already reference them.
  {
    path: PATHS.SURVEYOR_ROOT,
    element: (
      <RequireRole roles={['Surveyor']}>
        <SurveyorHome />
      </RequireRole>
    ),
  },
  {
    path: PATHS.QC_ROOT,
    element: (
      <RequireRole roles={['QC']}>
        <QcHome />
      </RequireRole>
    ),
  },
  {
    path: PATHS.DESIGNER_ROOT,
    element: (
      <RequireRole roles={['Designer']}>
        <DesignerHome />
      </RequireRole>
    ),
  },

  { path: '*', element: <Navigate to={PATHS.LOGIN} replace /> },
]);
