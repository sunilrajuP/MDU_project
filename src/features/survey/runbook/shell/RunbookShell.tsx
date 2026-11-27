import type { PropsWithChildren } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, ListChecks, LogOut, Network, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import { PATHS } from '@/app/paths';
import { useSignOut } from '@/features/auth/useSignOut';
import { NetworkToggle } from '../../layout/NetworkToggle';
import styles from './RunbookShell.module.scss';

interface RunbookShellProps {
  jobRef: string;
  /** Anchored "Continue" action; omitted while loading. */
  onContinue?: () => void;
  /** Keeps the Continue button visible but not clickable. */
  continueDisabled?: boolean;
}

/**
 * The runbook's own frame (per Figma): back arrow + title + connection pill header, content column,
 * anchored Continue button and the three-tab bottom bar. It deliberately does not use the AppShell app bar.
 */
export function RunbookShell({ jobRef, onContinue, continueDisabled, children }: Readonly<PropsWithChildren<RunbookShellProps>>) {
  const navigate = useNavigate();
  const { signOut, signingOut } = useSignOut();
  const side = ({ isActive }: { isActive: boolean }) => [styles.sideItem, isActive ? styles.sideItemActive : ''].filter(Boolean).join(' ');
  const tab = ({ isActive }: { isActive: boolean }) => [styles.tab, isActive ? styles.tabActive : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.page}>
      {/* Desktop only: left navigation replaces the bottom tab bar. */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Network size={20} aria-hidden="true" />
          </span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>MDU</span>
            <span className={styles.brandSubtitle}>FIBRE SURVEY</span>
          </div>
        </div>
        <nav className={styles.sideNav} aria-label="Surveyor">
          <NavLink to={PATHS.SURVEYOR_ROOT} end className={side}>
            <BriefcaseBusiness size={20} aria-hidden="true" />
            <span>My Jobs</span>
          </NavLink>
          <NavLink to={PATHS.SURVEYOR_JOB_RUNBOOK(jobRef)} className={side}>
            <ListChecks size={20} aria-hidden="true" />
            <span>Survey Runbook</span>
          </NavLink>
          <button type="button" className={styles.sideItem} onClick={() => void signOut()} disabled={signingOut}>
            <LogOut size={20} aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </nav>
      </aside>

      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(PATHS.SURVEYOR_ROOT)} aria-label="Back to My Jobs">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h1 className={styles.title}>Survey Runbook</h1>
        <div className={styles.pill}>
          <ConnectionPill />
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.toolbar}>
          <NetworkToggle />
        </div>
        {children}
      </main>

      {onContinue && (
        <div className={styles.action}>
          <Button type="button" className={styles.continue} onClick={onContinue} disabled={continueDisabled}>
            Submit
          </Button>
        </div>
      )}

      <nav className={styles.nav} aria-label="Surveyor">
        <NavLink to={PATHS.SURVEYOR_ROOT} end className={tab}>
          <BriefcaseBusiness size={20} aria-hidden="true" />
          <span>My Jobs</span>
        </NavLink>
        <NavLink to={PATHS.SURVEYOR_JOB_RUNBOOK(jobRef)} className={tab}>
          <ListChecks size={20} aria-hidden="true" />
          <span>Survey Runbook</span>
        </NavLink>
        <NavLink to={PATHS.SURVEYOR_ACCOUNT} className={tab}>
          <Settings size={20} aria-hidden="true" />
          <span>Account</span>
        </NavLink>
      </nav>
    </div>
  );
}
