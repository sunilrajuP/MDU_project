import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Select } from '@/components/ui/Select';
import { useGetSurveyorJobsQuery } from '@/api/surveyorApi';
import { ReturnedBanner, ReturnedJobCard } from './ReturnedView';
import { SurveyorJobCard } from './SurveyorJobCard';
import styles from './MyJobsPage.module.scss';

type FilterKey = 'all' | 'not_started' | 'in_progress' | 'returned';

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'All Jobs' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'returned', label: 'Returned' },
];

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export function MyJobsPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data, isLoading, isError, refetch } = useGetSurveyorJobsQuery();

  const surveyorName = data?.assignedTo.name ?? '';
  const jobs = (data?.jobs ?? []).filter((job) => filter === 'all' || job.status === filter);
  const isReturnedView = filter === 'returned';

  const summary = isReturnedView
    ? `${surveyorName} · ${plural(jobs.length, 'returned job')}`
    : `Assigned to ${surveyorName} · ${plural(jobs.length, 'job')}`;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        {data && <p className={styles.summary}>{summary}</p>}
        <div className={styles.filter}>
          <Select
            variant="filter"
            label="Filter jobs"
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterKey)}
            options={FILTERS}
          />
        </div>
      </div>

      {isLoading && <p role="status">Loading jobs…</p>}

      {isError && (
        <Callout tone="danger">
          Jobs could not be loaded.{' '}
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Retry
          </Button>
        </Callout>
      )}

      {data && (
        <>
          {isReturnedView && jobs[0] && <ReturnedBanner job={jobs[0]} />}

          {jobs.length === 0 ? (
            <p className={styles.empty}>No jobs match this filter.</p>
          ) : (
            <div className={styles.list}>
              {jobs.map((job) =>
                isReturnedView ? (
                  <ReturnedJobCard key={job.jobRef} job={job} surveyorName={surveyorName} />
                ) : (
                  <SurveyorJobCard key={job.jobRef} job={job} />
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
