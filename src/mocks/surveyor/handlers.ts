// Mock request router. Mirrors docs/surveyor-api-contract.md so swapping to the real API changes no UI code.

import type { ApiErrorShape } from '@/types/api';
import type {
  ConfirmSectionRequest,
  ConfirmSectionResponse,
  ConfirmSiteLocationRequest,
  ConfirmSiteLocationResponse,
  GetBomResponse,
  GetSiteInfoResponse,
  RecommendBfdRequest,
  SubmitSurveyRequest,
  SubmitSurveyResponse,
  SaveMarkupResponse,
  SaveSectionRequest,
  SaveSectionResponse,
  SaveSiteInfoRequest,
  SaveSiteInfoResponse,
  SectionKey,
  SiteInfo,
  UploadMediaMeta,
  UploadMediaResponse,
} from '@/types/surveyor';
import type { TransportRequest, TransportResult } from '@/api/surveyorTransport';
import { MOCK_RUNBOOK_CONFIG } from './runbookConfig';
import {
  MOCK_SITE_INFO_OPTIONS,
  confirmedLocationRefs,
  mockJobDetail,
  mockJobsResponse,
  startedJobRefs,
  submittedJobRefs,
} from './jobs';
import { getOrCreateRunbook, getOrCreateSiteInfo, remember, setSiteInfo } from './db';
import { MOCK_BOM_ROWS, recommendBfd } from './bfd';

const notFound = (what: string): { error: ApiErrorShape } => ({ error: { status: 404, message: `${what} not found.` } });

type Handler = (match: RegExpMatchArray, req: TransportRequest, query: URLSearchParams) => TransportResult<unknown>;

interface Route {
  method: TransportRequest['method'];
  pattern: RegExp;
  handle: Handler;
}

const SEG = '([^/]+)';
const route = (method: Route['method'], pattern: string, handle: Handler): Route => ({
  method,
  pattern: new RegExp(`^${pattern}$`),
  handle,
});

const routes: Route[] = [
  route('GET', '/jobs', (_m, _r, query) => ({ data: mockJobsResponse(query.get('status')) })),
  route('GET', `/jobs/${SEG}`, ([, jobRef]) => {
    const job = mockJobDetail(decodeURIComponent(jobRef));
    return job ? { data: job } : notFound('Job');
  }),
  route('GET', '/config/runbook', () => ({ data: MOCK_RUNBOOK_CONFIG })),
  route('POST', `/jobs/${SEG}/survey/start`, ([, jobRef]) => {
    const ref = decodeURIComponent(jobRef);
    const runbook = getOrCreateRunbook(ref);
    if (runbook) startedJobRefs.add(ref);
    return runbook ? { data: runbook } : notFound('Job');
  }),
  route('POST', `/jobs/${SEG}/site-location/confirm`, ([, jobRef], req) => {
    const ref = decodeURIComponent(jobRef);
    const body = req.body as ConfirmSiteLocationRequest | undefined;
    if (!mockJobDetail(ref) || !body) return notFound('Job');
    const response = remember<ConfirmSiteLocationResponse>(body.clientRequestId, () => {
      confirmedLocationRefs.add(ref);
      return { confirmed: true, confirmedAt: new Date().toISOString() };
    });
    return { data: response };
  }),
  route('GET', `/jobs/${SEG}/site-info`, ([, jobRef]) => {
    const siteInfo = getOrCreateSiteInfo(decodeURIComponent(jobRef));
    const response: GetSiteInfoResponse = { siteInfo: siteInfo as SiteInfo, options: MOCK_SITE_INFO_OPTIONS };
    return siteInfo ? { data: response } : notFound('Job');
  }),
  route('PUT', `/jobs/${SEG}/site-info`, ([, jobRef], req) => {
    const ref = decodeURIComponent(jobRef);
    const current = getOrCreateSiteInfo(ref);
    const body = req.body as SaveSiteInfoRequest | undefined;
    if (!current || !body) return notFound('Job');
    const response = remember<SaveSiteInfoResponse>(body.clientRequestId, () => {
      setSiteInfo(ref, { ...body.siteInfo, rev: current.rev + 1 });
      return { rev: current.rev + 1, savedAt: new Date().toISOString() };
    });
    return { data: response };
  }),
  route('GET', `/jobs/${SEG}/runbook`, ([, jobRef]) => {
    const runbook = getOrCreateRunbook(decodeURIComponent(jobRef));
    return runbook ? { data: runbook } : notFound('Runbook');
  }),
  route('PUT', `/jobs/${SEG}/runbook/sections/${SEG}`, ([, jobRef, key], req) => {
    const runbook = getOrCreateRunbook(decodeURIComponent(jobRef));
    const body = req.body as SaveSectionRequest | undefined;
    const section = runbook?.sections.find((entry) => entry.key === (key as SectionKey));
    if (!runbook || !section || !body) return notFound('Section');
    const response = remember<SaveSectionResponse>(body.clientRequestId, () => {
      section.data = body.data;
      section.rev += 1;
      runbook.rev += 1;
      return { key: section.key, rev: section.rev, savedAt: new Date().toISOString() };
    });
    return { data: response };
  }),
  route('POST', `/jobs/${SEG}/runbook/sections/${SEG}/confirm`, ([, jobRef, key], req) => {
    const runbook = getOrCreateRunbook(decodeURIComponent(jobRef));
    const body = req.body as ConfirmSectionRequest | undefined;
    const section = runbook?.sections.find((entry) => entry.key === (key as SectionKey));
    if (!runbook || !section || !body) return notFound('Section');
    const response = remember<ConfirmSectionResponse>(body.clientRequestId, () => {
      const completedAt = new Date().toISOString();
      section.completed = true;
      section.completedAt = completedAt;
      return { key: section.key, completed: true, completedAt };
    });
    return { data: response };
  }),
  route('POST', `/jobs/${SEG}/bfd/recommend`, (_m, req) => {
    const body = req.body as RecommendBfdRequest | undefined;
    if (!body) return { error: { status: 400, message: 'Answers are required.' } };
    return { data: recommendBfd(body.answers) };
  }),
  route('GET', `/jobs/${SEG}/bom`, ([, jobRef]) => {
    if (!mockJobDetail(decodeURIComponent(jobRef))) return notFound('Job');
    const response: GetBomResponse = { stale: true, rows: MOCK_BOM_ROWS };
    return { data: response };
  }),
  route('POST', `/jobs/${SEG}/signoff`, ([, jobRef]) =>
    mockJobDetail(decodeURIComponent(jobRef)) ? { data: { signedOff: true } } : notFound('Job'),
  ),
  route('POST', `/jobs/${SEG}/submit`, ([, jobRef], req) => {
    const ref = decodeURIComponent(jobRef);
    const body = req.body as SubmitSurveyRequest | undefined;
    if (!mockJobDetail(ref) || !body) return notFound('Job');
    const response = remember<SubmitSurveyResponse>(body.clientRequestId, () => {
      submittedJobRefs.add(ref);
      return { jobRef: ref, status: 'submitted', submittedAt: new Date().toISOString() };
    });
    return { data: response };
  }),
  route('POST', `/jobs/${SEG}/media`, (_m, req) => {
    const meta = req.multipart?.json as UploadMediaMeta | undefined;
    if (!meta) return { error: { status: 400, message: 'Media metadata is required.' } };
    const response = remember<UploadMediaResponse>(meta.clientMediaId, () => ({
      mediaId: meta.clientMediaId,
      clientMediaId: meta.clientMediaId,
      kind: meta.kind,
      status: 'uploaded',
      originalUrl: `mock://media/${meta.clientMediaId}/original`,
      thumbUrl: `mock://media/${meta.clientMediaId}/thumb`,
    }));
    return { data: response };
  }),
  route('PUT', `/jobs/${SEG}/media/${SEG}/markup`, ([, , mediaId]) => {
    const id = decodeURIComponent(mediaId);
    const response: SaveMarkupResponse = { mediaId: id, markedUrl: `mock://media/${id}/marked`, markupRev: 1 };
    return { data: response };
  }),
];

export async function handleMockRequest(req: TransportRequest): Promise<TransportResult<unknown>> {
  const [path, queryString = ''] = req.path.split('?');
  const query = new URLSearchParams(queryString);
  for (const entry of routes) {
    if (entry.method !== req.method) continue;
    const match = path.match(entry.pattern);
    if (match) {
      const result = entry.handle(match, req, query);
      // RTK Query freezes what it caches; hand out copies so in-memory mock state stays mutable.
      return 'data' in result ? { data: structuredClone(result.data) } : result;
    }
  }
  return { error: { status: 404, message: `No mock handler for ${req.method} ${path}.` } };
}
