import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ManagerLayout } from '@/features/manager/ManagerLayout';
import { ManagerDashboardPage } from '@/features/manager/ManagerDashboardPage';
import { CreateJobPage } from '@/features/createJob/CreateJobPage';
import { JobDetailsPage } from '@/features/jobs/JobDetailsPage';
import { SurveyorLayout } from '@/features/survey/layout/SurveyorLayout';
import { RunbookPage } from '@/features/survey/runbook/RunbookPage';
import { MyJobsPage } from '@/features/survey/jobs/MyJobsPage';
import { JobOverviewPage } from '@/features/survey/overview/JobOverviewPage';
import { MapPage } from '@/features/survey/overview/MapPage';
import { SiteInfoPage } from '@/features/survey/siteinfo/SiteInfoPage';
import { AccountPage } from '@/features/survey/account/AccountPage';
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

  // The runbook has its own header (back arrow + connection pill), so it sits outside SurveyorLayout.
  {
    path: PATHS.SURVEYOR_JOB_RUNBOOK_ROUTE,
    element: (
      <RequireRole roles={['Surveyor']}>
        <RunbookPage />
      </RequireRole>
    ),
  },
  {
    path: PATHS.SURVEYOR_ROOT,
    element: (
      <RequireRole roles={['Surveyor']}>
        <SurveyorLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <MyJobsPage /> },
      { path: PATHS.SURVEYOR_ACCOUNT.slice(PATHS.SURVEYOR_ROOT.length + 1), element: <AccountPage /> },
      {
        path: PATHS.SURVEYOR_JOB_OVERVIEW_ROUTE.slice(PATHS.SURVEYOR_ROOT.length + 1),
        element: <JobOverviewPage />,
      },
      {
        path: PATHS.SURVEYOR_JOB_MAP_ROUTE.slice(PATHS.SURVEYOR_ROOT.length + 1),
        element: <MapPage />,
      },
      {
        path: PATHS.SURVEYOR_JOB_SITE_INFO_ROUTE.slice(PATHS.SURVEYOR_ROOT.length + 1),
        element: <SiteInfoPage />,
      },
      { path: '*', element: <Navigate to={PATHS.SURVEYOR_ROOT} replace /> },
    ],
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
