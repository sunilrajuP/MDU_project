---
name: rtk-query-api
description: Use when adding or calling any API endpoint. All HTTP goes through RTK Query; offline writes go through the Dexie outbox.
---

# RTK Query API layer

## Structure
```
src/api/
  baseApi.ts        // createApi + baseQuery (auth header, base URL, retry)
  jobsApi.ts        // injectEndpoints
  syncApi.ts        // upload batches, media
  referenceApi.ts   // checklist/standard config if server-driven
```

## Rules
- No `fetch`/`axios` outside `src/api/` (ESLint enforced).
- Tag types: `Job`, `Survey`, `Media`, `Config`. Queries `providesTags`, mutations `invalidatesTags`.
- `refetchOnReconnect: true`, `refetchOnFocus` only for dashboards.
- **Write-through:** in `onQueryStarted`, persist results with repositories, then let hydration/slice update state:
  ```ts
  getMyJobs: build.query<Job[], void>({
    query: () => '/jobs/mine',
    async onQueryStarted(_, { queryFulfilled }) {
      const { data } = await queryFulfilled;
      await jobsRepo.bulkUpsertFromServer(data);
      await hydrateJobs(store);
    },
  })
  ```
- **Offline-first reads:** UI selectors read the Dexie-backed slice; RTK Query only refreshes.
- **Offline writes:** UI dispatches a thunk → repo write + outbox enqueue. The sync worker calls `syncApi.endpoints.pushBatch.initiate(...)` when online. Don't surface a raw mutation hook in a screen that can be offline.
- Treat 4xx (validation) as permanent failures (flag in outbox); 5xx/network as retryable with backoff.
- Types for requests/responses in `src/types/api.ts`; API DTOs are mapped to domain types in `baseApi.ts`.
