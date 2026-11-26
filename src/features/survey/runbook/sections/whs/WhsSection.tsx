import { useState } from 'react';
import { Callout } from '@/components/ui/Callout';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { formatCompletedAt } from '../../../format';
import { WHS_OPTION_LABEL, WHS_QUESTIONS, type WhsQuestion } from '../../config/whsConfig';
import { hazardsLogged, whsProblems } from '../../logic/whs';
import type { WhsAnswer, YesNoNa } from '../../model/types';
import { useRunbook } from '../../state/runbookContext';
import { SectionFooter } from '../shared/SectionFooter';
import styles from './WhsSection.module.scss';

const EMPTY: WhsAnswer = { value: null, details: '' };

/** Section 1: WHS Check. Every question has a "Log location / details" box; hazards flag when answered Yes. */
export function WhsSection() {
  const { model, update, setCompleted, pendingSections } = useRunbook();
  const data = model.data.whs;
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const problems = whsProblems(data);
  const complete = model.completed.whs && problems.length === 0;
  const logged = hazardsLogged(data);

  function setAnswer(code: string, patch: Partial<WhsAnswer>) {
    update('whs', (current) => ({
      ...current,
      answers: { ...current.answers, [code]: { ...(current.answers[code] ?? EMPTY), ...patch } },
    }));
  }

  function renderQuestion(question: WhsQuestion) {
    const answer = data.answers[question.code] ?? EMPTY;
    const flagged = question.hazard && answer.value === 'yes';
    const detailsMissing = flagged && answer.details.trim() === '' && touched[question.code];
    return (
      <div key={question.code} className={styles.question}>
        <p className={styles.label} id={`${question.code}-label`}>
          {question.label}
        </p>
        <ChoiceGroup
          label={question.label}
          options={question.options.map((value) => ({ value, label: WHS_OPTION_LABEL[value] }))}
          value={answer.value}
          onChange={(value) => setAnswer(question.code, { value: value as YesNoNa })}
        />
        {flagged && <Callout tone="warning">Logged and flagged in WHS Notes.</Callout>}
        <Input
          label="Log location / details"
          value={answer.details}
          placeholder="Not recorded"
          error={detailsMissing ? 'Add details for this hazard.' : undefined}
          onChange={(event) => setAnswer(question.code, { details: event.target.value })}
          onBlur={() => setTouched((current) => ({ ...current, [question.code]: true }))}
          id={`${question.code}-details`}
        />
      </div>
    );
  }

  return (
    <>
      {complete && (
        <Callout tone="success">
          WHS check completed {data.completedAt ? formatCompletedAt(data.completedAt) : ''}. You can update answers at any time.
        </Callout>
      )}

      <div className={styles.questions}>{WHS_QUESTIONS.map(renderQuestion)}</div>

      <Textarea
        label="SURVEYOR NOTES ON SITE HAZARDS"
        rows={3}
        value={data.hazardNotes}
        placeholder="Not recorded"
        onChange={(event) => update('whs', (current) => ({ ...current, hazardNotes: event.target.value }))}
      />

      {logged > 0 && (
        <Callout tone="warning">
          {logged} item{logged === 1 ? '' : 's'} logged in WHS Notes — consolidated in the CWP report on sign-off.
        </Callout>
      )}

      <SectionFooter
        notes={data.siteNotes}
        onNotesChange={(value) => update('whs', (current) => ({ ...current, siteNotes: value }))}
        canComplete={problems.length === 0}
        complete={complete}
        onComplete={() => {
          const completedAt = new Date().toISOString();
          update('whs', (current) => ({ ...current, completedAt }));
          setCompleted('whs', true);
        }}
        blockedHint={`To complete WHS: ${problems.join('; ')}.`}
        completeHint={`WHS record complete · ${pendingSections > 0 ? 'Saved locally · Pending sync' : 'Saved'}`}
      />
    </>
  );
}
