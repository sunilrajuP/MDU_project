import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { X } from 'lucide-react';
import { NotificationContext, type Notification } from './notificationContext';
import styles from './NotificationProvider.module.scss';

export function NotificationProvider({ children }: Readonly<PropsWithChildren>) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const showNotification = useCallback((next: Notification) => setNotification(next), []);
  const clearNotification = useCallback(() => setNotification(null), []);

  useEffect(() => {
    if (!notification) return undefined;
    const timeout = window.setTimeout(clearNotification, 3000);
    return () => window.clearTimeout(timeout);
  }, [clearNotification, notification]);

  return (
    <NotificationContext.Provider value={{ showNotification, clearNotification }}>
      {children}
      <div className={styles.viewport}>
        <div className={notification ? `${styles.toast} ${styles[notification.kind]}` : undefined}>
          <div role="status" aria-live="polite" aria-atomic="true">
            {notification?.kind === 'success' ? notification.message : ''}
          </div>
          <div role="alert" aria-atomic="true">
            {notification?.kind === 'error' ? notification.message : ''}
          </div>
          {notification && (
            <button type="button" className={styles.dismiss} onClick={clearNotification} aria-label="Dismiss notification">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </NotificationContext.Provider>
  );
}
