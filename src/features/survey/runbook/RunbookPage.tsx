import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Callout } from '@/components/ui/Callout';
import { Button } from '@/components/ui/Button';
import {
  useGetBomQuery,
  useGetRunbookConfigQuery,
  useGetRunbookQuery,
  useGetSurveyorJobQuery,
} from '@/api/surveyorApi';
import { PATHS } from '@/app/paths';
import { useAppSelector } from '@/store/hooks';
import { selectAuth } from '@/features/auth/authSlice';
import type { BomRow, RunbookConfig, SectionKey } from '@/types/surveyor';
import { SECTION_ORDER } from './model/defaults';
import { buildInitial, type InitialRunbook } from './model/initial';
import { SECTION_COMPONENTS } from './sections/registry';
import { RunbookShell } from './shell/RunbookShell';
import { SectionAccordion } from './shell/SectionAccordion';
import { SurveyGuideCard } from './shell/SurveyGuideCard';
import { RunbookProvider } from './state/RunbookProvider';
import { useRunbook } from './state/runbookContext';
import { useRunbookDrafts } from './state/useRunbookDrafts';
import styles from './RunbookPage.module.scss';

const pad = (position: number) => String(position).padStart(2, '0');

interface FrameProps {
  siteName: string;
  config: RunbookConfig;
  expanded: SectionKey | null;
  onToggle: (key: SectionKey) => void;
  /** Opens a section without ever collapsing it (Continue, pre-flight links). */
  onOpen: (key: SectionKey) => void;
}

/** Everything inside the provider: the shell (header, tabs, Continue) and the 9 rows. */
function RunbookFrame({ siteName, config, expanded, onToggle, onOpen }: Readonly<FrameProps>) {
  const { jobRef, summaries, progress, pendingSections, readOnly } = useRunbook();
  const nextKey = progress.current;
  const nextTitle = nextKey ? config.sections.find((section) => section.key === nextKey)?.title ?? null : null;
  const position = expanded ? SECTION_ORDER.indexOf(expanded) + 1 : 0;

  let hint = 'All changes saved';
  if (expanded) hint = `Viewing step ${pad(position)} · scroll for all steps`;
  else if (pendingSections > 0) hint = 'Saved locally · pending sync';

  return (
    <RunbookShell jobRef={jobRef} onContinue={() => onOpen(nextKey ?? 'signoff')}>
      <div className={styles.titleRow}>
        <div>
          <h2 className={styles.jobTitle}>
            {jobRef} · {siteName}
          </h2>
          <p className={styles.jobSubtitle}>
            Site survey · {jobRef} · {pendingSections > 0 ? 'Draft saved locally' : 'All changes synced'}
          </p>
        </div>
      </div>

      <SurveyGuideCard
        percent={progress.percent}
        completeCount={progress.completeCount}
        total={progress.total}
        nextTitle={nextTitle}
        onContinue={() => onOpen(nextKey ?? 'signoff')}
      />

      <div className={styles.listHeader}>
        <span className={styles.listTitle}>Your survey steps · {progress.total} steps</span>
        <span className={styles.listHint}>{hint}</span>
      </div>

      <div className={styles.list}>
        {config.sections.map((section, index) => {
          const Body = SECTION_COMPONENTS[section.key];
          const following = config.sections[index + 1];
          return (
            <SectionAccordion
              key={section.key}
              sectionKey={section.key}
              position={section.order}
              title={section.title}
              subtitle={section.subtitle}
              summary={summaries[section.key]}
              isCurrent={nextKey === section.key}
              expanded={expanded === section.key}
              readOnly={readOnly}
              onToggle={() => onToggle(section.key)}
              footer={following && <Button type="button" onClick={() => onOpen(following.key)}>Next</Button>}
            >
              <Body />
            </SectionAccordion>
          );
        })}
      </div>
    </RunbookShell>
  );
}

interface ViewProps {
  jobRef: string;
  siteName: string;
  config: RunbookConfig;
  initial: InitialRunbook;
  bomRows: BomRow[];
  surveyorName: string;
}

function RunbookView({ jobRef, siteName, config, initial, bomRows, surveyorName }: Readonly<ViewProps>) {
  const [expanded, setExpanded] = useState<SectionKey | null>(null);

  /** Toggles a section (one open at a time) and scrolls it into view when it opens. */
  const toggle = useCallback((key: SectionKey) => {
    setExpanded((current) => (current === key ? null : key));
    window.requestAnimationFrame(() => document.getElementById(`runbook-${key}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }, []);

  /** Open (never collapse) a section: used by Continue, Pre-flight cards and cross-section links. */
  const open = useCallback((key: SectionKey) => {
    setExpanded(key);
    window.requestAnimationFrame(() => document.getElementById(`runbook-${key}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }, []);

  return (
    <RunbookProvider jobRef={jobRef} surveyorName={surveyorName} initial={initial} bomRows={bomRows} onOpenSection={open}>
      <RunbookFrame siteName={siteName} config={config} expanded={expanded} onToggle={toggle} onOpen={open} />
    </RunbookProvider>
  );
}

export function RunbookPage() {
  const { jobRef = '' } = useParams();
  const surveyorName = useAppSelector(selectAuth).name ?? 'Surveyor';
  const job = useGetSurveyorJobQuery(jobRef);
  const config = useGetRunbookConfigQuery();
  const runbook = useGetRunbookQuery(jobRef);
  const bom = useGetBomQuery(jobRef);
  const drafts = useRunbookDrafts(jobRef);

  const initial = useMemo(
    () => (runbook.data && drafts ? buildInitial(runbook.data, drafts) : undefined),
    [runbook.data, drafts],
  );

  if (job.isError || runbook.isError || config.isError) {
    return (
      <RunbookShell jobRef={jobRef}>
        <Callout tone="danger">
          This survey could not be loaded. <Link to={PATHS.SURVEYOR_ROOT}>Back to My Jobs</Link>
        </Callout>
      </RunbookShell>
    );
  }

  if (!job.data || !config.data || !initial || bom.isLoading) {
    return (
      <RunbookShell jobRef={jobRef}>
        <p role="status">Loading survey…</p>
      </RunbookShell>
    );
  }

  return (
    <RunbookView
      key={jobRef}
      jobRef={jobRef}
      siteName={job.data.siteName}
      config={config.data}
      initial={initial}
      bomRows={bom.data?.rows ?? []}
      surveyorName={surveyorName}
    />
  );
}
