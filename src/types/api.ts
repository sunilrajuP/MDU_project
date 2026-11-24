// API request/response DTOs.

import type {
  AssignmentActor,
  Job,
  JobCounts,
  JobStatus,
  JobTransition,
  Role,
  SiteDetails,
  SurveySession,
  TransitionAction,
  User,
} from './domain';

// 1. POST /api/auth/login
export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  userId: string;
  name: string;
  role: Role;
  accessToken: string;
  refreshToken: string | null;
  expiry: string;
  errorMessage?: string;
}

/** POST /api/auth/refresh. Expiry may instead be supplied by the JWT exp claim. */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiry?: string;
}

/** POST /api/auth/logout. */
export interface LogoutRequest {
  refreshToken: string;
}

// 2. GET /api/jobs
export interface GetJobsParams {
  status?: JobStatus;
  // assignedTo?: string;
  // updatedSince?: string;
}
export interface GetJobsResponse {
  jobs: Job[];
  /** Present for Manager callers; Team Lead responses omit it (their view is already scoped). */
  counts?: JobCounts;
}

/** Job as returned by the .NET backend's job endpoints. */
export interface ApiJob {
  id: number;
  jobRef: string;
  siteName: string;
  siteAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  assigneeName?: string | null;
  assigneeTeamLead?: string | null;
  latestSurveyorName?: string | null;
  scheduledDate: string | null;
  createdDate?: string | null;
  createdByName?: string | null;
  updatedDate?: string | null;
  comments?: string | null;
  assignedSurveyorId?: number | null;
}
export type GetJobsApiResponse = ApiJob[];

// 3. GET /api/job/:id
export type GetJobResponse = Job;

// 4. GET /api/users/team
export interface ApiRosterUser {
  id: number;
  email: string;
  displayName: string;
  isActive: boolean;
}

export interface GetUsersParams {
  role: 'surveyor' | 'teamlead';
}
export interface GetUsersResponse {
  users: User[];
}

// 5. POST /api/job/create_job
export interface CreateJobRequest {
  /** The server assigns the job id; it comes back in the response. */
  siteName: string;
  siteAddress: string;
  latitude?: number;
  longitude?: number;
  /** ISO 8601 datetime, e.g. 2026-11-28T10:54:36.108Z. */
  scheduledDate: string;
  /** Sent as YYYY-MM-DD; local ISO timestamps are normalized at the API boundary. */
  createdDate: string;
  /** Creator's display name; separate from the domain's createdBy actor. */
  createdBy?: string;
  /** Sent as YYYY-MM-DD when present. */
  updatedDate?: string;
  assignedSurveyorId: number | null;
  comments: string;
  /** Transport metadata, not part of the backend JSON payload. */
  clientRequestId?: string;
  localJobId?: string;
}
export type CreateJobResponse = Job;

export interface AddressSuggestion {
  id: string;
  primary: string;
  secondary: string;
  full: string;
  lat: number;
  lng: number;
  countryCode: string;
}

// 6. PUT /api/job/update_job/:id.
export interface UpdateJobRequest {
  id: string;
  siteName?: string;
  siteAddress?: string;
  scheduledDate?: string;
  /** Sent as YYYY-MM-DD when present. */
  updatedDate?: string;
  comments?: string;
  assignedSurveyorId?: number | null;
  siteDetails?: Partial<SiteDetails>;
  assignedTo?: AssignmentActor;
}
export interface ReassignJobRequest {
  id: string;
  assignedSurveyorId: number | null;
}
export type UpdateJobResponse = Job;

export interface ApiErrorShape {
  status: number;
  message: string;
}

// 7. GET /api/:id/survey
export type GetSurveySessionResponse = SurveySession;

// Job transitions do not have a confirmed backend route.
export interface TransitionJobRequest {
  id: string;
  action: TransitionAction;
  reason: string;
  comments?: string;
}
export interface TransitionJobResponse {
  job: Job;
  transition: JobTransition;
}

export * from './domain';
