import { getDb } from '../db/getDb';
import type { Job, SiteInformation } from '@/types/domain';
import type { ApiJob } from '@/types/api';
import type { JobChanges, JobSyncEntry } from '@/types/jobSync';

export const jobsRepo = {
  getAll(): Promise<Job[]> {
    return getDb().jobs.toArray();
  },

  getById(id: string): Promise<Job | undefined> {
    return getDb().jobs.get(id);
  },

  getByClientId(id: string): Promise<Job | undefined> {
    return getDb().jobs.filter((job) => job.clientId === id).first();
  },

  async upsertMany(jobs: Job[]): Promise<void> {
    await getDb().jobs.bulkPut(jobs);
  },

  async replaceAll(jobs: Job[]): Promise<void> {
  await getDb().transaction('rw', getDb().jobs, async () => {
    await getDb().jobs.clear();
    await getDb().jobs.bulkPut(jobs);
  });
},

  async upsert(job: Job): Promise<void> {
    await getDb().jobs.put(job);
  },

  async saveSiteInformation(id: string, siteInformation: SiteInformation): Promise<Job> {
    const db = getDb();
    return db.transaction('rw', db.jobs, async () => {
      const current = await db.jobs.get(id);
      if (!current) throw new Error('The job is no longer available. Reload the dashboard.');
      const job = { ...current, siteInformation };
      await db.jobs.put(job);
      return job;
    });
  },

  async markDirty(id: string, dirty: boolean, syncStatus: Job['syncStatus']): Promise<void> {
    await getDb().jobs.update(id, { dirty, syncStatus });
  },

  async mergeServerJobs(rows: ApiJob[], map: (row: ApiJob, existing?: Job) => Job, requestedAt: number): Promise<Job[]> {
    const db = getDb();
    return db.transaction('rw', db.jobs, async () => {
      const cached = await db.jobs.toArray();
      const byId = new Map(cached.map((job) => [job.id, job]));
      const jobs = rows.map((row) => {
        const existing = byId.get(String(row.id));
        return existing && (existing.dirty || Date.parse(existing.updatedAt) >= requestedAt)
          ? existing : map(row, existing);
      });
      jobs.push(...cached.filter((job) => (job.dirty || Date.parse(job.updatedAt) >= requestedAt)
        && !jobs.some((row) => row.id === job.id)));
      await db.jobs.clear();
      await db.jobs.bulkPut(jobs);
      return jobs;
    });
  },

  async mergeServerJob(row: ApiJob, map: (row: ApiJob, existing?: Job) => Job, requestedAt: number): Promise<Job> {
    const db = getDb();
    return db.transaction('rw', db.jobs, async () => {
      const current = await db.jobs.get(String(row.id));
      const job = current && (current.dirty || Date.parse(current.updatedAt) >= requestedAt)
        ? current : map(row, current);
      await db.jobs.put(job);
      return job;
    });
  },

  async saveLocal(job: Job, changes: JobChanges, create = false): Promise<Job> {
    const db = getDb();
    return db.transaction('rw', db.jobs, db.syncQueue, async () => {
      const current = await db.jobs.get(job.id);
      const queued = await db.syncQueue.where('[entity+entityId]').equals(['job', job.id]).first();
      const rev = (current?.rev ?? 0) + 1;
      const saved: Job = {
        ...job, rev, updatedAt: new Date().toISOString(),
        dirty: true, syncStatus: 'pending', syncError: undefined,
        pendingEditBy: queued?.owner ?? job.pendingEditBy ?? job.createdBy,
      };
      const entry: JobSyncEntry = {
        ...queued,
        entity: 'job', entityId: job.id, op: 'put',
        kind: queued?.kind ?? (create ? 'create' : 'update'),
        owner: queued?.owner ?? job.pendingEditBy ?? job.createdBy,
        rev, status: queued?.status === 'inflight' ? 'inflight' : 'pending',
        attempts: queued?.attempts ?? 0, lastError: undefined,
        createdAt: queued?.createdAt ?? Date.now(),
        nextAttemptAt: queued?.status === 'inflight' ? queued.nextAttemptAt : 0,
        changes: { ...queued?.changes, ...changes },
        clientRequestId: queued?.clientRequestId ?? crypto.randomUUID(),
      };
      await db.jobs.put(saved);
      await db.syncQueue.put(entry);
      return saved;
    });
  },
};
