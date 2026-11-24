import { getDb } from '../db/getDb';
import type { AssignmentActor, Job } from '@/types/domain';
import type { JobSyncEntry } from '@/types/jobSync';

const sameActor = (a: AssignmentActor, b: AssignmentActor) => a.userId === b.userId && a.role === b.role;

export const jobSyncQueries = { claim: ['entity'] } as const;

export const jobSyncRepo = {
  async claim(owner: AssignmentActor): Promise<JobSyncEntry | undefined> {
    const db = getDb();
    return db.transaction('rw', db.jobs, db.syncQueue, async () => {
      const entries = await db.syncQueue.where('entity').equals('job').toArray();
      const entry = entries.find((item) => sameActor(item.owner, owner)
        && item.status !== 'failed' && item.nextAttemptAt <= Date.now());
      if (!entry) return;
      const job = await db.jobs.get(entry.entityId);
      if (!job) throw new Error(`Local job ${entry.entityId} is missing; sync was not discarded.`);
      if (entry.kind === 'create' && !entry.createRequest) {
        entry.createRequest = {
          siteName: job.siteName, siteAddress: job.address,
          ...(job.latitude !== undefined && job.longitude !== undefined
            ? { latitude: job.latitude, longitude: job.longitude } : {}),
          scheduledDate: job.scheduledDate ?? '',
          createdDate: job.createdDate ?? new Date(entry.createdAt).toISOString(),
          ...(job.createdByName ? { createdBy: job.createdByName } : {}),
          ...(job.updatedDate ? { updatedDate: job.updatedDate } : {}),
          comments: job.siteDetails.notes ?? '',
          assignedSurveyorId: job.assignedTo ? Number(job.assignedTo.userId) : null,
        };
        entry.createRevision = entry.rev;
      }
      entry.status = 'inflight';
      entry.attempts += 1;
      // An interrupted request can be recovered after this lease expires.
      entry.nextAttemptAt = Date.now() + 120_000;
      await db.syncQueue.put(entry);
      return entry;
    });
  },

  async complete(sent: JobSyncEntry, server: Job): Promise<Job> {
    const db = getDb();
    return db.transaction('rw', db.jobs, db.syncQueue, async () => {
      const queued = await db.syncQueue.get(sent.seq!);
      const current = await db.jobs.get(sent.entityId);
      if (!queued || !current) throw new Error('Local job or sync record is missing.');
      const acceptedRev = sent.kind === 'create' ? sent.createRevision : sent.rev;
      const newer = queued.rev !== acceptedRev || (sent.kind === 'create' && Boolean(queued.changes.siteDetails));
      const saved: Job = newer
        ? { ...current, id: server.id, jobRef: server.jobRef, syncStatus: 'pending', syncError: undefined }
        : { ...server, rev: current.rev, dirty: false, syncStatus: 'synced', syncError: undefined };
      if (server.id !== current.id) await db.jobs.delete(current.id);
      await db.jobs.put(saved);
      if (newer) {
        await db.syncQueue.put({
          ...queued, entityId: server.id, kind: 'update',
          status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: undefined,
          createRequest: undefined, createRevision: undefined,
        });
      } else {
        await db.syncQueue.delete(sent.seq!);
      }
      return saved;
    });
  },

  async fail(sent: JobSyncEntry, message: string, permanent: boolean): Promise<Job> {
    const db = getDb();
    return db.transaction('rw', db.jobs, db.syncQueue, async () => {
      const queued = await db.syncQueue.get(sent.seq!);
      const current = await db.jobs.get(sent.entityId);
      if (!queued || !current) throw new Error('Local job or sync record is missing.');
      const delays = [2_000, 10_000, 60_000];
      await db.syncQueue.put({
        ...queued, status: permanent ? 'failed' : 'pending', lastError: message,
        nextAttemptAt: Date.now() + delays[Math.min(sent.attempts - 1, delays.length - 1)],
      });
      const saved: Job = { ...current, dirty: true, syncStatus: permanent ? 'failed' : 'pending', syncError: message };
      await db.jobs.put(saved);
      return saved;
    });
  },

};
