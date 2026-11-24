import { useEffect, useState } from 'react';
import styles from './ConnectionPill.module.scss';

export function ConnectionPill() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <span
        data-status={online ? 'online' : 'offline'}
        className={[styles.pill, online ? styles.online : styles.offline].join(' ')}
      >
          <span className={styles.dot} />
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
