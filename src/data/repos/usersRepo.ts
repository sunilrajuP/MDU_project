import { getDb } from '../db/getDb';
import type { User } from '@/types/domain';

export const usersRepo = {
  getAll(): Promise<User[]> {
    return getDb().users.toArray();
  },

  async upsertMany(users: User[]): Promise<void> {
    await getDb().users.bulkPut(users);
  },

  /** Makes the stored roster for `role` exactly match the API response, dropping stale rows. */
  async replaceRole(role: User['role'], users: User[]): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.users, async () => {
      await db.users.where('role').equals(role).delete();
      await db.users.bulkPut(users);
    });
  },
};
