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

// Backend site-information DTO (GET/PUT /api/jobs/{jobId}/site-information).
interface SiteInformationDto {
  parkingAvailable?: boolean | null;
  accessWindow?: string | null;
  entryAccessInstructions?: string | null;
  accessRequirements?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
}

const PARKING_OPTIONS = ['Yes', 'No'];

// Surveyor screens address jobs by jobRef; the backend wants the numeric job id (Job.id in the local store).
async function resolveJobId(jobRef: string): Promise<string> {
  const jobs = await jobsRepo.getAll();
  return encodeURIComponent(jobs.find((job) => job.jobRef === jobRef)?.id ?? jobRef);
}

function fromSiteInformationDto(dto: SiteInformationDto): SiteInfo {
  return {
    stakeholder: {
      role: { value: '' }, // not provided by the backend
      name: { value: dto.contactName ?? '' },
      phone: { value: dto.phone ?? '' },
      email: { value: dto.contactEmail ?? '' },
    },
    access: {
      parking: dto.parkingAvailable ? 'Yes' : 'No',
      accessWindow: dto.accessWindow ?? '',
      entryInstructions: { value: dto.entryAccessInstructions ?? '' },
      accessRequirements: dto.accessRequirements ?? '',
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
    phone: info.stakeholder.phone.value,
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

const jobPath = (jobRef: string) => `/jobs/${encodeURIComponent(jobRef)}`;

export const surveyorApi = createApi({
  reducerPath: 'surveyorApi',
  baseQuery: fakeBaseQuery<ApiErrorShape>(),
  tagTypes: ['SurveyorJobs', 'SurveyorJob', 'Runbook', 'SiteInfo'],
  endpoints: (builder) => ({
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
            jobs: res.data.jobs.map(toSurveyorJobSummary),
          },
        };
      },
      providesTags: ['SurveyorJobs'],
    }),

    getSurveyorJob: builder.query<SurveyorJobDetail, string>({
      queryFn: (jobRef) => surveyorRequest<SurveyorJobDetail>({ method: 'GET', path: jobPath(jobRef) }),
      providesTags: (_r, _e, jobRef) => [{ type: 'SurveyorJob', id: jobRef }],
    }),

    confirmSiteLocation: builder.mutation<ConfirmSiteLocationResponse, ConfirmSiteLocationRequest>({
      queryFn: ({ jobRef, ...body }) =>
        surveyorRequest<ConfirmSiteLocationResponse>({
          method: 'POST',
          path: `${jobPath(jobRef)}/site-location/confirm`,
          body,
        }),
      invalidatesTags: (_r, _e, { jobRef }) => [{ type: 'SurveyorJob', id: jobRef }],
    }),

    getSiteInfo: builder.query<GetSiteInfoResponse, string>({
      // Real backend: GET /api/jobs/{jobId}/site-information (flat DTO mapped to the UI shape).
      async queryFn(jobRef, { dispatch }) {
        const res = await apiRequest<SiteInformationDto>(
          `/api/jobs/${await resolveJobId(jobRef)}/site-information`,
          dispatch,
        );
        if ('error' in res) return res;
        return { data: { siteInfo: fromSiteInformationDto(res.data), options: { parking: PARKING_OPTIONS } } };
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

    startSurvey: builder.mutation<Runbook, { jobRef: string }>({
      queryFn: ({ jobRef }) =>
        surveyorRequest<Runbook>({
          method: 'POST',
          path: `${jobPath(jobRef)}/survey/start`,
          body: { clientRequestId: crypto.randomUUID() },
        }),
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
