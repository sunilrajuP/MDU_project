import type { CreateJobRequest, UpdateJobRequest } from './api';
import type { AssignmentActor } from './domain';

export type JobChanges = Omit<UpdateJobRequest, 'id'>;

export interface JobSyncEntry {
  seq?: number;
  entity: 'job';
  entityId: string;
  op: 'put';
  kind: 'create' | 'update';
  owner: AssignmentActor;
  rev: number;
  status: 'pending' | 'inflight' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: number;
  nextAttemptAt: number;
  changes: JobChanges;
  clientRequestId: string;
  /** Freeze the first POST body so retries use the same idempotency key and payload. */
  createRequest?: CreateJobRequest;
  createRevision?: number;
}
