import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGetBackendSurveyQuery, useSaveBackendSurveyAnswersMutation, useSubmitBackendSurveyMutation } from '@/api/surveyorApi';
import { PATHS } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Input } from '@/components/ui/Input';
import { backendSurveyRepo, pendingAnswer } from '@/data/repos/backendSurveyRepo';
import { runbookRepo } from '@/data/repos/runbookRepo';
import { mediaRepo } from '@/data/repos/mediaRepo';
import type { BackendSurveyRecord } from '@/data/db/schema';
import { selectAuth } from '@/features/auth/authSlice';
import { useAppSelector } from '@/store/hooks';
import { normalizeChoice, type SurveyAnswer, type SurveyCardAnswers, type SurveyItem, type SurveySection } from '@/types/backendSurvey';
import type { MediaAttachment, SectionKey } from '@/types/surveyor';
import { EvidenceCapture } from '../capture/EvidenceCapture';
import { useOnlineStatus } from '../useOnlineStatus';
import { RunbookShell } from './shell/RunbookShell';
import { SectionAccordion } from './shell/SectionAccordion';
import { SurveyGuideCard } from './shell/SurveyGuideCard';
import styles from './RunbookPage.module.scss';

const SECTION_KEYS: Record<string, SectionKey> = {
  WHS: 'whs',
  BFD_WIZARD: 'bfd',
  EXTERNAL_NETWORK: 'external',
  INTERNAL_NETWORK: 'internal',
  FLOOR_PLANS: 'floorPlans',
  NBN_DESIGN: 'nbnDesign',
  BOM: 'bom',
  PRE_FLIGHT: 'preflight',
  SIGN_OFF: 'signoff',
};

// Sections whose every question carries photo upload + markup.
const PHOTO_SECTIONS = new Set<SectionKey>(['external']);

// Only these sections collect a per-question note.
const NOTE_SECTIONS = new Set<SectionKey>(['whs', 'external', 'internal']);

const answerKey =(sectionId: number, itemId: number) => `${sectionId}:${itemId}`;
const isReadOnly = (status: string) => ['submitted', 'approved'].includes(status.toLowerCase());
const message = (error: unknown) =>
  error instanceof Error ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message : 'Please try again.';

function answerFor(record: BackendSurveyRecord, section: SurveySection, item: SurveyItem): SurveyAnswer {
  return pendingAnswer(record, section.id, item.id) ?? {
    itemId: item.id,
    value: item.responseValue ?? '',
    isFlagged: item.isFlagged,
    note: item.note ?? '',
  };
}

function cardsForSection(record: BackendSurveyRecord, sectionId: number): SurveyCardAnswers[] {
  const section = record.survey.sections.find((entry) => entry.id === sectionId);
  if (!section) throw new Error('The survey section could not be found.');
  const answers = section.repeatPerFloor ? [] : [...section.items]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .filter((item) => item.answerType === 'TEXT' || item.answerType === 'YES_NO_NA' || item.answerType === 'PHOTO')
    .map((item): SurveyAnswer => item.answerType === 'PHOTO'
      ? { itemId: item.id, value: '', isFlagged: false, note: '', photo: true }
      : answerFor(record, section, item));
  return [{ sectionId: section.id, answers }];
}

interface PhotoTarget { jobRef: string; jobId: number; sessionId: string; sectionKey: SectionKey; disabled: boolean }

/** Photo capture (with markup) for one survey item. Uploads go to the survey-session media API. */
function ItemPhotos({ item, target }: Readonly<{ item: SurveyItem; target: PhotoTarget }>) {
  const context = { sectionKey: target.sectionKey, itemCode: `item-${item.id}`, tag: `External · ${item.code}` };
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  useEffect(() => {
    let active = true;
    void mediaRepo.forItem(target.jobRef, context).then((records) => {
      if (active) {
        setMedia(records.filter((record) => record.kind === 'photo')
          .map((record) => ({ id: record.id, kind: record.kind, capturedAt: record.capturedAt, hasMarkup: !!record.markedBlob })));
      }
    }).catch(() => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.jobRef, target.sectionKey, item.id]);
  return (
    <EvidenceCapture
      jobRef={target.jobRef}
      context={context}
      itemLabel={item.prompt}
      value={media}
      allowVideo={false}
      disabled={target.disabled}
      onChange={setMedia}
      backendUpload={{ jobId: target.jobId, sessionId: target.sessionId, itemId: item.id }}
    />
  );
}

function Question({
  item, answer, showNote, photoTarget, onChange,
}: Readonly<{ item: SurveyItem; answer: SurveyAnswer; showNote: boolean; photoTarget?: PhotoTarget; onChange: (answer: SurveyAnswer) => void }>) {
  if (item.answerType === 'PHOTO') {
    if (photoTarget) {
      return (
        <div className={styles.question}>
          <p>{item.prompt}{item.isRequired ? ' *' : ''}</p>
          <ItemPhotos item={item} target={photoTarget} />
        </div>
      );
    }
    return <Callout tone="warning">{item.prompt}: photo upload is not available yet.</Callout>;
  }
  if (item.answerType !== 'TEXT' && item.answerType !== 'YES_NO_NA') {
    return <Callout tone="warning">{item.prompt}: unsupported answer type {item.answerType}.</Callout>;
  }
  return (
    <div className={styles.question}>
      {item.answerType === 'TEXT' ? (
        <Input
          id={`survey-item-${item.sectionId}-${item.id}`}
          label={item.prompt}
          tag={item.isRequired ? 'Required' : undefined}
          value={answer.value}
          onChange={(event) => onChange({ ...answer, value: event.target.value })}
        />
      ) : (
        <>
          <p>{item.prompt}{item.isRequired ? ' *' : ''}</p>
          <ChoiceGroup
            label={item.prompt}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
              { value: 'N/A', label: 'N/A' },
            ]}
            value={normalizeChoice(answer.value) || null}
            onChange={(value) => onChange({ ...answer, value })}
          />
        </>
      )}
      {showNote && (
        <Input
          id={`survey-note-${item.sectionId}-${item.id}`}
          label={`Note: ${item.prompt}`}
          value={answer.note}
          onChange={(event) => onChange({ ...answer, note: event.target.value })}
        />
      )}
      {/* <label>
        <input type="checkbox" checked={answer.isFlagged} onChange={(event) => onChange({ ...answer, isFlagged: event.target.checked })} />
        {' '}Flag this answer
      </label> */}
      {photoTarget && <ItemPhotos item={item} target={photoTarget} />}
      {!photoTarget && item.minPhotos > 0 && <Callout tone="warning">This item also requires photos. Photo upload is not available yet.</Callout>}
    </div>
  );
}

export function BackendRunbookPage() {
  const { jobRef = '' } = useParams();
  const { userId } = useAppSelector(selectAuth);
  if (!userId || !jobRef) return <RunbookShell jobRef={jobRef}><p role="status">Loading survey…</p></RunbookShell>;
  return <BackendRunbook key={JSON.stringify([userId, jobRef])} userId={userId} jobRef={jobRef} />;
}

function BackendRunbook({ userId, jobRef }: Readonly<{ userId: string; jobRef: string }>) {
  const online = useOnlineStatus();
  // Loading the survey also calls survey-start, so the session is resumed or opened as part of the query.
  const query = useGetBackendSurveyQuery({ jobRef, userId }, { refetchOnMountOrArgChange: true });
  const [saveAnswers] = useSaveBackendSurveyAnswersMutation();
  const [submitSurvey, { isLoading: submitting }] = useSubmitBackendSurveyMutation();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState('');
  const [record, setRecord] = useState<BackendSurveyRecord>();
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [legacyDrafts, setLegacyDrafts] = useState(false);
  const [discardedPending, setDiscardedPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [expanded, setExpanded] = useState<SectionKey | null>(null);
  const recordRef = useRef<BackendSurveyRecord | undefined>(undefined);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const writeCount = useRef(0);
  const saving = useRef(false);
  const active = useRef(true);

  const setCurrent = useCallback((next: BackendSurveyRecord) => {
    recordRef.current = next;
    setRecord(next);
  }, []);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!userId || !jobRef) return;
    let active = true;
    async function load() {
      try {
        const oldDrafts = await runbookRepo.forJob(jobRef);
        if (active) setLegacyDrafts(oldDrafts.length > 0);
        if (query.data) {
          const next = await backendSurveyRepo.receive(userId!, jobRef, query.data);
          if (active) {
            setCurrent(next.record);
            if (next.discardedPending) setDiscardedPending(true);
          }
        } else if (query.isError) {
          const status = 'status' in query.error ? query.error.status : undefined;
          if (status === 0) {
            const cached = await backendSurveyRepo.get(userId!, jobRef);
            if (cached) {
              if (active) setCurrent(cached);
              return;
            }
          }
          if (active) setError(message(query.error));
        }
      } catch (reason) {
        if (active) setError(message(reason));
      }
    }
    void load();
    return () => { active = false; };
  }, [jobRef, userId, query.data, query.isError, query.error, setCurrent]);

  const edit = (sectionId: number, answer: SurveyAnswer) => {
    const current = recordRef.current;
    if (!current || !userId) return;
    setCurrent({ ...current, pending: { ...current.pending, [answerKey(sectionId, answer.itemId)]: answer } });
    writeCount.current += 1;
    setWriting(true);
    writes.current = writes.current.then(async () => {
      await backendSurveyRepo.edit(userId, jobRef, sectionId, answer);
    });
    void writes.current.catch((reason: unknown) => setStorageError(message(reason))).finally(() => {
      writeCount.current -= 1;
      if (active.current && writeCount.current === 0) setWriting(false);
    });
  };

  const retryStorage = async () => {
    const current = recordRef.current;
    if (!current || !userId) return;
    setBusy(true);
    try {
      for (const [key, answer] of Object.entries(current.pending)) {
        await backendSurveyRepo.edit(userId, jobRef, Number(key.split(':')[0]), answer);
      }
      writes.current = Promise.resolve();
      setStorageError('');
    } catch (reason) {
      setStorageError(message(reason));
    } finally {
      setBusy(false);
    }
  };

  const sync = useCallback(async (requestedSectionId?: number) => {
    if (saving.current || !userId || !recordRef.current || isReadOnly(recordRef.current.survey.status) ||
        !navigator.onLine || storageError) return;
    saving.current = true;
    setBusy(true);
    setSyncError('');
    try {
      await writes.current;
      let current = await backendSurveyRepo.get(userId, jobRef);
      if (!current) throw new Error('The local survey could not be found.');
      const sections = [...current.survey.sections].sort((a, b) => a.sortOrder - b.sortOrder);
      for (const section of sections) {
        const answers = section.items
          .map((item) => pendingAnswer(current!, section.id, item.id))
          .filter((answer): answer is SurveyAnswer => answer !== undefined);
        if (!answers.length && section.id !== requestedSectionId) continue;
        const cards = cardsForSection(current, section.id);
        const response = await saveAnswers({
          jobId: current.survey.jobId,
          userId,
          sessionId: current.survey.sessionId,
          sectionId: section.id,
          cards,
        }).unwrap();
        for (const card of cards) {
          current = await backendSurveyRepo.acknowledge(userId, jobRef, response, card.sectionId, card.answers);
        }
        if (active.current) setCurrent(current);
      }
      if (Object.keys(current.pending).length) {
        throw new Error('Some local answers no longer match the server survey. They remain saved on this device.');
      }
    } catch (reason) {
      if (active.current) setSyncError(message(reason));
    } finally {
      saving.current = false;
      if (active.current) setBusy(false);
    }
  }, [jobRef, saveAnswers, setCurrent, storageError, userId]);

  // Submit is allowed even when not every section is complete. Pending answers are synced first.
  const submit = async () => {
    const current = recordRef.current;
    if (!current || !userId || submitting) return;
    setSubmitError('');
    try {
      await writes.current;
      await sync();
      const latest = await backendSurveyRepo.get(userId, jobRef);
      if (latest && Object.keys(latest.pending).length) {
        setSubmitError('Some answers have not synced yet. Resolve the sync problem and try again.');
        return;
      }
      await submitSurvey({
        jobId: current.survey.jobId,
        sessionId: current.survey.sessionId,
        userId,
        jobRef,
      }).unwrap();
      navigate(PATHS.SURVEYOR_ROOT);
    } catch (reason) {
      if (active.current) setSubmitError(message(reason));
    }
  };

  useEffect(() => {
    if (!record || isReadOnly(record.survey.status) || !online || syncError || storageError || !Object.keys(record.pending).length) return;
    const timer = window.setTimeout(() => void sync(), 1000);
    return () => window.clearTimeout(timer);
  }, [record, online, sync, syncError, storageError]);

  useEffect(() => {
    const retry = () => setSyncError('');
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  if (error) {
    return (
      <RunbookShell jobRef={jobRef}>
        <Callout tone="danger">This survey could not be loaded: {error} <Link to={PATHS.SURVEYOR_ROOT}>Back to My Jobs</Link></Callout>
      </RunbookShell>
    );
  }
  if (!record) return <RunbookShell jobRef={jobRef}><p role="status">Loading survey…</p></RunbookShell>;

  const sections = [...record.survey.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const unknownSection = sections.find((section) => !SECTION_KEYS[section.code]);
  if (unknownSection) {
    return <RunbookShell jobRef={jobRef}><Callout tone="danger">Unsupported survey section: {unknownSection.code}.</Callout></RunbookShell>;
  }
  const complete = (section: SurveySection) =>
    section.isCompleted && !section.items.some((item) => pendingAnswer(record, section.id, item.id));
  const completeCount = sections.filter(complete).length;
  const next = sections.find((section) => !complete(section));
  const openNext = () => { if (next) setExpanded(SECTION_KEYS[next.code]); };
  const pendingCount = Object.keys(record.pending).length;
  const readOnly = isReadOnly(record.survey.status);

  return (
    <RunbookShell
      jobRef={jobRef}
      onContinue={() => void submit()}
      continueDisabled={readOnly || submitting || busy || writing || !online || !!storageError}
    >
      {submitError && <Callout tone="danger">Could not submit the survey: {submitError}</Callout>}
      <div className={styles.titleRow}>
        <div>
          <h2 className={styles.jobTitle}>{record.survey.jobRef}</h2>
          <p className={styles.jobSubtitle} role="status">
            {storageError ? 'Local save failed' : writing ? 'Saving locally' : busy ? 'Syncing answers' : pendingCount ? 'Saved locally · pending sync' : 'Answers synced'}
          </p>
        </div>
      </div>
      {legacyDrafts && <Callout tone="warning">Earlier runbook drafts remain on this device but have not been transferred to the new survey.</Callout>}
      {discardedPending && <Callout tone="warning">Unsynced answers from an earlier survey session were discarded.</Callout>}
      {readOnly && pendingCount > 0 && <Callout tone="warning">This survey is read-only. Pending local answers remain on this device and cannot be synced.</Callout>}
      {storageError && <Callout tone="danger">Could not save your answers locally: {storageError}. Keep this page open. <Button type="button" onClick={() => void retryStorage()}>Retry local save</Button></Callout>}
      {syncError && <Callout tone="danger">Answers remain saved locally but could not sync: {syncError} <Button type="button" onClick={() => void sync()}>Retry</Button></Callout>}
      {!online && <Callout tone="warning">Offline: answers are saved on this device and will sync when connected.</Callout>}
      <SurveyGuideCard
        percent={sections.length ? Math.round(100 * completeCount / sections.length) : 0}
        completeCount={completeCount}
        total={sections.length}
        nextTitle={next?.title ?? null}
        onContinue={openNext}
      />
      <div className={styles.listHeader}><span className={styles.listTitle}>Your survey steps · {sections.length} steps</span></div>
      <div className={styles.list}>
        {sections.map((section, index) => {
          const key = SECTION_KEYS[section.code];
          const following = sections[index + 1];
          const count = section.items.filter((item) => {
            const draft = pendingAnswer(record, section.id, item.id);
            return draft ? draft.value.trim() !== '' : item.isAnswered;
          }).length;
          const done = complete(section);
          return (
            <SectionAccordion
              key={section.id}
              sectionKey={key}
              position={section.sortOrder}
              title={section.title}
              subtitle={`${count} of ${section.items.length} answered`}
              summary={{
                status: done ? 'complete' : count ? 'in_progress' : 'not_started',
                chip: done ? 'Completed' : `${count}/${section.items.length}`,
                tone: done ? 'success' : 'neutral',
                progress: section.items.length ? count / section.items.length : 0,
                done: count,
                total: section.items.length,
              }}
              isCurrent={next?.id === section.id}
              expanded={expanded === key}
              readOnly={readOnly || busy}
              onToggle={() => setExpanded(expanded === key ? null : key)}
              footer={following && (
                <Button
                  type="button"
                  disabled={busy || !!storageError}
                  onClick={() => {
                    if (!readOnly) void sync(section.id);
                    setExpanded(SECTION_KEYS[following.code]);
                    window.requestAnimationFrame(() => document.getElementById(`runbook-${SECTION_KEYS[following.code]}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
                  }}
                >
                  Next
                </Button>
              )}
            >
              {section.repeatPerFloor && <Callout tone="warning">Floor-specific answers are unavailable until floor creation is supported by the API.</Callout>}
              <fieldset disabled={section.repeatPerFloor} className={styles.questions}>
                {[...section.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                  <Question
                    key={item.id}
                    item={item}
                    showNote={NOTE_SECTIONS.has(key)}
                    photoTarget={PHOTO_SECTIONS.has(key) ? { jobRef, jobId: record.survey.jobId, sessionId: record.survey.sessionId, sectionKey: key, disabled: readOnly } : undefined}
                    answer={answerFor(record, section, item)} onChange={(answer) => edit(section.id, answer)} />
                ))}
              </fieldset>
              {key === 'signoff' && <Callout tone="warning">Survey submission is not available through this API yet.</Callout>}
            </SectionAccordion>
          );
        })}
      </div>
    </RunbookShell>
  );
}
