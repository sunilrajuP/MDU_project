import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useGetJobsQuery } from '@/api/baseApi';
import { useAppSelector } from '@/store/hooks';
import { selectCurrentActor } from '@/features/auth/authSlice';
import { selectAllUsers } from '@/features/teamlead/teamSlice';
import { selectAllJobs } from '@/features/jobs/jobsSlice';
import { computeJobCounts, isJobOverdue, scopeJobsToActor } from '@/features/jobs/jobStatus';
import { JobCard } from '@/features/jobs/components/JobCard';
import { StatusFilterBar, type StatusFilterKey } from '@/features/jobs/components/StatusFilterBar';
import { PATHS } from '@/app/paths';
import { canEditJob } from '@/config/rules/assignment';
import type { JobStatus } from '@/types/domain';
import styles from './ManagerDashboardPage.module.scss';

const FILTER_TO_STATUS: Partial<Record<StatusFilterKey, JobStatus[]>> = {
  new: ['new'],
  assigned: ['assigned_teamlead', 'assigned_surveyor'],
  inProgress: ['in_progress'],
  submitted: ['submitted', 'pending_qc'],
  returned: ['returned'],
};

const PAGE_SIZE = 15;

export function ManagerDashboardPage() {
  const actor = useAppSelector(selectCurrentActor);
  const detailsPath = PATHS.MANAGEMENT_JOB_DETAILS;
  const editPath = PATHS.MANAGEMENT_EDIT_JOB;
  const users = useAppSelector(selectAllUsers);
  const allJobs = useAppSelector(selectAllJobs);

  const [filter, setFilter] = useState<StatusFilterKey>('total');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Dexie (via jobsSlice) is the render source of truth; this query only syncs the API into it.
  const { isFetching } = useGetJobsQuery();
  console.log(isFetching);

  const scopedJobs = scopeJobsToActor(allJobs, actor);
  console.log(scopedJobs);
  const counts = computeJobCounts(scopedJobs);
  const overdueCount = scopedJobs.filter(isJobOverdue).length;

  const visibleJobs = useMemo(() => {
    let list = scopedJobs.filter((j) => j.status !== 'approved');
    if (filter === 'overdue') {
      list = list.filter(isJobOverdue);
    } else {
      const statuses = FILTER_TO_STATUS[filter];
      if (statuses) list = list.filter((j) => statuses.includes(j.status));
      if (filter === 'new' || filter === 'assigned') list = list.filter((j) => !isJobOverdue(j));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((j) => j.siteName.toLowerCase().includes(q) || j.address.toLowerCase().includes(q));
    }
    return list;
  }, [scopedJobs, filter, search]);

  const totalPages = Math.max(1, Math.ceil(visibleJobs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  if (page !== currentPage) setPage(currentPage);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageJobs = visibleJobs.slice(firstIndex, firstIndex + PAGE_SIZE);


  return (
    <div className={styles.page} data-layout="dashboard">
      <StatusFilterBar
        counts={counts}
        overdueCount={overdueCount}
        active={filter}
        onChange={(nextFilter) => {
          setFilter(nextFilter);
          setPage(1);
        }}
      />

      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            className={styles.searchInput}
            placeholder="Search sites or address"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className={styles.clearSearchButton}
              aria-label="Clear search"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
     <div className={styles.listHeading}>

      </div>

      {isFetching && allJobs.length === 0 && <p className={styles.empty}>Loading jobs…</p>}
      {!isFetching && visibleJobs.length === 0 && <p className={styles.empty}>No jobs match this filter.</p>}

      <div className={styles.list}>
        {pageJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            detailsPath={detailsPath(job.jobRef || job.id)}
            editPath={actor && canEditJob(actor, job) ? editPath(job.jobRef || job.id) : undefined}
            assigneeTeamLead={job.assigneeName ?? (job.assignedTo?.role === 'TeamLead'
              ? users.find((u) => u.id === job.assignedTo?.userId)?.name : undefined)}
            latestSurveyorName={job.latestSurveyorName}
            createdByName={job.createdByName ?? users.find((u) => u.id === job.createdBy?.userId)?.name}
          />
        ))}
      </div>
      {visibleJobs.length > 0 && (
        <nav className={styles.pagination} aria-label="Job pages">
          <span className={styles.pageSummary} aria-live="polite">
            Showing {firstIndex + 1} – {Math.min(firstIndex + PAGE_SIZE, visibleJobs.length)} of {visibleJobs.length}
          </span>
          <div className={styles.pageControls}>
            <button type="button" aria-label="Previous page" className={styles.pageButton} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              &lt;
            </button>
            <span className={styles.pageSummary}>Page {currentPage} of {totalPages}</span>
            <button type="button" aria-label="Next page" className={styles.pageButton} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
              &gt;
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
