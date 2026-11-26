// Single switch between the mock backend and the real Surveyor API.
//   VITE_USE_MOCK_SURVEYOR_API=true  (default while the backend is unbuilt) -> src/mocks/surveyor
//   VITE_USE_MOCK_SURVEYOR_API=false                                         -> /api/surveyor/* over HTTP
// Only src/api/surveyorApi.ts may import this module; components use the RTK Query hooks.

import type { ApiErrorShape } from '@/types/api';
import { authRepo } from '@/data/repos/authRepo';

export type TransportResult<T> = { data: T } | { error: ApiErrorShape };

export interface TransportRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path below /api/surveyor, e.g. `/jobs/MDU-000001/runbook`. */
  path: string;
  body?: unknown;
  /** Multipart upload: one binary part plus a JSON part. */
  multipart?: { fileField: string; file: Blob; jsonField: string; json: unknown };
}

export const USE_MOCK_SURVEYOR_API: boolean = import.meta.env.VITE_USE_MOCK_SURVEYOR_API !== 'false';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';
const SURVEYOR_PREFIX = '/api/surveyor';

async function httpRequest(req: TransportRequest): Promise<TransportResult<unknown>> {
  const session = await authRepo.get();
  const headers: Record<string, string> = {};
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  let body: BodyInit | undefined;
  if (req.multipart) {
    const form = new FormData();
    form.append(req.multipart.fileField, req.multipart.file);
    form.append(req.multipart.jsonField, JSON.stringify(req.multipart.json));
    body = form;
  } else if (req.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(req.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${SURVEYOR_PREFIX}${req.path}`, { method: req.method, headers, body });
  } catch {
    return { error: { status: 0, message: 'Unable to connect to the server. Please try again in a few moments.' } };
  }

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const fields = (payload ?? {}) as Record<string, unknown>;
    const message = [fields.message, fields.detail, fields.title].find(
      (value): value is string => typeof value === 'string' && value.trim() !== '',
    );
    return { error: { status: res.status, message: message ?? 'Request failed. Please try again.' } };
  }
  return { data: payload };
}

export async function surveyorRequest<T>(req: TransportRequest): Promise<TransportResult<T>> {
  if (USE_MOCK_SURVEYOR_API) {
    // Dynamic import keeps the mock fixtures out of the main chunk when the flag is off.
    const { handleMockRequest } = await import('@/mocks/surveyor/handlers');
    return (await handleMockRequest(req)) as TransportResult<T>;
  }
  return (await httpRequest(req)) as TransportResult<T>;
}
