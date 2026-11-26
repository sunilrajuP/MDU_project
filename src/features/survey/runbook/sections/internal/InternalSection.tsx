import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { StatusChip } from '@/components/ui/StatusChip';
import { mediaRepo } from '@/data/repos/mediaRepo';
import {
  BASEMENT_CHECK_TOTAL,
  BASEMENT_ITEMS,
  BUILDING_ITEMS,
  BUILDING_TOTAL,
  FLOOR_CHECK_TOTAL,
  FLOOR_ITEMS,
} from '../../config/internalConfig';
import { emptyFloor } from '../../model/defaults';
import { internalLogic } from '../../logic/internal';
import {
  buildingDone,
  floorStateOf,
  isBasement,
  isFloorComplete,
  isUnitComplete,
  unitDone,
  unitLabel,
} from '../../logic/internal';
import type { FloorDef, FloorState, ItemState, UnitState } from '../../model/types';
import { countDone, emptyItem } from '../../questions/questionLogic';
import type { QuestionDef } from '../../questions/questionTypes';
import { QuestionCard } from '../../questions/QuestionCard';
import { useRunbook } from '../../state/runbookContext';
import { SectionFooter } from '../shared/SectionFooter';
import { ConfigureFloorsDialog } from './ConfigureFloorsDialog';
import { FloorTabs } from './FloorTabs';
import { GroupCard } from './GroupCard';
import { UnitCard } from './UnitCard';
import styles from './InternalSection.module.scss';

/** "GF–L4": the span of non-basement floors, for "Not applicable for ..." */
function aboveRange(floors: FloorDef[]): string {
  const above = floors.filter((floor) => !isBasement(floor));
  if (above.length === 0) return '';
  if (above.length === 1) return above[0].code;
  return `${above[0].code}–${above[above.length - 1].code}`;
}

/** Section 4: Internal Network. Floors -> units (same questions each) -> shared building record, all from config. */
export function InternalSection() {
  const { jobRef, model, update, setCompleted, pendingChanges } = useRunbook();
  const data = model.data.internal;
  const [selected, setSelected] = useState(() => data.floors[0]?.code ?? '');
  const [configuring, setConfiguring] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const floor = data.floors.find((entry) => entry.code === selected) ?? data.floors[0];
  const floorState = floor ? floorStateOf(data, floor.code) : emptyFloor();
  const basement = floor ? isBasement(floor) : false;

  const issues = internalLogic.issues(model);
  const complete = model.completed.internal && issues.length === 0;
  const floorsComplete = data.floors.filter((entry) => isFloorComplete(entry, floorStateOf(data, entry.code))).length;
  const buildingCount = buildingDone(data);
  const locationCode = (data.floors.find(isBasement) ?? data.floors[0])?.code ?? '';

  const updateFloor = (code: string, recipe: (current: FloorState) => FloorState) =>
    update('internal', (current) => ({
      ...current,
      byFloor: { ...current.byFloor, [code]: recipe(current.byFloor[code] ?? emptyFloor()) },
    }));

  const setBuildingItem = (code: string, next: ItemState) =>
    update('internal', (current) => ({
      ...current,
      building: { ...current.building, [code]: next },
      // Reopening any record reopens the shared record as a whole.
      buildingConfirmed: current.buildingConfirmed && next.confirmed,
    }));

  const setGroupItem = (group: 'checklist' | 'basement', code: string, next: ItemState) =>
    updateFloor(floor.code, (current) => ({ ...current, [group]: { ...current[group], [code]: next } }));

  function addUnit() {
    const id = crypto.randomUUID();
    setJustAdded(id);
    updateFloor(floor.code, (current) => {
      const sequence = current.unitSeq + 1;
      const label = unitLabel(floor.code, sequence);
      const unit: UnitState = {
        id,
        label,
        completed: false,
        // The identifier card is filled in automatically and counts as captured.
        items: {
          'unit.identifier': {
            values: { identifier: `${label} · Linked ${jobRef}/${floor.code}` },
            media: [],
            confirmed: true,
          },
        },
      };
      return { ...current, unitSeq: sequence, units: [...current.units, unit] };
    });
  }

  function removeUnit(unit: UnitState) {
    // Delete the unit's stored evidence too; its number is never reused (unitSeq is not rewound).
    for (const item of Object.values(unit.items)) for (const media of item.media) void mediaRepo.remove(media.id);
    updateFloor(floor.code, (current) => ({ ...current, units: current.units.filter((entry) => entry.id !== unit.id) }));
  }

  const renderGroupItems = (defs: QuestionDef[], items: Record<string, ItemState>, group: 'checklist' | 'basement') =>
    defs.map((def, index) => (
      <QuestionCard
        key={def.code}
        def={def}
        state={items[def.code] ?? emptyItem()}
        variant="checklist"
        jobRef={jobRef}
        number={index + 1}
        floorCode={floor.code}
        context={{ sectionKey: 'internal', floorCode: floor.code, tag: `${floor.code} · ${def.code}` }}
        onChange={(next) => setGroupItem(group, def.code, next)}
      />
    ));

  if (!floor) return <Callout tone="warning">No floors are configured. Use Configure floors to add one.</Callout>;

  const completeUnits = floorState.units.filter(isUnitComplete).length;
  const firstUnit = floorState.units[0];
  const floorChecks = countDone(FLOOR_ITEMS, floorState.checklist);
  const basementChecks = countDone(BASEMENT_ITEMS, floorState.basement);

  const summary = [
    `Building ${buildingCount}/${BUILDING_TOTAL} records`,
    `${floor.code} floor ${floorChecks}/${FLOOR_CHECK_TOTAL} checks${basement ? ` + ${basementChecks}/${BASEMENT_CHECK_TOTAL} basement checks` : ''}`,
    firstUnit ? `Unit ${firstUnit.label} ${unitDone(firstUnit)}/8 checks` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Callout tone="info">
        {summary}. {floorsComplete === 0 ? 'No floor is complete.' : `${floorsComplete} floor${floorsComplete === 1 ? '' : 's'} complete.`}{' '}
        {pendingChanges > 0 ? `Draft saved locally; ${pendingChanges} change${pendingChanges === 1 ? '' : 's'} pending sync.` : 'All changes synced.'}
      </Callout>

      <FloorTabs data={data} selected={floor.code} onSelect={setSelected} onConfigure={() => setConfiguring(true)} />

      <div id="floor-panel" role="tabpanel" aria-labelledby={`floor-tab-${floor.code}`} className={styles.panel}>
        <div className={styles.unitsHeading}>
          <h3 className={styles.heading}>
            {floor.code} · {floorState.units.length} unit{floorState.units.length === 1 ? '' : 's'}
          </h3>
          <span className={styles.unitsCount}>
            {completeUnits}/{floorState.units.length} units complete
          </span>
        </div>

        {floorState.units.map((unit, index) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            floorCode={floor.code}
            jobRef={jobRef}
            defaultExpanded={index === 0 || unit.id === justAdded}
            onChange={(next) =>
              updateFloor(floor.code, (current) => ({
                ...current,
                units: current.units.map((entry) => (entry.id === next.id ? next : entry)),
              }))
            }
            onRemove={() => removeUnit(unit)}
          />
        ))}

        <Button type="button" variant="outline" className={styles.addUnit} onClick={addUnit}>
          + Add Unit
        </Button>

        <GroupCard
          title="Building-level shared PoC / BFD"
          subtitle={`Capture once for this building · ${buildingCount}/${BUILDING_TOTAL} records complete · ${BUILDING_TOTAL - buildingCount} pending`}
          progress={(100 * buildingCount) / BUILDING_TOTAL}
        >
          <Callout tone="info">
            Shared record BFD-01 · Located on {locationCode}. {locationCode} references this record; do not duplicate the shared asset form on each floor.
          </Callout>
          {BUILDING_ITEMS.map((def) => (
            <QuestionCard
              key={def.code}
              def={def}
              state={data.building[def.code] ?? emptyItem()}
              variant="checklist"
              jobRef={jobRef}
              context={{ sectionKey: 'internal', tag: `Building · ${def.code}` }}
              onChange={(next) => setBuildingItem(def.code, next)}
            />
          ))}
          {data.buildingConfirmed ? (
            <Callout tone="success">
              <Check size={14} aria-hidden="true" /> Shared building record confirmed.
            </Callout>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={buildingCount < BUILDING_TOTAL}
              onClick={() => update('internal', (current) => ({ ...current, buildingConfirmed: true }))}
            >
              Confirm shared building record
            </Button>
          )}
        </GroupCard>

        <GroupCard
          title={`${floor.code} · Floor-level checklist`}
          subtitle={`${floorChecks}/${FLOOR_CHECK_TOTAL} standard checks confirmed · ${
            floorChecks === FLOOR_CHECK_TOTAL ? 'All evidence confirmed' : basement ? 'All below-floor evidence remains draft' : 'Evidence remains draft until confirmed'
          }`}
          progress={(100 * floorChecks) / FLOOR_CHECK_TOTAL}
        >
          <Callout tone="warning">
            Reuse existing evidence only for the same physical asset on {floor.code}. Never assume cross-floor reuse. Shared asset, floor and unit completion are separate.
          </Callout>
          {renderGroupItems(FLOOR_ITEMS, floorState.checklist, 'checklist')}
        </GroupCard>

        {basement && (
          <GroupCard
            title={`${floor.code}-only · Basement checks`}
            chip={
              <StatusChip tone={basementChecks === BASEMENT_CHECK_TOTAL ? 'success' : 'warning'}>
                {basementChecks}/{BASEMENT_CHECK_TOTAL}
              </StatusChip>
            }
            subtitle={`Additional checks for basement floors only · ${basementChecks}/${BASEMENT_CHECK_TOTAL} confirmed${
              aboveRange(data.floors) ? ` · Not applicable for ${aboveRange(data.floors)}` : ''
            }`}
          >
            {renderGroupItems(BASEMENT_ITEMS, floorState.basement, 'basement')}
          </GroupCard>
        )}
      </div>

      <SectionFooter
        notes={data.siteNotes}
        onNotesChange={(value) => update('internal', (current) => ({ ...current, siteNotes: value }))}
        canComplete={issues.length === 0}
        complete={complete}
        onComplete={() => setCompleted('internal', true)}
        blockedHint="Complete building records, each floor checklist and each required unit record independently before confirming Internal Network."
        completeHint="Internal Network complete · Saved locally · Pending sync"
      />

      {configuring && (
        <ConfigureFloorsDialog
          data={data}
          onClose={() => setConfiguring(false)}
          onSave={(floors) => {
            update('internal', (current) => ({ ...current, floors }));
            setConfiguring(false);
          }}
        />
      )}
    </>
  );
}

