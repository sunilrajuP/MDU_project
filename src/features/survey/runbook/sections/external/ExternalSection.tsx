import { Callout } from '@/components/ui/Callout';
import { EXTERNAL_QUESTIONS, EXTERNAL_TOTAL } from '../../config/externalConfig';
import { externalDoneCount, firstPendingExternal } from '../../logic/external';
import { isBlank } from '../../logic/common';
import type { ItemState } from '../../model/types';
import { emptyItem, isItemDone } from '../../questions/questionLogic';
import { QuestionCard } from '../../questions/QuestionCard';
import { useRunbook } from '../../state/runbookContext';
import { SectionFooter } from '../shared/SectionFooter';
import styles from './ExternalSection.module.scss';

/** Section 3: External Network & Site Entry. Each question: evidence, mandatory notes, any extra fields. */
export function ExternalSection() {
  const { jobRef, model, update, setCompleted, pendingSections } = useRunbook();
  const data = model.data.external;

  const done = externalDoneCount(data.items);
  const pending = firstPendingExternal(data.items);
  const notesMissing = isBlank(data.siteNotes);
  const canComplete = !pending && !notesMissing;
  const complete = model.completed.external && canComplete;

  const setItem = (code: string, next: ItemState) =>
    update('external', (current) => ({ ...current, items: { ...current.items, [code]: next } }));

  let blockedHint = 'Add the site surveyor notes before marking this section complete.';
  if (pending) blockedHint = `Resolve ${pending.resolveHint} before marking this section complete.`;

  return (
    <>
      <Callout tone="info">
        {done}/{EXTERNAL_TOTAL} items confirmed{pending ? ` · ${pending.pendingMessage} Section confirmation is disabled.` : ''}
      </Callout>

      <div className={styles.items}>
        {EXTERNAL_QUESTIONS.map((question) => {
          const state = data.items[question.code] ?? emptyItem();
          const metaLine = question.mandatory
            ? 'Mandatory · Blocks sign-off'
            : `Standard${isItemDone(state) ? '' : ' · Incomplete'}`;
          return (
            <QuestionCard
              key={question.code}
              def={question}
              state={state}
              variant="external"
              jobRef={jobRef}
              context={{ sectionKey: 'external', tag: `External · ${question.code}` }}
              metaLine={metaLine}
              onChange={(next) => setItem(question.code, next)}
            />
          );
        })}
      </div>

      <SectionFooter
        notes={data.siteNotes}
        onNotesChange={(value) => update('external', (current) => ({ ...current, siteNotes: value }))}
        canComplete={canComplete}
        complete={complete}
        onComplete={() => setCompleted('external', true)}
        blockedHint={blockedHint}
        completeHint={`External Network & Site Entry complete · ${pendingSections > 0 ? 'Saved locally · Pending sync' : 'Saved'}`}
      />
    </>
  );
}
