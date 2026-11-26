import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Input } from '@/components/ui/Input';
import { StatusChip } from '@/components/ui/StatusChip';
import { useRunbook } from '../../state/runbookContext';
import styles from './SignoffSection.module.scss';

const DECLARATION =
  'I confirm this survey is accurate, all mandatory evidence has been captured and the design inputs and BoM have been reviewed.';

/** Section 9: Surveyor Sign-off & Submit. Locked until Pre-flight Validation passes. */
export function SignoffSection() {
  const { model, issues, update, submit, submitting, submitFailed, pendingChanges, online, surveyorName } = useRunbook();
  const data = model.data.signoff;
  const [now] = useState(() => new Date());

  const locked = issues.length > 0;
  const submitted = !!data.submittedAt;
  const queued = !!data.pendingSubmit && !submitted;
  const canSubmit = !locked && data.declaration && !submitted && !queued && !submitting;

  let chip = <StatusChip tone="warning">Draft · Not submitted</StatusChip>;
  if (submitted) chip = <StatusChip tone="success">Submitted</StatusChip>;
  else if (queued) chip = <StatusChip tone="warning">Signed off · Submission pending sync</StatusChip>;

  const receipt = data.submittedAt
    ? `Submission receipt ${new Date(data.submittedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}`
    : 'No submission receipt';

  return (
    <>
      {locked && (
        <Callout tone="warning">
          Sign-off locked · Pre-flight validation has outstanding mandatory checks. Review the details below; signing and
          submission remain disabled.
        </Callout>
      )}
      {queued && (
        <Callout tone="warning">
          Signed off on this device. The survey will be submitted when you are back online. It is not submitted yet.
        </Callout>
      )}
      {submitted && <Callout tone="success">Survey submitted. It is now read-only.</Callout>}
      {submitFailed && !submitted && !queued && <Callout tone="danger">The survey could not be submitted. Please try again.</Callout>}

      <div>{chip}</div>

      <Input label="Surveyor name" value={surveyorName} readOnly />
      <Input
        label="Survey date"
        value={now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        readOnly
      />
      <Input
        label="Review time"
        value={`${now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })} · Local device time`}
        readOnly
      />

      <label className={[styles.declaration, locked ? styles.disabled : ''].filter(Boolean).join(' ')}>
        <input
          type="checkbox"
          checked={data.declaration}
          disabled={locked || submitted}
          onChange={(event) => update('signoff', (current) => ({ ...current, declaration: event.target.checked }))}
        />
        <span>{DECLARATION}</span>
      </label>

      <Button
        type="button"
        variant={canSubmit ? 'primary' : 'secondary'}
        disabled={!canSubmit}
        onClick={() => void submit(new Date().toISOString())}
      >
        {submitting ? 'Submitting…' : online ? 'Sign off & Submit' : 'Sign off & queue submission'}
      </Button>

      <Callout tone="info">
        The survey becomes read-only only after successful submission. A local draft or offline submission pending sync is not
        a submitted success state.
      </Callout>

      <p className={styles.footnote}>
        Current record: {pendingChanges > 0 ? 'draft saved locally' : 'all changes synced'} · {pendingChanges} change
        {pendingChanges === 1 ? '' : 's'} pending sync · {receipt}
      </p>
    </>
  );
}
