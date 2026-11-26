import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Circle, FolderOpen, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import type { MediaKind } from '@/types/surveyor';
import { MAX_VIDEO_SECONDS } from './captureFormat';
import styles from './CaptureFlow.module.scss';

interface CameraStepProps {
  kind: MediaKind;
  onCaptured: (blob: Blob, durationSec: number | null) => void;
}

const canUseCamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/**
 * Live camera (photo) or recorder (video) with a file-picker fallback for devices/browsers
 * without camera access (and for desktop testing).
 */
export function CameraStep({ kind, onCaptured }: Readonly<CameraStepProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [status, setStatus] = useState<'starting' | 'ready' | 'unavailable'>(() =>
    canUseCamera() ? 'starting' : 'unavailable',
  );
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const isVideo = kind === 'video';

  useEffect(() => {
    if (!canUseCamera()) return undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: isVideo })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [isVideo]);

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (recording && elapsed >= MAX_VIDEO_SECONDS) recorderRef.current?.stop();
  }, [recording, elapsed]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onCaptured(blob, null), 'image/jpeg', 0.92);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      onCaptured(blob, elapsedRef.current);
    };
    setElapsed(0);
    recorder.start();
    setRecording(true);
  }

  // The recorder's onstop closure needs the latest elapsed value without re-creating the recorder.
  const elapsedRef = useRef(0);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onCaptured(file, null);
  }

  return (
    <div className={styles.step}>
      <div className={styles.stage}>
        {status === 'ready' ? (
          <video ref={videoRef} className={styles.viewfinder} autoPlay playsInline muted aria-label="Camera preview" />
        ) : (
          <div className={styles.placeholder}>
            <Camera size={40} aria-hidden="true" />
            <p>{status === 'starting' ? 'Starting camera…' : 'Camera is not available on this device.'}</p>
          </div>
        )}
        {recording && (
          <span className={styles.recBadge} role="timer">
            <Circle size={10} fill="currentColor" aria-hidden="true" /> {elapsed}s / {MAX_VIDEO_SECONDS}s
          </span>
        )}
      </div>

      {status === 'unavailable' && (
        <Callout tone="warning">
          Camera access is unavailable. Choose a {isVideo ? 'video' : 'photo'} from this device instead.
        </Callout>
      )}

      <footer className={styles.footer}>
        {status === 'ready' && !isVideo && (
          <Button type="button" onClick={takePhoto}>
            <Camera size={18} aria-hidden="true" /> Take photo
          </Button>
        )}
        {status === 'ready' && isVideo && !recording && (
          <Button type="button" onClick={startRecording}>
            <Circle size={18} aria-hidden="true" /> Start recording
          </Button>
        )}
        {status === 'ready' && isVideo && recording && (
          <Button type="button" variant="danger" onClick={stopRecording}>
            <Square size={18} aria-hidden="true" /> Stop recording
          </Button>
        )}
        <label className={styles.filePicker}>
          <FolderOpen size={18} aria-hidden="true" />
          <span>Choose from device</span>
          <input
            type="file"
            accept={isVideo ? 'video/*' : 'image/*'}
            capture="environment"
            className={styles.fileInput}
            onChange={handleFile}
            aria-label={isVideo ? 'Choose video file' : 'Choose photo file'}
          />
        </label>
      </footer>
    </div>
  );
}
