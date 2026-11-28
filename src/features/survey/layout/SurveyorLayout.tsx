import { Link, Outlet, matchPath, useLocation } from 'react-router-dom';
import { skipToken } from '@reduxjs/toolkit/query';
import { ArrowLeft, BriefcaseBusiness, ListChecks, UserRound } from 'lucide-react';
import { AppShell, type NavItem } from '@/layouts/AppShell';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { useAppSelector } from '@/store/hooks';
import { selectAuth } from '@/features/auth/authSlice';
import { useSignOut } from '@/features/auth/useSignOut';
import { useGetSurveyorJobQuery } from '@/api/surveyorApi';
import { PATHS } from '@/app/paths';
import { formatLongDate } from '../format';
import { NetworkToggle } from './NetworkToggle';
import styles from './SurveyorLayout.module.scss';

const JOB_PATH = { path: '/survey/jobs/:jobRef/*', end: false } as const;

// Order matters: more specific patterns first.
const TITLES: { path: string; title: string }[] = [
  { path: PATHS.SURVEYOR_JOB_OVERVIEW_ROUTE, title: 'Job Overview' },
  { path: PATHS.SURVEYOR_JOB_MAP_ROUTE, title: 'Map' },
  { path: PATHS.SURVEYOR_JOB_SITE_INFO_ROUTE, title: 'Contacts & Access' },
  { path: PATHS.SURVEYOR_JOB_RUNBOOK_ROUTE, title: 'Survey Runbook' },
  { path: PATHS.SURVEYOR_ACCOUNT, title: 'Account' },
  { path: PATHS.SURVEYOR_ROOT, title: 'My Jobs' },
];

/** Surveyor app shell. Reuses AppShell; Manager layout and routes are untouched. */
export function SurveyorLayout() {
  const { pathname } = useLocation();
  const auth = useAppSelector(selectAuth);
  const { signOut, signingOut, signOutError } = useSignOut();

  const rawJobRef = matchPath(JOB_PATH, pathname)?.params.jobRef;
  const jobRef = rawJobRef ? decodeURIComponent(rawJobRef) : undefined;
  const { data: job } = useGetSurveyorJobQuery(jobRef ?? skipToken);

  const title = TITLES.find((entry) => matchPath({ path: entry.path, end: true }, pathname))?.title ?? 'My Jobs';

  let subtitle: string | undefined;
  if (jobRef) subtitle = `My Jobs / ${jobRef}${job ? ` · ${job.siteName}` : ''}`;
  else if (pathname === PATHS.SURVEYOR_ROOT) subtitle = formatLongDate();

  // Back arrow on Job Overview (-> My Jobs) and Map (-> Job Overview).
  let backTo: { to: string; label: string } | undefined;
  if (jobRef && matchPath({ path: PATHS.SURVEYOR_JOB_OVERVIEW_ROUTE, end: true }, pathname)) {
    backTo = { to: PATHS.SURVEYOR_ROOT, label: 'Back to My Jobs' };
  } else if (jobRef && matchPath({ path: PATHS.SURVEYOR_JOB_MAP_ROUTE, end: true }, pathname)) {
    backTo = { to: PATHS.SURVEYOR_JOB_OVERVIEW(jobRef), label: 'Back to Job Overview' };
  } else if (jobRef && matchPath({ path: PATHS.SURVEYOR_JOB_SITE_INFO_ROUTE, end: true }, pathname)) {
    backTo = { to: PATHS.SURVEYOR_JOB_OVERVIEW(jobRef), label: 'Back to Job Overview' };
  }

  // Desktop sidebar: My Jobs, Survey Runbook (+ Sign Out added by AppShell).
  const navItems: NavItem[] = [
    { to: PATHS.SURVEYOR_ROOT, label: 'My Jobs', icon: <BriefcaseBusiness size={20} />, end: true },
    ...(jobRef
      ? [{ to: PATHS.SURVEYOR_JOB_RUNBOOK(jobRef), label: 'Survey Runbook', icon: <ListChecks size={20} /> }]
      : []),
  ];
  // Tablet / mobile bottom bar: My Jobs, Survey Runbook, Account.
  const bottomNavItems: NavItem[] = [
    ...navItems,
    { to: PATHS.SURVEYOR_ACCOUNT, label: 'Account', icon: <UserRound size={20} /> },
  ];

  return (
    <NotificationProvider>
      <AppShell
        title={title}
        subtitle={subtitle}
        roleLabel="Surveyor"
        userName={auth.name ?? ''}
        navItems={navItems}
        bottomNavItems={bottomNavItems}
        sidebarDesktopOnly
        onSignOut={() => void signOut()}
        signingOut={signingOut}
      >
        {signOutError && <p role="alert">{signOutError}</p>}
        <div className={styles.page}>
          {/* Dev-only; renders nothing in production builds. */}
          <div className={styles.toolbar}>
            {backTo && (
              <Link to={backTo.to} className={styles.back} aria-label={backTo.label}>
                <ArrowLeft size={22} aria-hidden="true" />
              </Link>
            )}
            <NetworkToggle />
          </div>
          <Outlet />
        </div>
      </AppShell>
    </NotificationProvider>
  );
}
