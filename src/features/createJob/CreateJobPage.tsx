import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectCurrentActor } from '@/features/auth/authSlice';
import { createJob, editJob } from '@/features/jobs/jobsThunks';
import { selectJobByJobRefOrId } from '@/features/jobs/jobsSlice';
import { useGetJobsQuery } from '@/api/baseApi';
import { useAssignmentTargets } from '@/features/jobs/useAssignmentTargets';
import { matchingAssignmentNames } from '@/features/jobs/assignmentName';
import { canEditJob } from '@/config/rules/assignment';
import type { Job } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { useNotification } from '@/components/ui/notificationContext';
import { PATHS } from '@/app/paths';
import field from '@/components/ui/FormField.module.scss';
import styles from './CreateJobPage.module.scss';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';

interface CreateJobPageProps {
  backPath: string;
}

const UNRESOLVED_ASSIGNMENT = '__unresolved_assignment__';

interface AssigneeOption {
  value: string;
  label: string;
}

interface AssigneeDropdownProps {
  value: string;
  options: AssigneeOption[];
  disabled: boolean;
  emptyLabel: string;
  onChange: (value: string) => void;
}

function AssigneeDropdown({ value, options, disabled, emptyLabel, onChange }: AssigneeDropdownProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    const handleOutsidePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsidePointer);
    return () => document.removeEventListener('mousedown', handleOutsidePointer);
  }, []);

  function showOptions(index = selectedIndex >= 0 ? selectedIndex : 0) {
    setActiveIndex(index);
    setOpen(true);
  }

  function choose(option: AssigneeOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        showOptions(direction > 0 ? (selectedIndex >= 0 ? selectedIndex : 0) : (selectedIndex >= 0 ? selectedIndex : options.length - 1));
      } else if (options.length > 0) {
        setActiveIndex((index) => (index + direction + options.length) % options.length);
      }
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (open && options.length > 0) {
        event.preventDefault();
        setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        showOptions();
      } else if (activeIndex >= 0 && activeIndex < options.length) {
        choose(options[activeIndex]);
      }
    }
  }

  return (
    <div className={field.wrap} ref={rootRef}>
      <button
        id="assignee"
        type="button"
        role="combobox"
        className={`${field.control} ${styles.dropdownTrigger} ${value === '' ? styles.placeholderSelect : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 && activeIndex < options.length
          ? `${id}-option-${activeIndex}`
          : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : showOptions())}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.dropdownValue}>{selectedOption?.label ?? emptyLabel}</span>
      </button>
      <span className={field.icon} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
      {open && (
        <ul id={listId} role="listbox" className={styles.dropdownList}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`${styles.dropdownOption} ${index === activeIndex ? styles.dropdownOptionActive : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CreateJobPage({ backPath }: CreateJobPageProps) {
  const { jobRef, id: legacyId } = useParams();
  const jobIdentifier = jobRef ?? legacyId;
  const job = useAppSelector((state) => jobIdentifier
    ? selectJobByJobRefOrId(state, jobIdentifier)
    : undefined);
  const hydrated = useAppSelector((state) => state.jobs.hydrated);
  const actor = useAppSelector(selectCurrentActor);

  const {
    isError: jobsError,
    isFetching: jobsFetching,
    isUninitialized: jobsUninitialized,
    refetch: refetchJobs,
  } = useGetJobsQuery(undefined, {
    skip: !jobIdentifier || Boolean(job),
  });
  const navigate = useNavigate();

  if (!hydrated || (jobIdentifier && !job && (jobsFetching || jobsUninitialized) && !jobsError)) {
    return <p className={styles.body} role="status">Loading job...</p>;
  }
  if (jobIdentifier && (!job || !actor || !canEditJob(actor, job))) {
    return (
      <div className={styles.body}>
        <p className={styles.error} role="alert">
          {!job ? 'Could not load this job. It may no longer exist or the server is unavailable.'
            : 'This job is locked for review, or you do not have permission to edit it.'}
        </p>
        {!job && <Button onClick={() => refetchJobs()}>Retry</Button>}
        <Button variant="outline" onClick={() => navigate(backPath)}>Cancel</Button>
      </div>
    );
  }
  return <JobForm key={jobIdentifier ?? 'new'} job={job} backPath={backPath} />;
}

function JobForm({ backPath, job }: CreateJobPageProps & { job?: Job }) {
  const [siteName, setSiteName] = useState(job?.siteName ?? '');
  const [address, setAddress] = useState(job?.address ?? '');
  const [addressSelected, setAddressSelected] = useState(Boolean(job?.address));
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number }>();
  const actor = useAppSelector(selectCurrentActor);
  const assignment = useAssignmentTargets(actor);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const notification = useNotification();

  const [scheduledDate, setScheduledDate] = useState(job?.scheduledDate?.slice(0, 10) ?? '');
  const currentAssignment = actor?.role === 'TeamLead' ? job?.assignedSurveyor : job?.assignedTo;
  const currentAssignmentId = currentAssignment?.userId ?? '';
  const currentAssignmentName = actor?.role === 'TeamLead' ? job?.latestSurveyorName : job?.assigneeName;
  const nameMatches = currentAssignmentName
    ? matchingAssignmentNames(currentAssignmentName, assignment.targets, (target) => target.name) : [];
  const currentAssignmentValue = currentAssignmentId
    || (nameMatches.length === 1 ? nameMatches[0].actor.userId
      : currentAssignmentName ? UNRESOLVED_ASSIGNMENT : '');
  const [selectedAssignee, setAssignee] = useState<string>();
  const assignee = selectedAssignee ?? currentAssignmentValue;
  const assigneeOptions = [
    ...(currentAssignmentValue && !assignment.targets.some(
      (target) => target.actor.userId === currentAssignmentValue,
    )
      ? [{ value: currentAssignmentValue, label: currentAssignmentName ?? currentAssignmentId }]
      : []),
    ...assignment.targets.map((target) => ({
      value: target.actor.userId,
      label: target.name,
    })),
  ];
  const assigneeRoleLabel = actor?.role === 'Manager' ? 'Team Lead' : 'Surveyor';
  const assigneeLabel = `${job && assignee ? 'Reassign' : 'Assign'} ${assigneeRoleLabel}`;
  const [notes, setNotes] = useState(job?.siteDetails.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const createRequest = useRef<{ payload: string; id: string; createdDate: string }>(null);

  function reportFailure(message: string) {
    setError(message);
    notification?.showNotification({
      kind: 'error',
      message: `Could not ${job ? 'update' : 'create'} job. ${message}`,
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    notification?.clearNotification();
    if (!actor) {
      reportFailure('Sign in before saving a job.');
      return;
    }
    if (!scheduledDate) {
      reportFailure('Select a scheduled date.');
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const details = { siteName, siteAddress: address, scheduledDate, notes, ...coordinates };
      const target = assignment.targets.find((candidate) => candidate.actor.userId === assignee);
      if (assignee && assignee !== currentAssignmentValue && !target) {
        reportFailure('Select an eligible assignee.');
        return;
      }
      let saved: Job;
      if (job) {
        saved = await dispatch(editJob({
          id: job.id,
          ...details,
          ...(assignee === currentAssignmentValue ? {} : { assignedTo: target?.actor ?? null }),
        })).unwrap();
      } else {
        const input = {
          ...details,
          assignedSurveyorId: assignee ? Number(assignee) : null,
        };
        const payload = JSON.stringify(input);
        if (createRequest.current?.payload !== payload) {
          createRequest.current = { payload, id: crypto.randomUUID(), createdDate: new Date().toISOString() };
        }
        saved = await dispatch(createJob({ ...input, request: createRequest.current })).unwrap();
      }
      const action = job ? 'updated' : 'created';
      const message = saved.syncStatus === 'pending'
        ? `Job "${saved.siteName}" ${action} and saved on this device. Waiting to sync.`
        : saved.syncStatus === 'failed'
          ? `Job "${saved.siteName}" ${action} and saved on this device, but sync failed.`
          : `Job "${saved.siteName}" ${action} successfully.`;
      notification?.showNotification({ kind: saved.syncStatus === 'failed' ? 'error' : 'success', message });
      navigate(backPath, { replace: true });
    } catch (failure) {
      const message = typeof failure === 'string' ? failure
        : failure && typeof failure === 'object' && 'message' in failure && typeof failure.message === 'string'
          ? failure.message : 'Check your connection and try again.';
      reportFailure(message);
    } finally {
      setSubmitting(false);
    }
  }

  const goBack = () => navigate(PATHS.LOGIN === backPath ? '/' : backPath);

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <form id="create-job-form" className={styles.card} onSubmit={handleSubmit}>
          <fieldset className={styles.fields} disabled={submitting}>
            <div className={field.field}>
              <label className={field.label} htmlFor="siteName">
                Site/Job Name<span className={styles.requiredMark} aria-hidden="true">*</span>
              </label>
              <input
                id="siteName"
                className={field.control}
                placeholder="Enter site/job name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
              />
            </div>

            <AddressAutocomplete
              label="Site Address"
              value={address}
              selected={addressSelected}
              placeholder="Enter site address"
              required
              onChange={(text) => {
                setAddress(text);
                setAddressSelected(false);
                setCoordinates(undefined);
              }}
              onSelect={(s) => {
                setAddress(s.full);
                setAddressSelected(true);
                setCoordinates({ latitude: s.lat, longitude: s.lng });
              }}
            />
            <div className={field.field}>
              <label className={field.label} htmlFor="scheduledDate">
                Scheduled Date<span className={styles.requiredMark} aria-hidden="true">*</span>
              </label>
              <DatePicker
                id="scheduledDate"
                label="Scheduled Date"
                value={scheduledDate}
                onChange={setScheduledDate}
                required
              />
            </div>

            <div className={field.field}>
              <label className={field.label} htmlFor="assignee">
                {assigneeLabel}
              </label>
              <AssigneeDropdown
                value={assignee}
                options={assigneeOptions}
                disabled={assignment.isLoading}
                emptyLabel={job && actor?.role === 'TeamLead' ? 'Unassigned' : 'Select assignee'}
                onChange={setAssignee}
              />
            </div>
            <div className={field.field}>
              <label className={field.label} htmlFor="notes">Comments</label>
              <textarea
                id="notes"
                className={`${field.control} ${field.textarea}`}
                placeholder="Enter comments"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </fieldset>

          {error && (
            <p className={styles.error} role={notification ? undefined : 'alert'}>
              {error}
            </p>
          )}
        </form>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Button type="submit" form="create-job-form" disabled={submitting}>
            {job ? (submitting ? 'Updating...' : 'Update') : (submitting ? 'Creating…' : 'Create Job')}
          </Button>
          <Button type="button" variant="outline" onClick={goBack} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </footer>
    </div>
  );
}