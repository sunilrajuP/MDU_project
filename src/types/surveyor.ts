// Surveyor domain + DTO types. Shapes follow docs/surveyor-api-contract.md so the real API can replace the mocks.

export type SurveyorJobStatus = 'not_started' | 'in_progress' | 'returned' | 'submitted';
export type SyncState = 'synced' | 'pending' | 'failed';

export interface SurveyorJobSummary {
  jobRef: string;
  siteName: string;
  address: string;
  status: SurveyorJobStatus;
  scheduledDate: string;
  progress: { percent: number; currentStep: string } | null;
  sync: { state: SyncState; lastSyncedAt: string };
  returned: ReturnedInfo | null;
}

export interface ReturnedInfo {
  reason: string;
  returnedAt: string;
  dataRetained: boolean;
}

export interface GetSurveyorJobsResponse {
  assignedTo: { userId: string; name: string };
  jobs: SurveyorJobSummary[];
}

export interface SurveyorJobDetail {
  jobRef: string;
  siteName: string;
  address: string;
  status: SurveyorJobStatus;
  scheduledDate: string;
  assignedTo: string;
  location: { latitude: number; longitude: number; confirmed: boolean; accuracyM: number };
  sync: { state: SyncState; lastSyncedAt: string };
  returned: ReturnedInfo | null;
  surveyStarted: boolean;
}

export interface ConfirmSiteLocationRequest {
  jobRef: string;
  clientRequestId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: string;
}
export interface ConfirmSiteLocationResponse {
  confirmed: true;
  confirmedAt: string;
}

// --- Site information (Contacts & Access) -------------------------------------------------------

/** A text value that may have been pre-filled by the manager when the job was created. */
export interface SiteInfoField {
  value: string;
  fromManager?: boolean;
}

export interface SiteInfo {
  stakeholder: {
    role: SiteInfoField;
    name: SiteInfoField;
    phone: SiteInfoField;
    email: SiteInfoField;
  };
  access: {
    parking: string;
    accessWindow: string;
    entryInstructions: SiteInfoField;
    accessRequirements: string;
  };
  rev: number;
}

export interface GetSiteInfoResponse {
  siteInfo: SiteInfo;
  options: { parking: string[] };
}

export interface SaveSiteInfoRequest {
  jobRef: string;
  clientRequestId: string;
  baseRev: number;
  siteInfo: Omit<SiteInfo, 'rev'>;
}
export interface SaveSiteInfoResponse {
  rev: number;
  savedAt: string;
}

// --- Runbook ---------------------------------------------------------------------------------

export type SectionKey =
  | 'whs'
  | 'bfd'
  | 'external'
  | 'internal'
  | 'floorPlans'
  | 'nbnDesign'
  | 'bom'
  | 'preflight'
  | 'signoff';

export interface RunbookSectionDef {
  key: SectionKey;
  order: number;
  title: string;
  subtitle: string;
}

export interface RunbookConfig {
  version: string;
  sections: RunbookSectionDef[];
}

export type ItemStatus =
  | 'missing'
  | 'required'
  | 'pending'
  | 'photo_pending'
  | 'captured'
  | 'not_applicable'
  | 'clear';

/** Saved draft data for one section. Shape is section-specific; each section component narrows it. */
export interface RunbookSectionRecord {
  key: SectionKey;
  rev: number;
  completed: boolean;
  completedAt?: string;
  data: Record<string, unknown>;
}

export interface Runbook {
  jobRef: string;
  title: string;
  rev: number;
  sections: RunbookSectionRecord[];
}

export interface SaveSectionRequest {
  jobRef: string;
  key: SectionKey;
  clientRequestId: string;
  baseRev: number;
  data: Record<string, unknown>;
}
export interface SaveSectionResponse {
  key: SectionKey;
  rev: number;
  savedAt: string;
}

export interface ConfirmSectionRequest {
  jobRef: string;
  key: SectionKey;
  clientRequestId: string;
  baseRev: number;
}
export interface ConfirmSectionResponse {
  key: SectionKey;
  completed: true;
  completedAt: string;
}

// --- BFD selector --------------------------------------------------------------------------------

export interface BfdRecommendation {
  code: string;
  name: string;
  spec: string;
  rationale: string;
}
export interface RecommendBfdRequest {
  jobRef: string;
  answers: Record<string, string>;
}
export interface RecommendBfdResponse {
  figure: string;
  recommendation: BfdRecommendation;
}

// --- Bill of materials ----------------------------------------------------------------------------

export type BomSource = 'plan' | 'calculated' | 'manual';
export interface BomRow {
  id: string;
  item: string;
  description: string;
  quantity: number;
  unit: 'ea' | 'Lm';
  source: BomSource;
  /** Optional review flag shown under the row (e.g. "Missing fittings · Review required"). */
  flag?: string;
}
export interface GetBomResponse {
  /** True while the estimate is not reconciled to this survey's plans. */
  stale: boolean;
  rows: BomRow[];
}

// --- Sign-off / submit -----------------------------------------------------------------------------

export interface SubmitSurveyRequest {
  jobRef: string;
  clientRequestId: string;
  signoff: { surveyorName: string; declaration: true; signedAt: string };
}
export interface SubmitSurveyResponse {
  jobRef: string;
  status: 'submitted';
  submittedAt: string;
}

// --- Media / markup ----------------------------------------------------------------------------

export type MediaKind = 'photo' | 'video';

/** Where in the survey a piece of evidence belongs. */
export interface MediaContext {
  sectionKey: SectionKey;
  itemCode: string;
  floorCode?: string;
  unitId?: string;
  /** Short label burned into marked-up copies, e.g. "B1 · unit.entryPhoto". */
  tag?: string;
}

export type MarkupKind = 'line' | 'arrow' | 'rect' | 'shape' | 'dimension' | 'callout' | 'text';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dashDot' | 'phantom';
export type MarkupColor = 'red' | 'yellow' | 'green' | 'blue' | 'white' | 'purple';

export interface MarkupObject {
  id: string;
  kind: MarkupKind;
  /** Normalised 0–1 coordinates relative to the image. */
  points: [number, number][];
  style: { color: MarkupColor; widthPx: number; lineStyle: LineStyle };
  text?: string;
}

export interface MarkupData {
  objects: MarkupObject[];
  note: string;
  updatedAt: string;
}

/** Lightweight reference held in section data. Blobs never leave Dexie / object URLs. */
export interface MediaAttachment {
  id: string;
  kind: MediaKind;
  capturedAt: string;
  hasMarkup: boolean;
}

export interface UploadMediaMeta {
  clientMediaId: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  capturedAt: string;
  capturedBy: string;
  context: MediaContext;
  durationSec: number | null;
}
export interface UploadMediaRequest {
  jobRef: string;
  meta: UploadMediaMeta;
  file: Blob;
}
export interface UploadMediaResponse {
  mediaId: string;
  clientMediaId: string;
  kind: MediaKind;
  status: 'uploaded';
  originalUrl: string;
  thumbUrl: string;
}

export interface SaveMarkupRequest {
  jobRef: string;
  mediaId: string;
  clientRequestId: string;
  markup: MarkupData & { purpose?: string };
  markedFile: Blob;
}
export interface SaveMarkupResponse {
  mediaId: string;
  markedUrl: string;
  markupRev: number;
}
