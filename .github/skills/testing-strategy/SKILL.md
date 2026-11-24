---
name: testing-strategy
description: Use when writing or reviewing tests — unit, component, Dexie integration, offline e2e, a11y, and regression tests for the hard rules.
---

# Testing strategy

## Tooling
Vitest + React Testing Library + `fake-indexeddb` + MSW + Playwright (projects: `mobile-360`, `tablet-768`, `desktop-1280`) + `@axe-core/playwright`. Stylelint + ESLint run in CI as tests for H3/H4.

## Test utils
- `makeStore()` — fresh real store each test.
- `makeDb()` — new `fake-indexeddb` instance per test.
- Factories: `makeJob`, `makeSite`, `makeSession`, `makeItem`, `makePlan`.
- `runHydrationAndWait(store)`.

## Required patterns
**Rehydration round-trip (H1)**
```ts
it('restores jobs after reload', async () => {
  await jobsRepo.save(makeJob({ id: 'j1' }));
  const fresh = makeStore();
  await runHydrators(fresh, 'app');
  expect(selectJobById(fresh.getState(), 'j1')).toBeDefined();
});
```
**Schema guard (H2)** — see `dexie-schema-versioning`; also a fixture upgrade test.
**Offline e2e (H8)**
```ts
await context.setOffline(true);
await page.getByRole('button', { name: 'Take Photo' }).click(); /* … */
await page.reload();
await expect(page.getByTestId('photo-thumb')).toBeVisible();
```
**Original immutability (H5)**, **calibration persistence (H6)**, **runbook derivation (H7)**.

## Conventions
- Arrange with factories; assert on user-visible behaviour/roles; avoid brittle snapshots.
- Bug fix ⇒ failing test first.
- Don't mock Dexie in integration tests.
- Run `axe` per route at 360 and 768.
- Coverage guard: rules/validation/geometry/hydration ≥ 90 %; UI ≥ 70 %.
