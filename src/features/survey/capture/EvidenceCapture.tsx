import { useState } from 'react';
import { Camera, Image as ImageIcon, Pencil, ScanLine, Trash2, Video } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import { mediaRepo } from '@/data/repos/mediaRepo';
import type { MediaAttachment, MediaContext, MediaKind } from '@/types/surveyor';
import { CaptureFlow, type BackendUploadTarget } from './CaptureFlow';
import { useMediaBlob, useObjectUrl } from './hooks';
import { formatCaptureStamp } from './captureFormat';
import styles from './EvidenceCapture.module.scss';

interface EvidenceCaptureProps {
  jobRef: string;
  context: MediaContext;
  /** Question text, used for dialog titles and accessible names. */
  itemLabel: string;
  value: MediaAttachment[];
  onChange: (next: MediaAttachment[]) => void;
  allowVideo?: boolean;
  disabled?: boolean;
  /** Validation message, e.g. "Photo evidence required". */
  error?: string;
  /** `plan` = floor-plan upload layout (big dashed drop area + "Add plan / photo"). */
  variant?: 'default' | 'plan';
  /** Floor code shown in the plan layout hint, e.g. B1. */
  planLabel?: string;
  /** Upload target for the survey-session media API (backend runbook only). */
  backendUpload?: BackendUploadTarget;
}

interface ActiveFlow {
  kind: MediaKind;
  editMediaId?: string;
}

function Thumb({
  attachment,
  itemLabel,
  disabled,
  onEdit,
  onRemove,
}: Readonly<{
  attachment: MediaAttachment;
  itemLabel: string;
  disabled?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}>) {
  const { blob } = useMediaBlob(attachment.id, attachment.hasMarkup);
  const url = useObjectUrl(blob);
  const isPhoto = attachment.kind === 'photo';
  const label = isPhoto ? (attachment.hasMarkup ? 'Marked-up photo' : 'Original photo · RAW') : 'Video';
  return (
    <li className={styles.thumb}>
      <div className={styles.thumbMedia}>
        {url && isPhoto && <img src={url} alt={`${label} for ${itemLabel}`} />}
        {!(url && isPhoto) && (isPhoto ? <ImageIcon size={24} aria-hidden="true" /> : <Video size={24} aria-hidden="true" />)}
      </div>
      <div className={styles.thumbText}>
        <span className={styles.thumbTitle}>{label}</span>
        <span className={styles.thumbMeta}>{formatCaptureStamp(attachment.capturedAt)} · Saved locally</span>
        <StatusChip tone="success">Evidence attached</StatusChip>
      </div>
      <div className={styles.thumbActions}>
        {isPhoto && (
          <button type="button" className={styles.iconButton} onClick={onEdit} disabled={disabled} aria-label={`Edit markup for ${itemLabel}`}>
            <Pencil size={18} aria-hidden="true" />
          </button>
        )}
        <button type="button" className={styles.iconButton} onClick={onRemove} disabled={disabled} aria-label={`Remove ${attachment.kind} for ${itemLabel}`}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/**
 * "Add Photo / Video" buttons + attached thumbnails for ONE question. Every runbook question that
 * needs evidence renders this; all of them open the same CaptureFlow.
 */
export function EvidenceCapture({
  jobRef,
  context,
  itemLabel,
  value,
  onChange,
  allowVideo = true,
  disabled,
  error,
  variant = 'default',
  planLabel,
  backendUpload,
}: Readonly<EvidenceCaptureProps>) {
  const [flow, setFlow] = useState<ActiveFlow | null>(null);
  const photoCount = value.filter((entry) => entry.kind === 'photo').length;
  const videoCount = value.length - photoCount;

  function handleComplete(attachment: MediaAttachment) {
    const exists = value.some((entry) => entry.id === attachment.id);
    onChange(exists ? value.map((entry) => (entry.id === attachment.id ? attachment : entry)) : [...value, attachment]);
    setFlow(null);
  }

  async function handleRemove(id: string) {
    await mediaRepo.remove(id);
    onChange(value.filter((entry) => entry.id !== id));
  }

  const summary = [
    photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'}` : null,
    videoCount > 0 ? `${videoCount} video${videoCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.root}>
      {value.length > 0 && (
        <ul className={styles.thumbs} aria-label={`Evidence for ${itemLabel}`}>
          {value.map((attachment) => (
            <Thumb
              key={attachment.id}
              attachment={attachment}
              itemLabel={itemLabel}
              disabled={disabled}
              onEdit={() => setFlow({ kind: 'photo', editMediaId: attachment.id })}
              onRemove={() => void handleRemove(attachment.id)}
            />
          ))}
        </ul>
      )}

      {variant === 'plan' ? (
        <div className={styles.planActions}>
          {value.length === 0 && (
            <button
              type="button"
              className={styles.planDrop}
              disabled={disabled}
              onClick={() => setFlow({ kind: 'photo' })}
              aria-label={`Upload or capture floor plan for ${itemLabel}`}
            >
              <ScanLine size={24} aria-hidden="true" />
              <span className={styles.planTitle}>Upload / Capture floor plan</span>
              <span className={styles.planHint}>Add a clear plan image or PDF{planLabel ? ` · ${planLabel}` : ''}</span>
            </button>
          )}
          <button type="button" className={styles.planAdd} disabled={disabled} onClick={() => setFlow({ kind: 'photo' })}>
            + Add plan / photo
          </button>
        </div>
      ) : (
      <div className={styles.actions}>
        <button type="button" className={styles.capture} disabled={disabled} onClick={() => setFlow({ kind: 'photo' })} aria-label={`Add photo for ${itemLabel}`}>
          <Camera size={18} aria-hidden="true" />
          <span>Add Photo</span>
        </button>
        {allowVideo && (
          <button type="button" className={styles.capture} disabled={disabled} onClick={() => setFlow({ kind: 'video' })} aria-label={`Add video for ${itemLabel}`}>
            <Video size={18} aria-hidden="true" />
            <span>Video</span>
          </button>
        )}
      </div>
      )}

      {variant === 'plan' ? null : value.length === 0 ? (
        <p className={[styles.status, styles.pending].join(' ')}>No evidence attached • Pending capture</p>
      ) : (
        <p className={[styles.status, styles.done].join(' ')}>{summary} attached · Saved locally</p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {flow && (
        <CaptureFlow
          jobRef={jobRef}
          context={context}
          itemLabel={itemLabel}
          kind={flow.kind}
          editMediaId={flow.editMediaId}
          backendUpload={backendUpload}
          onComplete={handleComplete}
          onClose={() => setFlow(null)}
        />
      )}
    </div>
  );
}
