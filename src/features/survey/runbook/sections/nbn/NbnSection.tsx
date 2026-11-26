import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Input } from '@/components/ui/Input';
import { formatCompletedAt } from '../../../format';
import { isBlank } from '../../logic/common';
import { readyCount, planOf } from '../../logic/floorPlans';
import { designValue, nbnLogic, siteValue, type DesignKey, type SiteKey } from '../../logic/nbn';
import { useRunbook } from '../../state/runbookContext';
import { SectionFooter } from '../shared/SectionFooter';
import styles from './NbnSection.module.scss';

const opts = (...labels: string[]) => labels.map((label) => ({ value: label, label }));
const YES_NO_UNKNOWN = opts('Yes', 'No', 'Unknown');

/** Section 6: NBN Design Inputs. Site details flow in from earlier sections; the surveyor can override them. */
export function NbnSection() {
  const { model, update, setCompleted, openSection } = useRunbook();
  const { nbnDesign: data, bfd, internal, floorPlans } = model.data;
  const [notesTouched, setNotesTouched] = useState(false);

  const issues = nbnLogic.issues(model);
  const complete = model.completed.nbnDesign && issues.length === 0;
  const floors = internal.floors;
  const ready = readyCount(floorPlans, floors);
  const totalSheets = floors.reduce((sum, floor) => sum + planOf(floorPlans, floor.code).media.length, 0);

  const site = (key: SiteKey) => siteValue(model, key) ?? '';
  const design = (key: DesignKey) => designValue(model, key) ?? '';
  const setSite = (key: SiteKey, value: string) =>
    update('nbnDesign', (current) => ({ ...current, site: { ...current.site, [key]: value } }));
  const setDesign = (key: DesignKey, value: string) =>
    update('nbnDesign', (current) => ({ ...current, design: { ...current.design, [key]: value } }));

  const summaryParts = [
    site('eup') && `EUP ${site('eup')}`,
    site('p2p') && `P2P ${site('p2p')}`,
    site('floors') && `Floors ${site('floors')}${site('basement') ? ` + ${site('basement')} basement` : ''}`,
    site('fibreTv') && `Fibre TV ${site('fibreTv')}`,
    site('mduSolution') && `Solution ${site('mduSolution')}`,
  ].filter(Boolean);

  const numberField = (key: SiteKey, label: string) => (
    <Input label={label} inputMode="numeric" value={site(key)} onChange={(event) => setSite(key, event.target.value)} id={`nbn-${key}`} />
  );
  const choiceField = (label: string, options: ReturnType<typeof opts>, value: string, onChange: (value: string) => void) => (
    <div className={styles.choice}>
      <span className={styles.choiceLabel}>{label}</span>
      <ChoiceGroup label={label} options={options} value={value || null} onChange={onChange} />
    </div>
  );

  return (
    <>
      {bfd.selection ? (
        <div className={styles.bfd}>
          <span className={styles.eyebrow}>BFD SELECTED · {bfd.selection.figure.toUpperCase()} WIZARD</span>
          <span className={styles.bfdCode}>{bfd.selection.code}</span>
          <span className={styles.bfdLine}>{bfd.selection.rationale}</span>
          <span className={styles.bfdMeta}>{formatCompletedAt(bfd.selection.savedAt)} · Selection saved</span>
          <Button type="button" variant="secondary" className={styles.review} onClick={() => openSection('bfd')}>
            Review wizard
          </Button>
        </div>
      ) : (
        <Callout tone="warning">
          No BFD selected yet.{' '}
          <button type="button" className={styles.link} onClick={() => openSection('bfd')}>
            Open the BFD Selection Wizard
          </button>
        </Callout>
      )}

      <Card className={styles.group}>
        <h3 className={styles.groupTitle}>Site Survey Details</h3>
        <p className={styles.eyebrowText}>COMPLETED BY SURVEYOR ON SITE</p>
        {numberField('floors', 'FLOORS (ABOVE GROUND)')}
        {numberField('basement', 'BASEMENT LEVELS')}
        {numberField('eup', 'TOTAL EUP (LETTERBOX)')}
        {numberField('commonAreas', 'COMMON AREAS')}
        {numberField('p2p', 'BUSINESS / P2P')}
        {choiceField('FIBRE TV', YES_NO_UNKNOWN, site('fibreTv'), (value) => setSite('fibreTv', value))}
        {choiceField('MDU SOLUTION', opts('MT-LFN', 'MDU Type 3', 'Mixed'), site('mduSolution'), (value) => setSite('mduSolution', value))}
      </Card>

      <Card className={styles.group}>
        <h3 className={styles.groupTitle}>Group B · NBN Design Inputs</h3>
        <p className={styles.note}>
          EUP, P2P, floors, Fibre TV and solution type flow in from Site Survey Details above — no double entry.
        </p>
        {summaryParts.length > 0 && <Callout tone="info">{summaryParts.join(' · ')}</Callout>}
        {choiceField('FDT INSTALLATION REQUIRED', YES_NO_UNKNOWN, design('fdt'), (value) => setDesign('fdt', value))}
        {choiceField('PIT & PIPE AVAILABLE TO EACH EUP', opts('Yes', 'No'), design('pitPipe'), (value) => setDesign('pitPipe', value))}
        {choiceField(
          'CABLING SOLUTION PER FLOOR',
          opts('PIC direct', 'PIC to ICD', 'Rugged PIC', 'Adhesive Clear Track'),
          design('cabling'),
          (value) => setDesign('cabling', value),
        )}
        {design('cabling') && (
          <p className={styles.note}>
            Selected design input: {design('cabling')}. Confirm the pathway for each configured floor against the survey records.
          </p>
        )}
        <Input
          label="SURVEYOR NOTES *"
          value={data.design.notes ?? ''}
          placeholder="Not recorded"
          error={notesTouched && isBlank(data.design.notes) ? 'Required: add design input notes before completing this section.' : undefined}
          onChange={(event) => update('nbnDesign', (current) => ({ ...current, design: { ...current.design, notes: event.target.value } }))}
          onBlur={() => setNotesTouched(true)}
          id="nbn-design-notes"
        />
      </Card>

      <Card className={styles.group}>
        <h3 className={styles.groupTitle}>Relevant plan uploads</h3>
        <p className={styles.note}>Use the same floor-plan records. No duplicate upload is required.</p>
        <Callout tone={ready === floors.length ? 'success' : 'warning'}>
          {totalSheets === 0 ? 'No plans uploaded' : `${ready}/${floors.length} plans ready`} · {floors.length} configured floors require plan evidence.
        </Callout>
        <Button type="button" variant="outline" onClick={() => openSection('floorPlans')}>
          Review Floor Plans · Step 05
        </Button>
      </Card>

      <SectionFooter
        notes={data.siteNotes}
        onNotesChange={(value) => update('nbnDesign', (current) => ({ ...current, siteNotes: value }))}
        canComplete={issues.length === 0}
        complete={complete}
        onComplete={() => setCompleted('nbnDesign', true)}
        blockedHint="Add surveyor notes and relevant plans before confirming NBN Design Inputs."
        completeHint="NBN Design Inputs complete · Saved locally · Pending sync"
      />
    </>
  );
}
