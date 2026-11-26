import { Settings } from 'lucide-react';
import type { FloorDef, InternalData } from '../../model/types';
import { floorDone, floorStateOf, floorTotal } from '../../logic/internal';
import styles from './FloorTabs.module.scss';

interface FloorTabsProps {
  data: InternalData;
  selected: string;
  onSelect: (code: string) => void;
  onConfigure: () => void;
}

/** "Floors" header + the data-driven floor strip (code and checks done/total per floor). */
export function FloorTabs({ data, selected, onSelect, onConfigure }: Readonly<FloorTabsProps>) {
  return (
    <div className={styles.wrap}>
      <div className={styles.heading}>
        <h3 className={styles.title}>Floors</h3>
        <button type="button" className={styles.configure} onClick={onConfigure}>
          <Settings size={14} aria-hidden="true" /> Configure floors
        </button>
      </div>
      <div className={styles.strip} role="tablist" aria-label="Floors">
        {data.floors.map((floor: FloorDef) => {
          const active = floor.code === selected;
          const done = floorDone(floor, floorStateOf(data, floor.code));
          return (
            <button
              key={floor.code}
              type="button"
              role="tab"
              id={`floor-tab-${floor.code}`}
              aria-selected={active}
              aria-controls="floor-panel"
              className={[styles.tab, active ? styles.active : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(floor.code)}
            >
              <span className={styles.code}>{floor.code}</span>
              <span className={styles.count}>
                {done}/{floorTotal(floor)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
