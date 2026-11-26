import { useCallback, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from 'react';
import {
  useConfirmRunbookSectionMutation,
  useSaveRunbookSectionMutation,
  useSubmitSurveyMutation,
} from '@/api/surveyorApi';
import { draftId, runbookRepo } from '@/data/repos/runbookRepo';
import type { BomRow, SectionKey } from '@/types/surveyor';
import { useOnlineStatus } from '../../useOnlineStatus';
import { computeIssues, computeProgress, computeSummaries } from '../logic';
import { SECTION_ORDER } from '../model/defaults';
import type { InitialRunbook } from '../model/initial';
import type { RunbookModel, SectionDataMap } from '../model/types';
import { RunbookContext, type RunbookContextValue } from './runbookContext';

type Sections = Record<SectionKey, number>;

interface State {
  data: SectionDataMap;
  completed: Record<SectionKey, boolean>;
  /** Bumped on every local edit; a section is unsynced while versions > synced. */
  versions: Sections;
  synced: Sections;
}

type Action =
  | { type: 'update'; key: SectionKey; recipe: (data: never) => unknown }
  | { type: 'complete'; key: SectionKey; value: boolean }
  | { type: 'synced'; key: SectionKey; version: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'update':
      return {
        ...state,
        data: { ...state.data, [action.key]: action.recipe(state.data[action.key] as never) },
        versions: { ...state.versions, [action.key]: state.versions[action.key] + 1 },
      };
    case 'complete':
      return {
        ...state,
        completed: { ...state.completed, [action.key]: action.value },
        versions: { ...state.versions, [action.key]: state.versions[action.key] + 1 },
      };
    case 'synced':
      return { ...state, synced: { ...state.synced, [action.key]: Math.max(state.synced[action.key], action.version) } };
  }
}

const FLUSH_DELAY_MS = 600;
/** Pre-flight is derived and has no stored data. */
const STORED: SectionKey[] = SECTION_ORDER.filter((key) => key !== 'preflight');

interface RunbookProviderProps {
  jobRef: string;
  surveyorName: string;
  initial: InitialRunbook;
  bomRows: BomRow[];
  onOpenSection: (key: SectionKey) => void;
}

/**
 * Holds the whole runbook while the page is open. Every edit is written to Dexie immediately (offline-first),
 * then flushed to the API when online (debounced, and again when connectivity returns).
 */
export function RunbookProvider({
  jobRef,
  surveyorName,
  initial,
  bomRows,
  onOpenSection,
  children,
}: PropsWithChildren<RunbookProviderProps>) {
  const online = useOnlineStatus();
  const [saveSection] = useSaveRunbookSectionMutation();
  const [confirmSection] = useConfirmRunbookSectionMutation();
  const [submitSurvey, { isLoading: submitting, isError: submitFailed }] = useSubmitSurveyMutation();
  const submitting_ = useRef(false);

  const [state, dispatch] = useReducer(reducer, initial, (seed): State => {
    const zero = Object.fromEntries(SECTION_ORDER.map((key) => [key, 0])) as Sections;
    const versions = { ...zero };
    for (const key of SECTION_ORDER) if (seed.dirty[key]) versions[key] = 1; // local-only drafts still to flush
    return { data: seed.data, completed: seed.completed, versions, synced: zero };
  });

  const latest = useRef(state);
  const meta = useRef({ revs: { ...initial.revs }, serverCompleted: { ...initial.serverCompleted } });
  const flushing = useRef(false);
  useEffect(() => {
    latest.current = state;
  });

  const persist = useCallback(
    (key: SectionKey, snapshot: State, dirty: boolean) =>
      runbookRepo.put({
        id: draftId(jobRef, key),
        jobRef,
        key,
        data: snapshot.data[key] as unknown as Record<string, unknown>,
        completed: snapshot.completed[key],
        baseRev: meta.current.revs[key],
        serverCompleted: meta.current.serverCompleted[key],
        dirty,
        updatedAt: new Date().toISOString(),
      }),
    [jobRef],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const key of STORED) {
        const snapshot = latest.current;
        const version = snapshot.versions[key];
        if (version <= snapshot.synced[key] || !navigator.onLine) continue;
        try {
          const saved = await saveSection({
            jobRef,
            key,
            clientRequestId: crypto.randomUUID(),
            baseRev: meta.current.revs[key],
            data: snapshot.data[key] as unknown as Record<string, unknown>,
          }).unwrap();
          meta.current.revs[key] = saved.rev;
          if (snapshot.completed[key] && !meta.current.serverCompleted[key]) {
            await confirmSection({ jobRef, key, clientRequestId: crypto.randomUUID(), baseRev: saved.rev }).unwrap();
            meta.current.serverCompleted[key] = true;
          }
          dispatch({ type: 'synced', key, version });
          await persist(key, snapshot, latest.current.versions[key] > version);
        } catch {
          // Leave the section dirty: it is retried on the next edit or when connectivity returns.
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [confirmSection, jobRef, persist, saveSection]);

  // 1. Write unsynced sections to Dexie right away. 2. Debounce the API flush.
  useEffect(() => {
    for (const key of STORED) {
      if (state.versions[key] > state.synced[key]) void persist(key, state, true);
    }
    const timer = window.setTimeout(() => void flush(), FLUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, persist, flush]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  /**
   * Sign off + submit. Offline, the sign-off is stored and queued: the survey is only marked submitted once the
   * server accepts it (an offline queue is NOT a submitted state).
   */
  const submit = useCallback(
    async (signedAt: string) => {
      if (submitting_.current) return;
      if (!navigator.onLine) {
        dispatch({
          type: 'update',
          key: 'signoff',
          recipe: ((data: SectionDataMap['signoff']) => ({ ...data, signedAt, declaration: true, pendingSubmit: true })) as (data: never) => unknown,
        });
        return;
      }
      submitting_.current = true;
      try {
        await submitSurvey({ jobRef, clientRequestId: crypto.randomUUID(), signoff: { surveyorName, declaration: true, signedAt } }).unwrap();
        const submittedAt = new Date().toISOString();
        dispatch({
          type: 'update',
          key: 'signoff',
          recipe: ((data: SectionDataMap['signoff']) => ({ ...data, signedAt, declaration: true, pendingSubmit: false, submittedAt })) as (data: never) => unknown,
        });
        dispatch({ type: 'complete', key: 'signoff', value: true });
      } catch {
        // surfaced through submitFailed; the surveyor can retry
      } finally {
        submitting_.current = false;
      }
    },
    [jobRef, submitSurvey, surveyorName],
  );

  // A sign-off queued while offline is submitted when connectivity returns.
  const queuedSignedAt = state.data.signoff.pendingSubmit && !state.data.signoff.submittedAt ? state.data.signoff.signedAt : undefined;
  useEffect(() => {
    if (online && queuedSignedAt) void submit(queuedSignedAt);
  }, [online, queuedSignedAt, submit]);

  const update = useCallback<RunbookContextValue['update']>((key, recipe) => {
    dispatch({ type: 'update', key, recipe: recipe as (data: never) => unknown });
  }, []);
  const setCompleted = useCallback((key: SectionKey, value: boolean) => dispatch({ type: 'complete', key, value }), []);

  const model = useMemo<RunbookModel>(
    () => ({ jobRef, surveyorName, data: state.data, completed: state.completed, bomRows }),
    [jobRef, surveyorName, state.data, state.completed, bomRows],
  );
  const summaries = useMemo(() => computeSummaries(model), [model]);
  const issues = useMemo(() => computeIssues(model), [model]);
  const progress = useMemo(() => computeProgress(summaries), [summaries]);
  const pendingSections = STORED.filter((key) => state.versions[key] > state.synced[key]).length;
  const pendingChanges = STORED.reduce((sum, key) => sum + Math.max(0, state.versions[key] - state.synced[key]), 0);

  const value = useMemo<RunbookContextValue>(
    () => ({
      jobRef,
      surveyorName,
      model,
      summaries,
      issues,
      progress,
      pendingSections,
      pendingChanges,
      online,
      readOnly: !!state.data.signoff.submittedAt,
      submit,
      submitting,
      submitFailed,
      update,
      setCompleted,
      openSection: onOpenSection,
    }),
    [jobRef, surveyorName, model, summaries, issues, progress, pendingSections, pendingChanges, online, state.data.signoff.submittedAt, submit, submitting, submitFailed, update, setCompleted, onOpenSection],
  );

  return <RunbookContext.Provider value={value}>{children}</RunbookContext.Provider>;
}
