import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeJobCounts, isJobOverdue } from '@/features/jobs/jobStatus';
import type { Job, JobStatus } from '@/types/domain';

function makeJob(status: JobStatus, scheduledDate?: string): Job {
  return {
    id: 'job-1',
    siteName: 'Test site',
    address: 'Test address',
    status,
    scheduledDate,
    createdBy: { userId: 'manager-1', role: 'Manager' },
    siteDetails: {},
    assignmentHistory: [],
    attempt: 0,
    updatedAt: '2026-11-19T00:00:00Z',
    dirty: false,
    syncStatus: 'synced',
  };
}

describe('isJobOverdue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('computeJobCounts', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('excludes overdue new and both assignment statuses, without changing other counts', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 19, 12));

      const jobs = (['new', 'assigned_teamlead', 'assigned_surveyor'] as const).flatMap(
        (status) => ['2026-11-18', '2026-11-19', '2026-11-20', undefined].map(
          (date) => makeJob(status, date),
        ),
      );
      jobs.push(
        makeJob('in_progress', '2026-11-18'),
        makeJob('pending_qc', '2026-11-18'),
        makeJob('returned', '2026-11-18'),
        makeJob('submitted', '2026-11-18'),
        makeJob('approved', '2026-11-18'),
      );

      expect(computeJobCounts(jobs)).toEqual({
        total: 16,
        new: 3,
        assigned: 6,
        inProgress: 1,
        submitted: 2,
        returned: 1,
        approved: 1,
      });
    });
  });

  it.each([
    'new',
    'YetToAssign',
    'assigned_teamlead',
    'assigned_surveyor',
    'in_progress',
    'pending_qc',
    'returned',
    'approved',
  ] as const)('marks past-due %s jobs overdue', (status) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 12));

    expect(isJobOverdue(makeJob(status, '2026-11-18'))).toBe(true);
  });

  it('does not mark submitted jobs overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 12));

    expect(isJobOverdue(makeJob('submitted', '2026-11-18'))).toBe(false);
  });

  it.each(['2026-11-19', '2026-11-20', undefined])(
    'does not mark a job scheduled for %s overdue',
    (scheduledDate) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 19, 12));

      expect(isJobOverdue(makeJob('new', scheduledDate))).toBe(false);
    },
  );
});
