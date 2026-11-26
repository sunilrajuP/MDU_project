/** "28 Oct 2026 · 10:36 am · Alex Morgan" — shown on previews and burned into marked-up copies. */
export function formatCaptureStamp(iso: string, surveyorName?: string | null): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  return [day, time, surveyorName].filter(Boolean).join(' · ');
}

/** Maximum clip length. Final limit is a backend decision (see docs/surveyor-api-contract.md §9). */
export const MAX_VIDEO_SECONDS = 60;
