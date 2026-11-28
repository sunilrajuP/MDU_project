// Surveyor RTK Query API. Same pattern as baseApi (fakeBaseQuery + queryFn), but all I/O goes through
// surveyorTransport so one flag swaps mock data for the real backend. Components only import the hooks below.

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ApiErrorShape } from '@/types/api';
import type {
  ConfirmSectionRequest,
  ConfirmSectionResponse,
  ConfirmSiteLocationRequest,
  ConfirmSiteLocationResponse,
  GetBomResponse,
  GetSiteInfoResponse,
  RecommendBfdRequest,
  RecommendBfdResponse,
  SubmitSurveyRequest,
  SubmitSurveyResponse,
  GetSurveyorJobsResponse,
  SaveSiteInfoRequest,
  SiteInfo,
  SaveSiteInfoResponse,
  Runbook,
  RunbookConfig,
  SaveMarkupRequest,
  SaveMarkupResponse,
  SaveSectionRequest,
  SaveSectionResponse,
  SurveyorJobDetail,
  SurveyorJobStatus,
  SurveyorJobSummary,
  UploadMediaRequest,
  UploadMediaResponse,
} from '@/types/surveyor';
import { surveyorRequest } from './surveyorTransport';
import { apiRequest, baseApi } from './baseApi';
import { authRepo } from '@/data/repos/authRepo';
import { jobsRepo } from '@/data/repos/jobsRepo';
import type { Job } from '@/types/domain';
import { normalizeChoice, parseBackendSurvey, type BackendSurvey, type SurveyCardAnswers } from '@/types/backendSurvey';

// Backend site-information DTO (GET/PUT /api/jobs/{jobId}/site-information).
interface SiteInformationDto {
  parkingAvailable?: boolean | null;
  accessWindow?: string | null;
  entryAccessInstructions?: string | null;
  accessRequirements?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactRole?: string | null;
  buildingName?: string | null;
  buildingType?: string | null;
  ground?: string | null;
}

const BUILDING_TYPE_OPTIONS = ['Vertical', 'Horizontal'];
const GROUND_OPTIONS = ['Green field', 'Brown field'];

// Response of POST /api/jobs/{jobId}/survey-start.
// Response of POST /api/jobs/{jobId}/survey-start.
interface StartSurveyDto {
  jobId: number;
  status: string;
  sessionId: string | number;
  startedAt: string;
  resumed: boolean;
}

// Response of GET /api/jobs/{jobId}/questionnaire (the job's question template; assumed same shape as GET /api/questionnaire).
interface QuestionnaireDto {
  sections: {
    id: number;
    code: string;
    title: string;
    sortOrder: number;
    repeatPerFloor: boolean;
    questions: {
      id: number;
      code: string;
      prompt: string;
      answerType: string;
      isRequired: boolean;
      minPhotos?: number | null;
      flagOn?: string | null;
      sortOrder: number;
    }[];
  }[];
}

// Builds the survey the runbook renders from questionnaire + session + saved responses.
function buildSurvey(jobRef: string, started: StartSurveyDto, questionnaire: QuestionnaireDto, dto: SessionResponsesDto): unknown {
  const saved = new Map<string, NonNullable<SessionResponsesDto['responses']>[number]>();
  for (const response of dto.responses ?? []) {
    if (response.floorId == null) saved.set(`${response.sectionId}:${response.itemId}`, response);
  }
  return {
    jobId: started.jobId,
    jobRef,
    sessionId: String(started.sessionId),
    status: dto.submittedAt ? 'Submitted' : dto.jobStatus ?? started.status,
    sections: questionnaire.sections.map((section) => {
      const items = section.questions.map((question) => {
        const response = saved.get(`${section.id}:${question.id}`);
        const value = typeof response?.value === 'string' ? response.value : null;
        return {
          id: question.id,
          sectionId: section.id,
          code: question.code,
          prompt: question.prompt,
          answerType: question.answerType,
          isRequired: question.isRequired,
          minPhotos: question.minPhotos ?? 0,
          flagOn: question.flagOn ?? null,
          sortOrder: question.sortOrder,
          responseValue: value,
          isAnswered: value !== null && value !== '',
          isFlagged: response?.isFlagged ?? false,
          note: response?.note ?? null,
        };
      });
      // A section is complete once every required question the app can answer has an answer.
      const required = items.filter((item) => item.isRequired && (item.answerType === 'TEXT' || item.answerType === 'YES_NO_NA'));
      return {
        id: section.id,
        code: section.code,
        title: section.title,
        sortOrder: section.sortOrder,
        repeatPerFloor: section.repeatPerFloor,
        isCompleted: !section.repeatPerFloor && required.length > 0 && required.every((item) => item.isAnswered),
        items,
      };
    }),
  };
}

// Response of GET /api/jobs/{jobId}/survey-sessions/{sessionId}/responses (only the fields used here).
interface SessionResponsesDto {
  jobStatus?: string | null;
  submittedAt?: string | null;
  responses?: {
    itemId: number;
    sectionId: number;
    floorId?: number | null;
    value?: string | null;
    isFlagged?: boolean | null;
    note?: string | null;
  }[];
}

function mergeSessionResponses(survey: BackendSurvey, dto: SessionResponsesDto): BackendSurvey {
  const saved = new Map<string, NonNullable<SessionResponsesDto['responses']>[number]>();
  for (const response of dto.responses ?? []) {
    if (response.floorId == null && typeof response.value === 'string') {
      saved.set(`${response.sectionId}:${response.itemId}`, response);
    }
  }
  if (!saved.size) return survey;
  return {
    ...survey,
    sections: survey.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        const response = saved.get(`${section.id}:${item.id}`);
        // GET /survey can flag an item answered yet omit its value for another surveyor, so only a real value wins.
        if (!response || item.responseValue) return item;
        return {
          ...item,
          responseValue: response.value ?? null,
          isAnswered: true,
          isFlagged: response.isFlagged ?? item.isFlagged,
          note: response.note ?? item.note,
        };
      }),
    })),
  };
}

const PARKING_OPTIONS = ['Yes', 'No'];

const CONFIRMED_KEY = 'surveyor.locationConfirmed.';
function confirmedLocally(jobRef: string): boolean {
  try {
    return localStorage.getItem(`${CONFIRMED_KEY}${jobRef}`) !== null;
  } catch {
    return false;
  }
}

// Surveyor screens address jobs by jobRef; the backend wants the numeric job id (Job.id in the local store).
async function resolveJobId(jobRef: string): Promise<string> {
  const jobs = await jobsRepo.getAll();
  return encodeURIComponent(jobs.find((job) => job.jobRef === jobRef)?.id ?? jobRef);
}

function fromSiteInformationDto(dto: SiteInformationDto): SiteInfo {
  return {
    stakeholder: {
      role: { value: dto.contactRole ?? '' },
      name: { value: dto.contactName ?? '' },
      phone: { value: dto.contactPhone ?? '' },
      email: { value: dto.contactEmail ?? '' },
    },
    access: {
      parking: dto.parkingAvailable ? 'Yes' : 'No',
      accessWindow: dto.accessWindow ?? '',
      entryInstructions: { value: dto.entryAccessInstructions ?? '' },
      accessRequirements: dto.accessRequirements ?? '',
    },
    building: {
      name: dto.buildingName ?? '',
      type: dto.buildingType ?? '',
      ground: dto.ground ?? '',
    },
    rev: 0, // backend has no revision
  };
}

function toSiteInformationDto(info: Omit<SiteInfo, 'rev'>): SiteInformationDto {
  return {
    parkingAvailable: info.access.parking === 'Yes',
    accessWindow: info.access.accessWindow,
    entryAccessInstructions: info.access.entryInstructions.value,
    accessRequirements: info.access.accessRequirements,
    contactName: info.stakeholder.name.value,
    contactEmail: info.stakeholder.email.value,
    contactPhone: info.stakeholder.phone.value,
    contactRole: info.stakeholder.role.value,
    buildingName: info.building.name,
    buildingType: info.building.type,
    ground: info.building.ground,
  };
}

const SURVEYOR_STATUS: Record<Job['status'], SurveyorJobStatus> = {
  new: 'not_started',
  YetToAssign: 'not_started',
  assigned_teamlead: 'not_started',
  assigned_surveyor: 'not_started',
  in_progress: 'in_progress',
  returned: 'returned',
  submitted: 'submitted',
  pending_qc: 'submitted',
  approved: 'submitted',
};

function toSurveyorJobSummary(job: Job): SurveyorJobSummary {
  const status = SURVEYOR_STATUS[job.status];
  return {
    jobRef: job.jobRef ?? job.id,
    siteName: job.siteName,
    address: job.address,
    status,
    scheduledDate: job.scheduledDate ?? '',
    progress: null,
    sync: { state: job.syncStatus, lastSyncedAt: job.updatedAt },
    returned: status === 'returned' ? { reason: job.comments ?? '', returnedAt: job.updatedAt, dataRetained: true } : null,
  };
}

// Response of POST /api/jobs/{jobId}/survey-sessions/{sessionId}/submit.
interface BackendSubmitResponse {
  submitted?: string;
  sessionId?: number;
  jobId?: number;
  status?: string;
  statusName?: string;
  submittedAt?: string;
}

const jobPath = (jobRef: string) => `/jobs/${encodeURIComponent(jobRef)}`;

export const surveyorApi = createApi({
  reducerPath: 'surveyorApi',
  baseQuery: fakeBaseQuery<ApiErrorShape>(),
  tagTypes: ['SurveyorJobs', 'SurveyorJob', 'Runbook', 'SiteInfo'],
  endpoints: (builder) => ({
    getBackendSurvey: builder.query<BackendSurvey, { jobRef: string; userId: string }>({
      async queryFn({ jobRef, userId }, { dispatch }) {
        const result = await apiRequest<unknown>(`/api/jobs/${encodeURIComponent(jobRef)}/questionnaire`, dispatch, undefined, userId);
        if ('error' in result) return result;
        const survey = parseBackendSurvey(result.data);
        if (!survey || survey.jobRef !== jobRef) {
          return { error: { status: 422, message: 'The server returned an invalid survey or a different job.' } };
        }
        return { data: survey };
      },
    }),

    saveBackendSurveyAnswers: builder.mutation<BackendSurvey, {
      jobId: number;
      userId: string;
      sessionId: string;
      sectionId: number;
      cards: SurveyCardAnswers[];
    }>({
      async queryFn({ jobId, userId, sessionId, sectionId, cards }, { dispatch }) {
        const result = await apiRequest<unknown>(
          `/api/jobs/${encodeURIComponent(String(jobId))}/survey-sessions/${encodeURIComponent(sessionId)}/sections/${encodeURIComponent(String(sectionId))}/answers`,
          dispatch,
          { method: 'PUT', body: cards }, userId,
        );
        if ('error' in result) return result;
        let survey = parseBackendSurvey(result.data);
        if (!survey || survey.jobId !== jobId || survey.sessionId !== sessionId) {
          return { error: { status: 422, message: 'The server returned an invalid or different survey after saving.' } };
        }
        const unconfirmed = (current: BackendSurvey) => cards.some((card) => {
          const section = current.sections.find((entry) => entry.id === card.sectionId);
          return !section || card.answers.some((answer) => {
            const item = section.items.find((entry) => entry.id === answer.itemId);
            // "YES" and 'true' are the same Yes/No answer, so compare those in their normalised form.
            const same = item?.answerType === 'YES_NO_NA'
              ? normalizeChoice(item.responseValue ?? '') === normalizeChoice(answer.value)
              : (item?.responseValue ?? '') === answer.value;
            return !item || !same || item.isFlagged !== answer.isFlagged ||
              (item.note ?? '') !== answer.note;
          });
        });
        // The save response can omit stored values (e.g. answers made by another surveyor), so confirm against
        // the session's saved responses before treating the save as unconfirmed.
        if (unconfirmed(survey)) {
          const saved = await apiRequest<SessionResponsesDto>(
            `/api/jobs/${survey.jobId}/survey-sessions/${encodeURIComponent(survey.sessionId)}/responses`,
            dispatch, undefined, userId,
          );
          if (!('error' in saved)) survey = mergeSessionResponses(survey, saved.data);
        }
        if (unconfirmed(survey)) {
          return { error: { status: 422, message: 'The server did not confirm the saved answers.' } };
        }
        return { data: survey };
      },
    }),

    // POST /api/jobs/{jobId}/survey-sessions/{sessionId}/submit - hands the job over to the surveyor's team lead.
    submitBackendSurvey: builder.mutation<BackendSubmitResponse, { jobId: number; sessionId: string; userId: string; jobRef: string }>({
      async queryFn({ jobId, sessionId, userId }, { dispatch }) {
        return apiRequest<BackendSubmitResponse>(
          `/api/jobs/${encodeURIComponent(String(jobId))}/survey-sessions/${encodeURIComponent(sessionId)}/submit`,
          dispatch,
          { method: 'POST' },
          userId,
        );
      },
      invalidatesTags: (_r, _e, { jobRef }) => ['SurveyorJobs', { type: 'SurveyorJob', id: jobRef }],
    }),

    getSurveyorJobs: builder.query<GetSurveyorJobsResponse, { status?: SurveyorJobStatus } | void>({
      // Reuses baseApi's getJobs (GET /api/jobs, auth, local merge) and maps its Jobs to the Surveyor shape.
      // The status filter is applied client-side by MyJobsPage, so no server-side status is sent.
      async queryFn(_arg, { dispatch }) {
        const res = await dispatch(baseApi.endpoints.getJobs.initiate(undefined, { forceRefetch: true }));
        if (res.error || !res.data) {
          return { error: (res.error as ApiErrorShape) ?? { status: 0, message: 'Jobs could not be loaded.' } };
        }
        const session = await authRepo.get();
        return {
          data: {
            assignedTo: { userId: session?.userId ?? '', name: session?.name ?? '' },
            // Jobs awaiting QC are out of the surveyor's hands, so they are not listed.
            jobs: res.data.jobs.filter((job) => job.status !== 'pending_qc').map(toSurveyorJobSummary),
          },
        };
      },
      providesTags: ['SurveyorJobs'],
    }),

    getSurveyorJob: builder.query<SurveyorJobDetail, string>({
      // Reuses baseApi's getJob (GET /api/job/{id}) and maps the Job to the Surveyor detail shape.
      async queryFn(jobRef, { dispatch }) {
        const local = (await jobsRepo.getAll()).find((entry) => entry.jobRef === jobRef);
        const res = await dispatch(baseApi.endpoints.getJob.initiate(local?.id ?? jobRef, { forceRefetch: true }));
        if (res.error || !res.data) {
          return { error: (res.error as ApiErrorShape) ?? { status: 404, message: 'Job not found.' } };
        }
        const job = res.data;
        const summary = toSurveyorJobSummary(job);
        const session = await authRepo.get();
        return {
          data: {
            jobRef: summary.jobRef,
            siteName: summary.siteName,
            address: summary.address,
            status: summary.status,
            scheduledDate: summary.scheduledDate,
            assignedTo: session?.name ?? '',
            location: {
              latitude: job.latitude ?? 0,
              longitude: job.longitude ?? 0,
              confirmed: confirmedLocally(summary.jobRef), // the backend has no "confirmed" flag yet
              accuracyM: 0,
            },
            sync: summary.sync,
            returned: summary.returned,
            surveyStarted: summary.status !== 'not_started',
          },
        };
      },
      providesTags: (_r, _e, jobRef) => [{ type: 'SurveyorJob', id: jobRef }],
    }),

    confirmSiteLocation: builder.mutation<ConfirmSiteLocationResponse, ConfirmSiteLocationRequest>({
      // Frontend-only for now: the backend has no surveyor-allowed confirm endpoint, so the confirmation is
      // remembered on this device (see confirmedLocally) and nothing is sent to the server.
      queryFn: ({ jobRef }) => {
        const confirmedAt = new Date().toISOString();
        try {
          localStorage.setItem(`${CONFIRMED_KEY}${jobRef}`, confirmedAt);
        } catch {
          /* storage unavailable: confirmation lasts for this session only */
        }
        return { data: { confirmed: true as const, confirmedAt } };
      },
      invalidatesTags: (_r, _e, { jobRef }) => [{ type: 'SurveyorJob', id: jobRef }],
    }),

    getSiteInfo: builder.query<GetSiteInfoResponse, string>({
      // Real backend: GET /api/jobs/{jobId}/site-information (flat DTO mapped to the UI shape).
      async queryFn(jobRef, { dispatch }) {
        const res = await apiRequest<SiteInformationDto>(
          `/api/jobs/${await resolveJobId(jobRef)}/site-information`,
          dispatch,
        );
        // 404 = nothing saved yet for this job: show an empty form for the surveyor to fill in.
        if ('error' in res && res.error.status !== 404) return res;
        const dto = 'error' in res ? {} : res.data;
        return { data: { siteInfo: fromSiteInformationDto(dto), options: { parking: PARKING_OPTIONS, buildingType: BUILDING_TYPE_OPTIONS, ground: GROUND_OPTIONS } } };
      },
      providesTags: (_r, _e, jobRef) => [{ type: 'SiteInfo', id: jobRef }],
    }),

    saveSiteInfo: builder.mutation<SaveSiteInfoResponse, SaveSiteInfoRequest>({
      // Real backend: PUT /api/jobs/{jobId}/site-information.
      async queryFn({ jobRef, siteInfo }, { dispatch }) {
        const res = await apiRequest<SiteInformationDto>(
          `/api/jobs/${await resolveJobId(jobRef)}/site-information`,
          dispatch,
          { method: 'PUT', body: toSiteInformationDto(siteInfo) },
        );
        if ('error' in res) return res;
        return { data: { rev: 0, savedAt: new Date().toISOString() } };
      },
      invalidatesTags: (_r, _e, { jobRef }) => [{ type: 'SiteInfo', id: jobRef }],
    }),

    recommendBfd: builder.mutation<RecommendBfdResponse, RecommendBfdRequest>({
      queryFn: ({ jobRef, answers }) =>
        surveyorRequest<RecommendBfdResponse>({
          method: 'POST',
          path: `${jobPath(jobRef)}/bfd/recommend`,
          body: { answers },
        }),
    }),

    getBom: builder.query<GetBomResponse, string>({
      queryFn: (jobRef) => surveyorRequest<GetBomResponse>({ method: 'GET', path: `${jobPath(jobRef)}/bom` }),
      providesTags: (_r, _e, jobRef) => [{ type: 'Runbook', id: jobRef }],
    }),

    // Sign-off then submit. A failed sign-off never reaches submit.
    submitSurvey: builder.mutation<SubmitSurveyResponse, SubmitSurveyRequest>({
      queryFn: async ({ jobRef, clientRequestId, signoff }) => {
        const signed = await surveyorRequest<unknown>({
          method: 'POST',
          path: `${jobPath(jobRef)}/signoff`,
          body: { clientRequestId, ...signoff },
        });
        if ('error' in signed) return signed;
        return surveyorRequest<SubmitSurveyResponse>({
          method: 'POST',
          path: `${jobPath(jobRef)}/submit`,
          body: { clientRequestId },
        });
      },
      invalidatesTags: (_r, _e, { jobRef }) => ['SurveyorJobs', { type: 'SurveyorJob', id: jobRef }],
    }),

    getRunbookConfig: builder.query<RunbookConfig, void>({
      queryFn: () => surveyorRequest<RunbookConfig>({ method: 'GET', path: '/config/runbook' }),
    }),

    startSurvey: builder.mutation<StartSurveyDto, { jobRef: string; userId?: string }>({
      async queryFn({ jobRef, userId }, { dispatch }) {
        const jobId = await resolveJobId(jobRef);
        const numericId = Number(jobId);
        if (!/^\d+$/.test(jobId) || !Number.isSafeInteger(numericId) || numericId <= 0) {
          return { error: { status: 422, message: 'A valid numeric job ID is required to start the survey.' } };
        }
        return apiRequest<StartSurveyDto>(`/api/jobs/${jobId}/survey-start`, dispatch, {
          method: 'POST',
          body: numericId,
        }, userId);
      },
      invalidatesTags: (_r, _e, { jobRef }) => ['SurveyorJobs', { type: 'SurveyorJob', id: jobRef }],
    }),

    getRunbook: builder.query<Runbook, string>({
      queryFn: (jobRef) => surveyorRequest<Runbook>({ method: 'GET', path: `${jobPath(jobRef)}/runbook` }),
      providesTags: (_r, _e, jobRef) => [{ type: 'Runbook', id: jobRef }],
    }),

    // Section saves are autosave drafts: no refetch, the UI already holds the latest data.
    saveRunbookSection: builder.mutation<SaveSectionResponse, SaveSectionRequest>({
      queryFn: ({ jobRef, key, ...body }) =>
        surveyorRequest<SaveSectionResponse>({
          method: 'PUT',
          path: `${jobPath(jobRef)}/runbook/sections/${key}`,
          body: { key, ...body },
        }),
    }),

    confirmRunbookSection: builder.mutation<ConfirmSectionResponse, ConfirmSectionRequest>({
      queryFn: ({ jobRef, key, ...body }) =>
        surveyorRequest<ConfirmSectionResponse>({
          method: 'POST',
          path: `${jobPath(jobRef)}/runbook/sections/${key}/confirm`,
          body: { key, ...body },
        }),
      invalidatesTags: (_r, _e, { jobRef }) => [{ type: 'Runbook', id: jobRef }],
    }),

    uploadMedia: builder.mutation<UploadMediaResponse, UploadMediaRequest>({
      queryFn: ({ jobRef, meta, file }) =>
        surveyorRequest<UploadMediaResponse>({
          method: 'POST',
          path: `${jobPath(jobRef)}/media`,
          multipart: { fileField: 'file', file, jsonField: 'meta', json: meta },
        }),
    }),

    saveMediaMarkup: builder.mutation<SaveMarkupResponse, SaveMarkupRequest>({
      queryFn: ({ jobRef, mediaId, markedFile, markup, clientRequestId }) =>
        surveyorRequest<SaveMarkupResponse>({
          method: 'PUT',
          path: `${jobPath(jobRef)}/media/${encodeURIComponent(mediaId)}/markup`,
          multipart: {
            fileField: 'markedFile',
            file: markedFile,
            jsonField: 'markup',
            json: { clientRequestId, ...markup },
          },
        }),
    }),
  }),
});

export const {
  useGetBackendSurveyQuery,
  useSaveBackendSurveyAnswersMutation,
  useSubmitBackendSurveyMutation,
  useGetSurveyorJobsQuery,
  useGetSurveyorJobQuery,
  useConfirmSiteLocationMutation,
  useGetSiteInfoQuery,
  useSaveSiteInfoMutation,
  useRecommendBfdMutation,
  useGetBomQuery,
  useSubmitSurveyMutation,
  useGetRunbookConfigQuery,
  useStartSurveyMutation,
  useGetRunbookQuery,
  useSaveRunbookSectionMutation,
  useConfirmRunbookSectionMutation,
  useUploadMediaMutation,
  useSaveMediaMarkupMutation,
} = surveyorApi;
