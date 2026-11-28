import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { StatusChip } from '@/components/ui/StatusChip';
import { useUploadMediaMutation, useUploadSurveyMediaMutation, useSaveMediaMarkupMutation } from '@/api/surveyorApi';
import { mediaRepo } from '@/data/repos/mediaRepo';
import { useAppSelector } from '@/store/hooks';
import { selectAuth } from '@/features/auth/authSlice';
import type { MarkupObject, MediaAttachment, MediaContext, MediaKind } from '@/types/surveyor';
import { CameraStep } from './CameraStep';
import { PreviewStep } from './PreviewStep';
import { MarkupEditor, type MarkupResult } from './MarkupEditor';
import { formatCaptureStamp } from './captureFormat';
import { loadImage, renderMarkedBlob, type LoadedImage } from './imageUtils';

export interface CaptureFlowProps {
  jobRef: string;
  context: MediaContext;
  /** Question text, shown under the modal title. */
  itemLabel: string;
  kind: MediaKind;
  /** Re-open the markup editor for already stored evidence instead of capturing a new photo. */
  editMediaId?: string;
  /** When set, photos upload to the survey-session media API instead of the legacy runbook endpoint. */
  backendUpload?: BackendUploadTarget;
  onComplete: (attachment: MediaAttachment) => void;
  onClose: () => void;
}

export interface BackendUploadTarget {
  jobId: number | string;
  sessionId: number | string;
  itemId: number;
}

type Step = 'loading' | 'capture' | 'preview' | 'markup';

interface Captured {
  blob: Blob;
  durationSec: number | null;
  capturedAt: string;
}

function stepTitle(step: Step, kind: MediaKind): string {
  if (step === 'markup') return 'Photo Markup Editor';
  const noun = kind === 'photo' ? 'photo' : 'video';
  if (step === 'preview') return `Review ${noun}`;
  return kind === 'photo' ? 'Photo Capture' : 'Video Capture';
}

const SAVE_ERROR = 'This could not be saved on the device. Free up storage and try again; your capture is still here.';

/**
 * ONE reusable evidence flow used by every question:
 * capture -> preview (Retake / Use) -> markup editor -> attach thumbnail to the question.
 * The original is persisted first and never modified; markup is stored as a separate copy.
 */
export function CaptureFlow({ jobRef, context, itemLabel, kind, editMediaId, backendUpload, onComplete, onClose }: Readonly<CaptureFlowProps>) {
  const surveyorName = useAppSelector(selectAuth).name;
  const [uploadMedia] = useUploadMediaMutation();
  const [uploadSurveyMedia] = useUploadSurveyMediaMutation();
  const [saveMediaMarkup] = useSaveMediaMarkupMutation();

  const [step, setStep] = useState<Step>(editMediaId ? 'loading' : 'capture');
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(editMediaId ?? null);
  const [capturedAt, setCapturedAt] = useState<string>(() => new Date().toISOString());
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [initialMarkup, setInitialMarkup] = useState<{ objects: MarkupObject[]; note: string }>({ objects: [], note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => () => image?.dispose(), [image]);

  // Edit mode: load the stored original and its vector markup, then jump straight to the editor.
  useEffect(() => {
    if (!editMediaId) return undefined;
    let cancelled = false;
    void (async () => {
      const record = await mediaRepo.get(editMediaId);
      if (cancelled) return;
      if (record?.kind !== 'photo') {
        onClose();
        return;
      }
      const loaded = await loadImage(record.originalBlob);
      if (cancelled) {
        loaded.dispose();
        return;
      }
      setCapturedAt(record.capturedAt);
      setInitialMarkup({ objects: record.markup?.objects ?? [], note: record.markup?.note ?? '' });
      setImage(loaded);
      setStep('markup');
    })().catch(() => {
      if (!cancelled) onClose();
    });
    return () => {
      cancelled = true;
    };
  }, [editMediaId, onClose]);

  const stamp = formatCaptureStamp(capturedAt, surveyorName);
  const attachment = (id: string, hasMarkup: boolean): MediaAttachment => ({ id, kind, capturedAt, hasMarkup });

  function handleCaptured(blob: Blob, durationSec: number | null) {
    setCaptured({ blob, durationSec, capturedAt: new Date().toISOString() });
    setCapturedAt(new Date().toISOString());
    setError(undefined);
    setStep('preview');
  }

  async function handleUse() {
    if (!captured) return;
    setBusy(true);
    setError(undefined);
    const id = mediaId ?? crypto.randomUUID();
    try {
      // Persist before confirming success; on failure the capture stays in memory for retry.
      if (!mediaId) {
        await mediaRepo.addOriginal({
          id,
          jobRef,
          kind,
          mimeType: captured.blob.type || (kind === 'photo' ? 'image/jpeg' : 'video/webm'),
          context,
          capturedAt,
          capturedBy: surveyorName ?? 'Surveyor',
          durationSec: captured.durationSec,
          originalBlob: captured.blob,
        });
        setMediaId(id);
        if (backendUpload) {
          void loadImage(captured.blob)
            .then((loaded) => {
              const { width, height } = loaded;
              loaded.dispose();
              return { width, height };
            })
            .catch(() => ({ width: undefined, height: undefined }))
            .then(({ width, height }) =>
              uploadSurveyMedia({ ...backendUpload, file: captured.blob, metadata: { capturedAt, width, height } }).unwrap())
            .then(() => mediaRepo.markSynced(id))
            .catch(() => mediaRepo.markFailed(id));
        } else void uploadMedia({
          jobRef,
          file: captured.blob,
          meta: {
            clientMediaId: id,
            kind,
            mimeType: captured.blob.type,
            sizeBytes: captured.blob.size,
            capturedAt,
            capturedBy: surveyorName ?? 'Surveyor',
            context,
            durationSec: captured.durationSec,
          },
        })
          .unwrap()
          .then(() => mediaRepo.markSynced(id))
          .catch(() => undefined); // stays 'pending'; the sync queue retries when online
      }
      if (kind === 'video') {
        onComplete(attachment(id, false));
        return;
      }
      const loaded = await loadImage(captured.blob);
      setImage(loaded);
      setStep('markup');
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveMarkup({ objects, note, palette }: MarkupResult) {
    if (!image || !mediaId) return;
    if (objects.length === 0 && !note.trim()) {
      handleCancelMarkup();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const markedBlob = await renderMarkedBlob(image, objects, palette, { stamp, tag: context.tag });
      const markup = { objects, note, updatedAt: new Date().toISOString() };
      await mediaRepo.saveMarkup(mediaId, markedBlob, markup);
      if (backendUpload) {
        // The media API has no markup endpoint: the marked-up copy is uploaded as its own photo, the original stays.
        void uploadSurveyMedia({ ...backendUpload, file: markedBlob, metadata: { capturedAt: markup.updatedAt, width: image.width, height: image.height } })
          .unwrap()
          .then(() => mediaRepo.markSynced(mediaId))
          .catch(() => mediaRepo.markFailed(mediaId));
      } else {
        void saveMediaMarkup({ jobRef, mediaId, clientRequestId: crypto.randomUUID(), markup, markedFile: markedBlob })
          .unwrap()
          .then(() => mediaRepo.markSynced(mediaId))
          .catch(() => undefined);
      }
      onComplete(attachment(mediaId, objects.length > 0));
    } catch {
      setError(SAVE_ERROR);
      setBusy(false);
    }
  }

  // Cancelling markup keeps the already-confirmed original (no markup); in edit mode it just closes.
  function handleCancelMarkup() {
    if (editMediaId || !mediaId) {
      onClose();
      return;
    }
    onComplete(attachment(mediaId, false));
  }

  return (
    <Modal
      flush
      title={stepTitle(step, kind)}
      subtitle={`${jobRef} · ${itemLabel}`}
      headerAction={step === 'markup' ? <StatusChip tone="brand">Draft markup</StatusChip> : undefined}
      onClose={step === 'markup' ? handleCancelMarkup : onClose}
      closeLabel={step === 'markup' ? 'Close markup editor' : 'Close'}
    >
      {step === 'capture' && <CameraStep kind={kind} onCaptured={handleCaptured} />}
      {step === 'preview' && captured && (
        <PreviewStep
          blob={captured.blob}
          kind={kind}
          stamp={stamp}
          busy={busy}
          error={error}
          onRetake={() => {
            setCaptured(null);
            setStep('capture');
          }}
          onUse={() => void handleUse()}
        />
      )}
      {step === 'markup' && image && (
        <MarkupEditor
          image={image}
          initialObjects={initialMarkup.objects}
          initialNote={initialMarkup.note}
          stamp={stamp}
          saving={busy}
          error={error}
          onSave={(result) => void handleSaveMarkup(result)}
          onCancel={handleCancelMarkup}
        />
      )}
    </Modal>
  );
}
