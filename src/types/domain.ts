// Domain types — owned by offline-data per Agent.md; all features import from here, never redefine.

export type Role = 'Manager' | 'TeamLead' | 'Surveyor' | 'QC' | 'Designer';

export interface AssignmentActor {
  userId: string;
  role: Role;
}

export type JobStatus =
  | 'new'
  | 'YetToAssign'
  | 'assigned_teamlead'
  | 'assigned_surveyor'
  | 'in_progress'
  | 'submitted'
  | 'pending_qc'
  | 'returned'
  | 'approved';

export type JobDisplayStatus = JobStatus | 'overdue';

export interface AssignmentHistoryEntry {
  byUserId: string;
  byRole: Role;
  toUserId: string;
  toRole: Role;
  timestamp: string;
}

export interface SiteDetails {
  buildingType?: string;
  numUnits?: number;
  notes?: string;
}

export interface SiteInformation {
  siteId: number;
  siteName: string;
  siteAddress: string;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  buildingName: string | null;
  buildingTypeId: number | null;
  buildingType: string | null;
  groundClassId: number | null;
  ground: string | null;
  basementLevels: number | null;
  floorsAboveGround: number | null;
  eupCount: number | null;
  parkingAvailable: boolean | null;
  accessWindow: string | null;
  entryAccessInstructions: string | null;
  accessRequirements: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactRole: string | null;
}

export interface Job {
  id: string;
  siteName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  status: JobStatus;
  scheduledDate?: string;
  createdDate?: string;
  updatedDate?: string;
  /** Human-readable reference from the backend (e.g. MDU-000021). */
  jobRef?: string;
  /** Display name of the assigned Team Lead. */
  assigneeName?: string;
  /** Whether the server has supplied a lead assignment, including an explicit unassignment. */
  leadAssignmentKnown?: boolean;
  createdBy: AssignmentActor;
  createdByName?: string;
  /** Manager-assigned Team Lead. */
  assignedTo?: AssignmentActor;
  /** Surveyor assigned independently of the Team Lead. */
  assignedSurveyor?: AssignmentActor;
  siteDetails: SiteDetails;
  siteInformation?: SiteInformation;
  assignmentHistory: AssignmentHistoryEntry[];
  attempt: number;
  updatedAt: string;

  /** Site details from the backend job response (null becomes undefined in the mapper). */
  buildingName?: string;
  basementLevels?: number;
  floorsAboveGround?: number;
  eupCount?: number;
  comments?: string;

  /** Latest surveyor's display name, if the job carries it (the list card receives this as a prop). */
  latestSurveyorName?: string;

  /** Local-first bookkeeping (offline-data hard rule: every mutable table carries this). */
  dirty: boolean;
  syncStatus: 'synced' | 'pending' | 'failed';
  /** Retains retry access if an unsynced reassignment moves the job away from its Team Lead. */
  pendingEditBy?: AssignmentActor;
  rev?: number;
  syncError?: string;
  clientId?: string;
}

export interface JobCounts {
  total: number;
  new: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  returned: number;
  approved: number;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  /** Present only for Surveyors — the Team Lead who owns their roster. */
  teamLeadId?: string;
}

export interface Team {
  teamLeadUserId: string;
  surveyorUserIds: string[];
}

export interface TeamMembership {
  allTeamLeads: AssignmentActor[];
  surveyorsOf: () => AssignmentActor[];
}

/** Read-only, partial-for-now survey session — full offline-download behavior is Surveyor scope (deferred). */
export interface SurveySession {
  jobId: string;
  status: 'not_started' | 'in_progress' | 'submitted';
  checklist: unknown[];
  photos: unknown[];
}

export type TransitionAction = 'approve' | 'return';

export interface JobTransition {
  action: TransitionAction;
  reason: string;
  comments?: string;
  byUserId: string;
  timestamp: string;
}

// --- Forward-declared contracts for Surveyor-only endpoints (types only, no logic/UI this task) ---

export interface SyncPushOperation {
  entity: 'job' | 'siteDetails' | 'checklistItem' | 'signoff';
  entityId: string;
  payload: unknown;
  clientTimestamp: string;
}

export interface SyncPushRequest {
  jobId: string;
  operations: SyncPushOperation[];
}

export interface SyncPushResponse {
  jobId: string;
  acceptedOperationIds: string[];
  serverRevision: number;
}

export interface MediaUploadRequest {
  jobId: string;
  mediaId: string;
  kind: 'photo' | 'floorplan';
  mimeType: string;
}

export interface MediaUploadResponse {
  jobId: string;
  mediaId: string;
  storageUrl: string;
}
