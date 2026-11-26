import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, LogOut, Network, UserRound } from 'lucide-react';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import styles from './AppShell.module.scss';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  roleLabel: string;
  userName: string;
  navItems: NavItem[];
  bottomNavItems: NavItem[];
  onSignOut: () => void;
  signingOut?: boolean;
}

export function AppShell({
  title,
  subtitle,
  roleLabel,
  userName,
  navItems,
  bottomNavItems,
  onSignOut,
  signingOut = false,
  children,
}: PropsWithChildren<AppShellProps>) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountHovered, setAccountHovered] = useState(false);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  function handleAccountKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setAccountOpen(false);
      setAccountHovered(false);
      accountButtonRef.current?.focus();
    }
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Network size={20} />
          </span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>MDU</span>
            <span className={styles.brandSubtitle}>FIBRE SURVEY</span>
          </div>
        </div>
        <nav className={styles.navList}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [styles.navItem, item.to !== '#' && isActive ? styles.navItemActive : ''].join(' ')
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button type="button" className={styles.navItem} onClick={onSignOut} disabled={signingOut}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.appBar}>
          <div className={styles.appBarText}>
            <h1 className={styles.pageTitle}>{title}</h1>
            {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
          </div>
          <div className={styles.appBarActions}>
            <ConnectionPill />
            <div
              className={styles.accountControl}
              onPointerEnter={(event: PointerEvent<HTMLDivElement>) => {
                if (event.pointerType !== 'touch') setAccountHovered(true);
              }}
              onPointerLeave={(event: PointerEvent<HTMLDivElement>) => {
                if (event.pointerType !== 'touch') setAccountHovered(false);
              }}
              onKeyDown={handleAccountKeyDown}
            >
              <button
                ref={accountButtonRef}
                type="button"
                className={styles.accountTrigger}
                aria-label={`Account for ${userName || 'current user'}`}
                aria-expanded={accountOpen || accountHovered}
                aria-controls="app-account-details"
                onClick={() => setAccountOpen((open) => !open)}
              >

                <span className={styles.accountRow}>
                  <UserRound className={styles.accountIcon} size={18} aria-hidden="true" />
                  <span className={styles.accountName}>{userName || 'Account'}</span>
                  <ChevronDown className={styles.accountChevron} size={16} aria-hidden="true" />
                </span>
                <span className={styles.accountTriggerRole}>{roleLabel}</span>
              </button>
              {(accountOpen || accountHovered) && (
                <div
                  id="app-account-details"
                  className={styles.accountMenu}
                  role="region"
                  aria-label="Account details"
                >
                  <span className={styles.accountUserName}>{userName}</span>
                  <span className={styles.accountRole}>{roleLabel}</span>
                  <button type="button" className={styles.accountSignOut} onClick={onSignOut} disabled={signingOut}>
                    <LogOut size={18} aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>

      <nav className={styles.bottomNav} aria-label={roleLabel}>
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => [styles.tab, isActive ? styles.tabActive : ''].join(' ')}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
