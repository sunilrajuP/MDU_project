import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';
import { useLoginMutation } from '@/api/baseApi';
import { roleHome } from '@/app/guards';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import styles from './LoginPage.module.scss';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const signOutWarning = typeof location.state?.signOutWarning === 'string'
    ? location.state.signOutWarning : '';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await login({ email, password }).unwrap();
      navigate(roleHome(result.role), { replace: true });
    } catch {
      // error state surfaced below via RTK Query's `error`
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.connection}>
        <ConnectionPill />
      </div>
      <div className={styles.card}>
        <div className={styles.welcome}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <Network size={24} />
            </span>
            <div className={styles.brandText}>
              <span className={styles.brandName}>MDU</span>
              <span className={styles.brandSubtitle}>FIBRE SURVEY</span>
            </div>
          </div>
          <div className={styles.heading}>
            <h1 className={styles.title}>MDU Fibre Survey</h1>
            <p className={styles.subtitle}>Sign in to your field workspace.</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {signOutWarning && <p className={styles.errorText} role="alert">{signOutWarning}</p>}
          <Input
            label="Email"
            placeholder="Enter Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            placeholder="Enter Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p className={styles.errorText} role="alert">
              {'message' in error && error.message ? String(error.message) : 'Sign in failed.'}
            </p>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign In'}
          </Button>
          {/* <button type="button" className={styles.forgotPassword}>
            Forgot password?
          </button> */}
        </form>
      </div>
    </div>
  );
}
 