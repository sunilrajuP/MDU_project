import { useSyncExternalStore } from 'react';
import {
  DEV_NETWORK_TOGGLE_ENABLED,
  isSimulatedOffline,
  setSimulatedOffline,
  subscribeSimulatedNetwork,
} from '@/dev/devNetwork';
import styles from './NetworkToggle.module.scss';

/**
 * Dev-only "Network ON/OFF" switch from the Figma frames. Renders nothing in production builds.
 * OFF simulates being offline (navigator.onLine + offline event) so offline behaviour can be tested.
 */
export function NetworkToggle() {
  const offline = useSyncExternalStore(subscribeSimulatedNetwork, isSimulatedOffline, () => false);
  if (!DEV_NETWORK_TOGGLE_ENABLED) return null;

  return (
    <div className={styles.wrap}>
      <span className={styles.label} id="dev-network-label">
        Network
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!offline}
        aria-labelledby="dev-network-label"
        className={[styles.track, offline ? styles.off : styles.on].join(' ')}
        onClick={() => setSimulatedOffline(!offline)}
      >
        <span className={styles.stateText} aria-hidden="true">
          {offline ? 'OFF' : 'ON'}
        </span>
        <span className={styles.thumb} aria-hidden="true" />
      </button>
    </div>
  );
}
