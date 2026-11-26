import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { floorDone, floorStateOf } from '../../logic/internal';
import type { FloorDef, InternalData } from '../../model/types';
import styles from './ConfigureFloorsDialog.module.scss';

interface ConfigureFloorsDialogProps {
  data: InternalData;
  onClose: () => void;
  onSave: (floors: FloorDef[]) => void;
}

const KINDS = [
  { value: 'above', label: 'Above ground' },
  { value: 'basement', label: 'Basement' },
];
const CODE_PATTERN = /^[A-Z0-9-]{1,6}$/;

/** Add, rename, retype or remove floors. A floor's code is its stable id; removed floors keep their data archived. */
export function ConfigureFloorsDialog({ data, onClose, onSave }: Readonly<ConfigureFloorsDialogProps>) {
  const [floors, setFloors] = useState<FloorDef[]>(() => data.floors.map((floor) => ({ ...floor })));
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<FloorDef['kind']>('above');
  const [error, setError] = useState<string>();
  const [confirmRemoval, setConfirmRemoval] = useState<string[] | null>(null);

  const patch = (code: string, change: Partial<FloorDef>) =>
    setFloors((current) => current.map((floor) => (floor.code === code ? { ...floor, ...change } : floor)));

  function addFloor(event: FormEvent) {
    event.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      setError('Enter a short floor code (letters, numbers or dashes, up to 6 characters), e.g. L5 or B2.');
      return;
    }
    if (floors.some((floor) => floor.code === code)) {
      setError(`A floor with code ${code} already exists.`);
      return;
    }
    setError(undefined);
    setFloors((current) => [...current, { code, name: newName.trim() || code, kind: newKind }]);
    setNewCode('');
    setNewName('');
  }

  function save() {
    const kept = new Set(floors.map((floor) => floor.code));
    const removedWithData = data.floors
      .filter((floor) => !kept.has(floor.code))
      .filter((floor) => {
        const state = floorStateOf(data, floor.code);
        return floorDone(floor, state) > 0 || state.units.length > 0;
      })
      .map((floor) => floor.code);
    if (removedWithData.length > 0) {
      setConfirmRemoval(removedWithData);
      return;
    }
    onSave(floors);
  }

  return (
    <>
      <Modal
        size="lg"
        title="Configure floors"
        subtitle="Add, rename or remove floors. Basement floors get the extra basement checks."
        onClose={onClose}
        footer={
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={floors.length === 0}>
              Save floors
            </Button>
          </div>
        }
      >
        <ul className={styles.list} aria-label="Floors">
          {floors.map((floor) => (
            <li key={floor.code} className={styles.row}>
              <span className={styles.code}>{floor.code}</span>
              <Input
                label={`Name for ${floor.code}`}
                value={floor.name}
                onChange={(event) => patch(floor.code, { name: event.target.value })}
                id={`floor-name-${floor.code}`}
              />
              <Select
                label={`Type for ${floor.code}`}
                value={floor.kind}
                onChange={(event) => patch(floor.code, { kind: event.target.value as FloorDef['kind'] })}
                options={KINDS}
              />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove floor ${floor.code}`}
                disabled={floors.length === 1}
                onClick={() => setFloors((current) => current.filter((entry) => entry.code !== floor.code))}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <form className={styles.add} onSubmit={addFloor} noValidate>
          <h3 className={styles.addTitle}>Add a floor</h3>
          <div className={styles.addGrid}>
            <Input label="Floor code" value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder="e.g. L5" id="new-floor-code" />
            <Input label="Floor name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Level 5" id="new-floor-name" />
            <Select label="Floor type" value={newKind} onChange={(event) => setNewKind(event.target.value as FloorDef['kind'])} options={KINDS} />
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="secondary">
            Add floor
          </Button>
        </form>
      </Modal>

      {confirmRemoval && (
        <ConfirmDialog
          title="Remove floors with data?"
          message={`${confirmRemoval.join(', ')} ${confirmRemoval.length === 1 ? 'has' : 'have'} entered data. It is archived, not deleted, and comes back if you add the same floor code again.`}
          confirmLabel="Remove floors"
          destructive
          onCancel={() => setConfirmRemoval(null)}
          onConfirm={() => onSave(floors)}
        />
      )}
    </>
  );
}
