import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppSelector } from '@/store/hooks';
import { selectAuth } from '@/features/auth/authSlice';
import { useSignOut } from '@/features/auth/useSignOut';
import styles from './AccountPage.module.scss';

/** Surveyor "Account" tab: who is signed in, and sign out. */
export function AccountPage() {
  const auth = useAppSelector(selectAuth);
  const { signOut, signingOut, signOutError } = useSignOut();
  return (
    <Card className={styles.card}>
      <div>
        <p className={styles.name}>{auth.name ?? 'Surveyor'}</p>
        <p className={styles.role}>Surveyor</p>
      </div>
      {signOutError && (
        <p className={styles.error} role="alert">
          {signOutError}
        </p>
      )}
      <Button type="button" variant="outline" onClick={() => void signOut()} disabled={signingOut}>
        <LogOut size={18} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign Out'}
      </Button>
    </Card>
  );
}
