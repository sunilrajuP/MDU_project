import { Button } from '@/components/ui/Button';
import type { MediaKind } from '@/types/surveyor';
import { useObjectUrl } from './hooks';
import styles from './CaptureFlow.module.scss';

interface PreviewStepProps {
  blob: Blob;
  kind: MediaKind;
  stamp: string;
  busy: boolean;
  error?: string;
  onRetake: () => void;
  onUse: () => void;
}

export function PreviewStep({ blob, kind, stamp, busy, error, onRetake, onUse }: Readonly<PreviewStepProps>) {
  const url = useObjectUrl(blob);
  return (
    <div className={styles.step}>
      <div className={styles.stage}>
        {url && kind === 'photo' && <img src={url} alt="Captured photo preview" className={styles.previewMedia} />}
        {url && kind === 'video' && (
          <video src={url} className={styles.previewMedia} controls playsInline aria-label="Captured video preview" />
        )}
        <span className={styles.stamp}>{stamp}</span>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <footer className={styles.footer}>
        <Button type="button" onClick={onUse} disabled={busy}>
          {busy ? 'Saving…' : kind === 'photo' ? 'Use Photo' : 'Use Video'}
        </Button>
        <Button type="button" variant="outline" onClick={onRetake} disabled={busy}>
          Retake
        </Button>
      </footer>
    </div>
  );
}
