import { getDb } from '../db/getDb';
import type { AuthSessionRecord } from '../db/schema';

type Session = Omit<AuthSessionRecord, 'id'>;

export function isSameAuthSession(current: Session | undefined, expected: Session): boolean {
  return current?.userId === expected.userId
    && current.accessToken === expected.accessToken
    && current.refreshToken === expected.refreshToken;
}

export const authRepo = {
  get(): Promise<AuthSessionRecord | undefined> {
    return getDb().authSession.get('current');
  },

  async set(session: Session): Promise<void> {
    await getDb().authSession.put({
      id: 'current', ...session,
      refreshToken: session.refreshToken ?? null,
      expiry: session.expiry ?? null,
    });
  },

  async replaceIfCurrent(expected: Session, next: Session | null): Promise<boolean> {
    const db = getDb();
    return db.transaction('rw', db.authSession, async () => {
      if (!isSameAuthSession(await authRepo.get(), expected)) return false;
      if (next) await authRepo.set(next);
      else await authRepo.clear();
      return true;
    });
  },

  async clear(): Promise<void> {
    await getDb().authSession.delete('current');
  },
};
