// RTK Query API layer (H4: all HTTP goes through here). Every endpoint calls the real .NET backend;
// there is no offline mock. Endpoints without a confirmed backend route fail with a 501 error.

import { createApi, fakeBaseQuery, type BaseQueryApi } from "@reduxjs/toolkit/query/react";
import type {
  ApiErrorShape,
  ApiJob,
  ApiRosterUser,
  CreateJobRequest,
  CreateJobResponse,
  GetJobResponse,
  GetJobsApiResponse,
  GetJobsParams,
  GetJobsResponse,
  GetSurveySessionResponse,
  GetUsersParams,
  GetUsersResponse,
  Job,
  JobStatus,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshTokenResponse,
  ReassignJobRequest,
  TransitionJobRequest,
  TransitionJobResponse,
  UpdateJobRequest,
  UpdateJobResponse,
} from "@/types/api";
import type { Role, User } from "@/types/domain";
import { jobsRepo } from "@/data/repos/jobsRepo";
import { usersRepo } from "@/data/repos/usersRepo";
import { authRepo, isSameAuthSession } from "@/data/repos/authRepo";
import type { AuthSessionRecord } from "@/data/db/schema";
import { authHydrated, loggedOut, loginSucceeded } from "@/features/auth/authSlice";
import { jobUpserted, jobsReplaced } from "@/features/jobs/jobsSlice";
import { usersReplacedForRole } from "@/features/teamlead/teamSlice";
import { toIsoDateOnly } from "@/utils/date";
import { matchingAssignmentNames } from "@/features/jobs/assignmentName";
import type { RootState } from "@/store";

// Empty string -> relative '/api/...' calls, proxied to the backend by vite.config.ts's dev
// server proxy (avoids CORS entirely). Set VITE_API_BASE_URL to call an absolute backend URL instead.
const AUTH_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/** Error for endpoints that have no confirmed backend route yet. */
const notImplemented = (what: string): { error: ApiErrorShape } => ({
  error: { status: 501, message: `${what} is not available: no backend route is configured.` },
});

function loginErrorMessage(body: unknown): string | undefined {
  if (typeof body === "string") return body.trim() ? body : undefined;
  if (!body || typeof body !== "object") return undefined;

  const fields = body as Record<string, unknown>;
  for (const key of ["detail", "message", "errorMessage", "error"]) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  if (fields.errors && typeof fields.errors === "object") {
    const messages = Object.values(fields.errors)
      .flatMap((value: unknown) => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === "string" && !!value.trim());
    if (messages.length) return messages.join(" ");
  }

  return typeof fields.title === "string" && fields.title.trim() ? fields.title : undefined;
}

// Claims carried by the backend's JWT — the login response itself only returns the token.
interface LoginJwtClaims {
  sub: string;
  name: string;
  role: string | string[];
  exp?: number;
}

// Normalize backend role separators before mapping singular/array claims to the app's Role union.
const BACKEND_ROLE_MAP: Record<string, Role> = {
  ADMIN: "Manager",
  MANAGER: "Manager",
  TEAMLEAD: "TeamLead",
  SURVEYOR: "Surveyor",
  QC: "QC",
  DESIGNER: "Designer",
};

function decodeJwtClaims(token: string): LoginJwtClaims {
  const payload = token.split(".")[1] ?? "";
  const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + c.codePointAt(0)!.toString(16).padStart(2, "0"))
      .join(""),
  );
  return JSON.parse(json) as LoginJwtClaims;
}

const API_STATUS_TO_JOB_STATUS: Record<string, JobStatus> = {
  YetToAssign: "new",
  NotStarted: "assigned_surveyor",
};

// List responses omit survey metadata; preserve it from the local source of truth.
function mapApiJob(job: ApiJob, existing?: Job, role?: Role, detail = false): Job {
  const statuses: JobStatus[] = [
    "new", "assigned_teamlead", "assigned_surveyor", "in_progress",
    "submitted", "pending_qc", "returned", "approved",
  ];
  let status = API_STATUS_TO_JOB_STATUS[job.status]
    ?? statuses.find((value) => value.replaceAll("_", "") === job.status.replaceAll("_", "").toLowerCase())
    ?? existing?.status ?? "new";
  const isTeamLead = role === "TeamLead";
  const ambiguousDetailAssignee = detail && job.assigneeTeamLead === undefined
    && Boolean(job.assigneeName?.trim())
    && job.assigneeName?.trim() === (job.latestSurveyorName ?? existing?.latestSurveyorName)?.trim();
  const leadName = job.assigneeTeamLead !== undefined
    ? job.assigneeTeamLead : ambiguousDetailAssignee ? undefined : job.assigneeName;
  const surveyorChanged = job.assignedSurveyorId !== undefined
    && String(job.assignedSurveyorId) !== existing?.assignedSurveyor?.userId;
  const returnedSurveyorName = job.latestSurveyorName?.trim() || undefined;
  const surveyorName = job.latestSurveyorName === undefined
    ? isTeamLead && surveyorChanged ? undefined : existing?.latestSurveyorName
    : returnedSurveyorName;
  const surveyor = isTeamLead && job.latestSurveyorName !== undefined && !returnedSurveyorName ? undefined
    : job.assignedSurveyorId === undefined
    ? job.latestSurveyorName !== undefined && returnedSurveyorName !== existing?.latestSurveyorName
      ? undefined : existing?.assignedSurveyor
    : job.assignedSurveyorId === null ? undefined
      : { userId: String(job.assignedSurveyorId), role: "Surveyor" as const };
  if (isTeamLead && (status === "new" || status === "assigned_teamlead" || status === "assigned_surveyor")) {
    if (job.latestSurveyorName !== undefined) {
      status = returnedSurveyorName ? "assigned_surveyor" : "new";
    } else if (job.assignedSurveyorId !== undefined) {
      status = job.assignedSurveyorId === null ? "new" : "assigned_surveyor";
    }
  }
  return {
    ...existing,
    id: String(job.id),
    jobRef: job.jobRef,
    siteName: job.siteName,
    address: job.siteAddress,
    latitude: job.latitude ?? existing?.latitude,
    longitude: job.longitude ?? existing?.longitude,
    status,
    scheduledDate: job.scheduledDate ?? undefined,
    createdDate: job.createdDate ?? existing?.createdDate,
    createdByName: job.createdByName?.trim() || existing?.createdByName,
    updatedDate: job.updatedDate ?? existing?.updatedDate,
    assigneeName: leadName === undefined ? existing?.assigneeName : leadName ?? undefined,
    leadAssignmentKnown: leadName !== undefined ? true : existing?.leadAssignmentKnown ?? false,
    latestSurveyorName: surveyorName,
    assignedSurveyor: isTeamLead ? surveyor : existing?.assignedSurveyor,
    createdBy: existing?.createdBy ?? { userId: "", role: "Manager" },
    assignedTo: isTeamLead
      ? (leadName === null || (leadName !== undefined && existing?.assigneeName !== leadName)
        ? undefined : existing?.assignedTo?.role === "TeamLead" ? existing.assignedTo : undefined)
      : job.assigneeTeamLead === null ? undefined
      : job.assignedSurveyorId === undefined
      ? existing?.assignedTo
      : job.assignedSurveyorId === null
        ? undefined
        : {
            userId: String(job.assignedSurveyorId),
            role: existing?.assignedTo?.userId === String(job.assignedSurveyorId)
              ? existing.assignedTo.role : "Surveyor",
          },
    siteDetails: {
      ...existing?.siteDetails,
      ...(job.comments !== undefined ? { notes: job.comments ?? "" } : {}),
    },
    assignmentHistory: existing?.assignmentHistory ?? [],
    attempt: existing?.attempt ?? 0,
    updatedAt: new Date().toISOString(),
    dirty: false,
    syncStatus: "synced",
    pendingEditBy: undefined,
    syncError: undefined,
  };
}

function mapApiRosterUser(user: ApiRosterUser, role: 'Surveyor' | 'TeamLead'): User {
  return {
    id: String(user.id),
    name: user.displayName.trim() || user.email,
    role,
  };
}

type ApiResult<T> = { data: T } | { error: ApiErrorShape };
type RequestOptions = {
  method: "GET" | "POST" | "PATCH" | "PUT";
  body?: unknown;
  idempotencyKey?: string;
};
type Dispatch = BaseQueryApi["dispatch"];

function tokenExpiry(token: string, expiry?: string | null): number | undefined {
  if (expiry) {
    const timestamp = Date.parse(expiry);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  try {
    const { exp } = decodeJwtClaims(token);
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : undefined;
  } catch {
    // Legacy sessions may contain an opaque token; a 401 still triggers refresh.
    return undefined;
  }
}

function validTokenResponse(body: unknown): body is RefreshTokenResponse {
  if (!body || typeof body !== "object") return false;
  const fields = body as Record<string, unknown>;
  return typeof fields.accessToken === "string" && !!fields.accessToken.trim()
    && (fields.refreshToken === undefined || fields.refreshToken === null
      || (typeof fields.refreshToken === "string" && !!fields.refreshToken.trim()))
    && (fields.expiry === undefined || typeof fields.expiry === "string");
}

const sessionEnded = (): ApiResult<never> => ({
  error: { status: 401, message: "Your session has expired. Please sign in again." },
});

function clearApiAfterRequests(dispatch: Dispatch): void {
  // Resetting inside queryFn erases its pending result and makes unwrap resolve undefined.
  void dispatch(async (dispatch, getState: () => RootState) => {
    await Promise.all([
      ...dispatch(baseApi.util.getRunningQueriesThunk()),
      ...dispatch(baseApi.util.getRunningMutationsThunk()),
    ]);
    if (!getState().auth.userId) dispatch(baseApi.util.resetApiState());
  });
}

async function endSession(session: AuthSessionRecord, dispatch: Dispatch): Promise<ApiResult<never>> {
  try {
    if (await authRepo.replaceIfCurrent(session, null)) {
      dispatch(loggedOut());
      clearApiAfterRequests(dispatch);
    }
  } catch {
    dispatch(loggedOut());
    clearApiAfterRequests(dispatch);
    return { error: { status: 500, message: "Unable to clear the saved session. Please reload and sign in again." } };
  }
  return sessionEnded();
}

// Refresh uses the raw transport, never the authenticated wrapper, so it cannot recurse.
async function requestJson<T>(
  path: string,
  init: RequestOptions = { method: "GET" },
  session?: AuthSessionRecord,
): Promise<{ data: T } | { error: ApiErrorShape }> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${AUTH_API_BASE_URL}${path}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    const error: ApiErrorShape = {
      status: 0,
      message: "Unable to reach the server. Check your connection.",
    };
    return { error };
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const error: ApiErrorShape = {
      status: res.status,
      message: String(
        (typeof body?.error === "string" && body.error)
          || body?.detail || body?.title || body?.message
          || "Request failed. Please try again.",
      ),
    };
    return { error };
  }

  return { data: body as T };
}

let refreshInFlight: {
  session: AuthSessionRecord;
  promise: Promise<ApiResult<AuthSessionRecord>>;
} | undefined;

async function refreshSession(
  expected: AuthSessionRecord,
  dispatch: Dispatch,
): Promise<ApiResult<AuthSessionRecord>> {
  const current = await authRepo.get();
  if (!current || current.userId !== expected.userId) return sessionEnded();
  if (!isSameAuthSession(current, expected)) return { data: current };

  if (refreshInFlight) {
    const pending = refreshInFlight;
    const result = await pending.promise;
    if (isSameAuthSession(pending.session, expected)) return result;
    return refreshSession(expected, dispatch);
  }

  const promise = (async (): Promise<ApiResult<AuthSessionRecord>> => {
    if (!expected.refreshToken) return endSession(expected, dispatch);
    const result = await requestJson<unknown>("/api/auth/refresh", {
      method: "POST", body: { refreshToken: expected.refreshToken },
    });
    if ("error" in result || !validTokenResponse(result.data)) return endSession(expected, dispatch);
    const expiry = tokenExpiry(result.data.accessToken, result.data.expiry);
    if (expiry === undefined || expiry <= Date.now()) return endSession(expected, dispatch);
    const next: AuthSessionRecord = {
      ...expected,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken ?? expected.refreshToken,
      expiry: new Date(expiry).toISOString(),
    };
    try {
      // A logout or another login while the HTTP call was in flight wins.
      if (!await authRepo.replaceIfCurrent(expected, next)) return sessionEnded();
    } catch {
      const ended = await endSession(expected, dispatch);
      if ("error" in ended && ended.error.status === 500) return ended;
      return { error: { status: 500, message: "Unable to save the refreshed session. Please sign in again." } };
    }
    dispatch(authHydrated(next));
    return { data: next };
  })();
  refreshInFlight = { session: expected, promise };
  try {
    return await promise;
  } finally {
    if (refreshInFlight?.promise === promise) refreshInFlight = undefined;
  }
}

async function apiRequest<T>(
  path: string,
  dispatch: Dispatch,
  init: RequestOptions = { method: "GET" },
): Promise<ApiResult<T>> {
  let session = await authRepo.get();
  if (!session) return sessionEnded();
  let refreshed = false;
  const expiry = tokenExpiry(session.accessToken, session.expiry);
  if (expiry !== undefined && expiry <= Date.now()) {
    const result = await refreshSession(session, dispatch);
    if ("error" in result) return result;
    session = result.data;
    refreshed = true;
  }
  const result = await requestJson<T>(path, init, session);
  if (!("error" in result) || result.error.status !== 401) return result;
  if (refreshed) return endSession(session, dispatch);
  const refresh = await refreshSession(session, dispatch);
  if ("error" in refresh) return refresh;
  const retry = await requestJson<T>(path, init, refresh.data);
  return "error" in retry && retry.error.status === 401
    ? endSession(refresh.data, dispatch) : retry;
}

async function getRoster(dispatch: Dispatch, role: "Surveyor" | "TeamLead"): Promise<ApiResult<User[]>> {
  const res = await apiRequest<ApiRosterUser[]>("/api/user/team", dispatch);
  if ("error" in res) return res;
  return { data: res.data.filter((user) => user.isActive).map((user) => mapApiRosterUser(user, role)) };
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery<ApiErrorShape>(),
  tagTypes: ["Job", "User"],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      async queryFn(credentials, { dispatch }) {
        let res: Response;
        try {
          res = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials),
          });
        } catch {
          const error: ApiErrorShape = {
            status: 0,
            message: "Unable to reach the server. Check your connection.",
          };
          return { error };
        }

        if (!res.ok) {
          const text = await res.text();
          let errorBody: unknown = text;
          try {
            errorBody = JSON.parse(text) as unknown;
          } catch {
            // Non-JSON error responses may contain a plain-text message.
          }
          let message = loginErrorMessage(errorBody);

          if (!message) {
            if (res.status === 401 || res.status === 400)
              message = "Invalid email or password.";
            else if (res.status >= 500)
              message = "Server is unavailable. Please try again shortly.";
            else message = "Sign in failed.";
          }

          const error: ApiErrorShape = {
            status: res.status,
            message: String(message),
          };
          return { error };
        }

        const body = await res.json().catch(() => null);
        if (!validTokenResponse(body) || typeof body.expiry !== "string"
          || !Number.isFinite(Date.parse(body.expiry))) {
          return { error: { status: 500, message: "Invalid authentication response returned by the server." } };
        }
        const { accessToken, refreshToken, expiry } = body;
        let claims: LoginJwtClaims;
        try {
          claims = decodeJwtClaims(accessToken);
          if (!claims || typeof claims.sub !== "string" || !claims.sub
            || typeof claims.name !== "string"
            || !(typeof claims.role === "string"
              || (Array.isArray(claims.role) && claims.role.every((role) => typeof role === "string")))) {
            return { error: { status: 500, message: "Invalid authentication claims returned by the server." } };
          }
        } catch {
          return { error: { status: 500, message: "Invalid authentication token returned by the server." } };
        }
        const roleClaim = (
          Array.isArray(claims.role) ? claims.role[0] : claims.role
        )?.trim().toUpperCase().replace(/[\s_-]+/g, "");
        const role = roleClaim ? BACKEND_ROLE_MAP[roleClaim] : undefined;
        if (!role) {
          const error: ApiErrorShape = {
            status: 500,
            message: "Unrecognized role returned by the server.",
          };
          return { error };
        }

        const data: LoginResponse = {
          accessToken,
          refreshToken: refreshToken ?? null,
          expiry,
          userId: claims.sub,
          name: claims.name,
          role,
          errorMessage: "errorMessage" in body && typeof body.errorMessage === "string"
            ? body.errorMessage : undefined,
        };
        // Persist before resolving login so the destination's requests use the new session.
        await authRepo.set({
          userId: data.userId,
          name: data.name,
          role: data.role,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiry: data.expiry,
        });
        dispatch(loginSucceeded(data));
        dispatch(baseApi.util.invalidateTags(["Job", "User"]));
        return { data };
      },
    }),

    logout: builder.mutation<void, LogoutRequest>({
      queryFn(body) {
        return requestJson<void>("/api/auth/logout", { method: "POST", body });
      },
    }),

    getJobs: builder.query<GetJobsResponse, GetJobsParams | void>({
      async queryFn(params, { dispatch }) {
        const search = new URLSearchParams();
        if (params?.status) search.set("status", params.status);
        const query = search.toString();
        const requestedAt = Date.now();
        const res = await apiRequest<GetJobsApiResponse>(`/api/jobs${query ? `?${query}` : ""}`, dispatch);
        if ("error" in res) return res;
        const session = await authRepo.get();
        const jobs = await jobsRepo.mergeServerJobs(res.data, (row, existing) =>
          mapApiJob(row, existing, session?.role), requestedAt);
        dispatch(jobsReplaced(jobs));
        return { data: { jobs } };
      },
      providesTags: ["Job"],
    }),

    getJob: builder.query<GetJobResponse, string>({
      async queryFn(id, { dispatch }) {
        const requestedAt = Date.now();
        const local = await jobsRepo.getById(id) ?? await jobsRepo.getByClientId(id);
        const jobId = local?.id ?? id;
        const res = await apiRequest<ApiJob>(`/api/job/${encodeURIComponent(jobId)}`, dispatch);
        if ("error" in res) return res;
        const session = await authRepo.get();
        const data = await jobsRepo.mergeServerJob(res.data, (row, existing) =>
          mapApiJob(row, existing, session?.role, true), requestedAt);
        dispatch(jobUpserted(data));
        return { data };
      },
      providesTags: (_result, _error, id) => [{ type: "Job", id }],
    }),

    // The backend returns the appropriate roster for the authenticated user.
    getUsers: builder.query<GetUsersResponse, GetUsersParams>({
      async queryFn({ role }, { dispatch }) {
        const userRole = role === "teamlead" ? "TeamLead" : "Surveyor";
        const res = await getRoster(dispatch, userRole);
        if ("error" in res) return res;
        return { data: { users: res.data } };
      },
      // The response is authoritative for its role: stale cached rows (e.g. old TeamLead data) are dropped.
      async onQueryStarted({ role }, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          const userRole = role === "surveyor" ? "Surveyor" : "TeamLead";
          await usersRepo.replaceRole(userRole, data.users);
          dispatch(usersReplacedForRole({ role: userRole, users: data.users }));
        } catch { /* the hook already exposes the error */ }
      },
      providesTags: ["User"],
    }),

    createJob: builder.mutation<CreateJobResponse, CreateJobRequest>({
      async queryFn(body, { dispatch }) {
        const payload: CreateJobRequest = {
          siteName: body.siteName,
          siteAddress: body.siteAddress,
          ...(body.latitude !== undefined && body.longitude !== undefined
            ? { latitude: body.latitude, longitude: body.longitude } : {}),
          scheduledDate: body.scheduledDate,
          createdDate: toIsoDateOnly(body.createdDate),
          ...(body.createdBy ? { createdBy: body.createdBy } : {}),
          ...(body.updatedDate ? { updatedDate: toIsoDateOnly(body.updatedDate) } : {}),
          assignedSurveyorId: body.assignedSurveyorId,
          comments: body.comments,
        };
        const res = await apiRequest<ApiJob>("/api/job/create_job", dispatch, {
          method: "POST",
          body: payload,
          idempotencyKey: body.clientRequestId,
        });
        if ("error" in res) return res;
        const session = await authRepo.get();
        const existing = body.localJobId ? await jobsRepo.getById(body.localJobId) : undefined;
        const data = mapApiJob({
          ...res.data,
          latitude: res.data.latitude ?? body.latitude,
          longitude: res.data.longitude ?? body.longitude,
          createdDate: res.data.createdDate ?? body.createdDate,
          updatedDate: res.data.updatedDate ?? body.updatedDate,
          comments: res.data.comments === undefined ? body.comments : res.data.comments,
          assignedSurveyorId: res.data.assignedSurveyorId === undefined
            ? body.assignedSurveyorId : res.data.assignedSurveyorId,
        }, existing, session?.role);
        if (session) {
          data.createdBy = { userId: session.userId, role: session.role };
          if (data.assignedTo && session.role === "Manager") {
            data.assignedTo.role = "TeamLead";
          }
        }
        return { data };
      },
    }),

    reassignJob: builder.mutation<UpdateJobResponse, ReassignJobRequest>({
      async queryFn({ id, assignedSurveyorId }, { dispatch }) {
        const res = await apiRequest<ApiJob>(
          `/api/job/reassign_job/${encodeURIComponent(id)}`,
          dispatch,
          {
            method: "PATCH",
            body: { assignedSurveyorId },
          },
        );
        if ("error" in res) return res;
        const existing = await jobsRepo.getById(id);
        const session = await authRepo.get();
        const data = mapApiJob({
          ...res.data,
          assignedSurveyorId: res.data.assignedSurveyorId === undefined
            ? assignedSurveyorId : res.data.assignedSurveyorId,
          assigneeName: session?.role === "TeamLead"
            ? res.data.assigneeName
            : res.data.assigneeName ?? (assignedSurveyorId === null
              ? null : existing?.assigneeName ?? null),
        }, existing, session?.role);
        return { data };
      },
    }),
    updateJob: builder.mutation<UpdateJobResponse, UpdateJobRequest>({
      async queryFn({ id, assignedTo, assignedSurveyorId, siteDetails, updatedDate, ...details }, { dispatch }) {
        if (siteDetails) return notImplemented("Editing building details");
        const existing = await jobsRepo.getById(id);
        const session = await authRepo.get();
        let payloadAssignee = assignedTo ? Number(assignedTo.userId) : assignedSurveyorId;
        let resolvedAssignee: User | undefined;
        if (payloadAssignee === undefined) {
          if (!existing || !session) {
            return { error: { status: 400, message: "Load the job and select an assignee before updating it." } };
          }
          const current = session.role === "TeamLead" ? existing.assignedSurveyor : existing.assignedTo;
          const name = session.role === "TeamLead" ? existing.latestSurveyorName : existing.assigneeName;
          if (!current && name?.trim()) {
            const roster = await getRoster(dispatch, session.role === "TeamLead" ? "Surveyor" : "TeamLead");
            if ("error" in roster) return roster;
            const matches = matchingAssignmentNames(name, roster.data, (user) => user.name);
            if (matches.length !== 1) {
              return { error: { status: 400, message: matches.length
                ? "The current assignee matches multiple roster members. Select the correct assignee."
                : "The current assignee was not found in the roster. Select the correct assignee." } };
            }
            resolvedAssignee = matches[0];
          }
          payloadAssignee = current ? Number(current.userId) : resolvedAssignee ? Number(resolvedAssignee.id) : null;
        }
        if (payloadAssignee !== null && (!Number.isSafeInteger(payloadAssignee) || payloadAssignee <= 0)) {
          return { error: { status: 400, message: "Select an assignee with a valid ID before updating this job." } };
        }
        const res = await apiRequest<ApiJob>(
          `/api/job/update_job/${encodeURIComponent(id)}`,
          dispatch,
          {
            method: "PUT",
            body: {
              ...details,
              ...(updatedDate ? { updatedDate: toIsoDateOnly(updatedDate) } : {}),
              assignedSurveyorId: payloadAssignee,
            },
          },
        );
        if ("error" in res) return res;
        const latest = await jobsRepo.getById(id);
        let existingForMapping = latest && latest.address !== res.data.siteAddress
          ? { ...latest, latitude: undefined, longitude: undefined } : latest;
        if (existingForMapping && resolvedAssignee) {
          const actor = { userId: resolvedAssignee.id, role: resolvedAssignee.role };
          existingForMapping = session?.role === "TeamLead"
            ? { ...existingForMapping, assignedSurveyor: actor }
            : { ...existingForMapping, assignedTo: actor };
        }
        const data = mapApiJob({
          ...res.data,
          updatedDate: res.data.updatedDate ?? updatedDate,
          comments: res.data.comments === undefined ? details.comments : res.data.comments,
          assigneeName: res.data.assigneeName === undefined && !assignedTo && assignedSurveyorId === undefined
            ? latest?.assigneeName ?? null : res.data.assigneeName,
          assignedSurveyorId: res.data.assignedSurveyorId === undefined
            ? resolvedAssignee ? payloadAssignee : assignedTo ? Number(assignedTo.userId) : assignedSurveyorId
            : res.data.assignedSurveyorId,
        }, existingForMapping, session?.role);
        return { data };
      },
    }),

    getSurveySession: builder.query<GetSurveySessionResponse, string>({
      async queryFn(id, { dispatch }) {
        return apiRequest<GetSurveySessionResponse>(`/api/${encodeURIComponent(id)}/survey`, dispatch);
      },
    }),

    transitionJob: builder.mutation<
      TransitionJobResponse,
      TransitionJobRequest
    >({
      async queryFn() {
        return notImplemented("Job transitions");
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: "Job", id: arg.id },
        "Job",
      ],
      async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
        const { data } = await queryFulfilled;
        await jobsRepo.upsert(data.job);
        dispatch(jobUpserted(data.job));
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetJobsQuery,
  useGetJobQuery,
  useGetUsersQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useGetSurveySessionQuery,
  useTransitionJobMutation,
} = baseApi;
