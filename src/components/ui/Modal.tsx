import { useEffect, useId, useRef, type KeyboardEvent, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.scss';

interface ModalProps {
  title: string;
  subtitle?: string;
  /** Right-aligned header slot (e.g. a "Draft markup" chip). */
  headerAction?: ReactNode;
  /** Sticky footer (primary / secondary actions). */
  footer?: ReactNode;
  onClose: () => void;
  /** Accessible label for the close button. */
  closeLabel?: string;
  /** Removes body padding so a multi-step child can own its own layout and sticky footer. */
  flush?: boolean;
  /** `sm` is a compact confirmation card, centred on every screen size. */
  size?: 'lg' | 'sm';
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Large dialog used by the capture flow. Full-screen on mobile, centred on tablet/desktop.
 * Traps focus, closes on Escape, restores focus to the opener on unmount.
 */
export function Modal({
  title,
  subtitle,
  headerAction,
  footer,
  onClose,
  closeLabel = 'Close',
  flush = false,
  size = 'lg',
  children,
}: Readonly<PropsWithChildren<ModalProps>>) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className={[styles.scrim, size === 'sm' ? styles.scrimSm : ''].filter(Boolean).join(' ')}>
      <div
        ref={panelRef}
        className={[styles.panel, size === 'sm' ? styles.panelSm : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
            <X size={22} aria-hidden="true" />
          </button>
          <div className={styles.headerText}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
        </header>
        <div className={[styles.body, flush ? styles.flush : ''].filter(Boolean).join(' ')}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
