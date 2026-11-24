// Dexie schema — append-only; every change bumps the version and ships an upgrade function (H2).

import Dexie, { type EntityTable } from 'dexie';
import type { Job, Team, User } from '@/types/domain';
import type { JobSyncEntry } from '@/types/jobSync';

export interface AuthSessionRecord {
  id: 'current';
  userId: string;
  name: string;
  role: User['role'];
  accessToken: string;
  // Optional for sessions saved before refresh support; no indexed fields change.
  refreshToken?: string | null;
  expiry?: string | null;
}

export interface SurveySessionRecord {
  jobId: string;
  status: 'not_started' | 'in_progress' | 'submitted';
  checklist: unknown[];
  photos: unknown[];
}

export class MduDatabase extends Dexie {
  jobs!: EntityTable<Job, 'id'>;
  users!: EntityTable<User, 'id'>;
  teams!: EntityTable<Team, 'teamLeadUserId'>;
  surveySessions!: EntityTable<SurveySessionRecord, 'jobId'>;
  authSession!: EntityTable<AuthSessionRecord, 'id'>;
  syncQueue!: EntityTable<JobSyncEntry, 'seq'>;

  constructor() {
    super('mdu-survey');

    // Version 1 — initial schema (Manager + Team Lead release).
    // Dot-notation indexes on assignedTo.userId/createdBy.userId are required because
    // canAssign()/validAssignmentTargets() and the GET /jobs client-side filter on them.
    this.version(1).stores({
      jobs: 'id, status, assignedTo.userId, createdBy.userId, updatedAt',
      users: 'id, role, teamLeadId',
      teams: 'teamLeadUserId',
      surveySessions: 'jobId',
      authSession: 'id',
    });

    this.version(2).stores({
      jobs: 'id, status, assignedTo.userId, createdBy.userId, updatedAt',
      users: 'id, role, teamLeadId',
      teams: 'teamLeadUserId',
      surveySessions: 'jobId',
      authSession: 'id',
      syncQueue: '++seq, status, entity, [entity+entityId]',
    }).upgrade(async (tx) => {
      const jobs = await tx.table<Job>('jobs').toArray();
      const session = await tx.table<AuthSessionRecord>('authSession').get('current');
      for (const job of jobs) {
        if (!job.dirty) continue;
        const owner = job.pendingEditBy ?? (session
          ? { userId: session.userId, role: session.role } : job.createdBy);
        const entry: JobSyncEntry = {
          entity: 'job', entityId: job.id, op: 'put', kind: 'update',
          owner, rev: job.rev ?? 1, status: 'pending', attempts: 0,
          createdAt: Date.now(), nextAttemptAt: 0, clientRequestId: crypto.randomUUID(),
          changes: {
            siteName: job.siteName, siteAddress: job.address,
            scheduledDate: job.scheduledDate, comments: job.siteDetails.notes,
            ...(job.assignedTo ? { assignedSurveyorId: Number(job.assignedTo.userId) }
              : job.assigneeName ? {} : { assignedSurveyorId: null }),
          },
        };
        await tx.table('syncQueue').add(entry);
      }
    });
  }
}

export const db = new MduDatabase();
