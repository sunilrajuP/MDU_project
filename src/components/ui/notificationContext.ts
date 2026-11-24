import { createContext, useContext } from 'react';

export type Notification = { kind: 'success' | 'error'; message: string };

export interface NotificationActions {
  showNotification: (notification: Notification) => void;
  clearNotification: () => void;
}

export const NotificationContext = createContext<NotificationActions | null>(null);

export function useNotification() {
  return useContext(NotificationContext);
}
