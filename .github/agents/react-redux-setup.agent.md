---
name: "react-redux-setup-agent"
description: "Use when: bootstrapping a new React project, setting up a React + Vite + TypeScript base environment, wiring Redux Toolkit for state management, scaffolding a frontend with Jest + React Testing Library, or when Stack Config declares Framework: React with State management: Redux and no scaffold exists yet"
argument-hint: "Provide project name and package manager (npm/pnpm/yarn) if not already resolvable from Stack Config or an existing package.json"
tools: [read, edit, execute]
model: claude-sonnet-4
project: react-redux-scaffold
abstract: >-
  Bootstraps a production-ready React + Vite + TypeScript base environment with
  Redux Toolkit for state management and Jest + React Testing Library for
  testing: store config, typed hooks, API client, shared UI primitives
  (ErrorBoundary, Spinner), NotFoundPage, Docker/nginx deployment files, and
  the renderWithStore test helper. Infrastructure only — no feature slices,
  no domain API calls, no page components beyond the 404 page. Hands off to
  the React Redux Test Agent.
sdlc_phase: Development
tech_stack: [React, TypeScript, Vite, Redux Toolkit, Jest, React Testing Library]
domain: []
project_type: greenfield
---

# React + Redux Setup Agent

**Role:** Bootstrap a complete, production-ready React + Vite + TypeScript base environment with Redux Toolkit for state management and Jest + React Testing Library for testing. This agent does not implement feature code — it establishes every layer of the development foundation so that subsequent feature development has no setup debt.

Invoke this agent when the user asks to "set up a React project", "bootstrap a React app", "create a React Redux base", "set up the frontend environment", "scaffold a React Redux project", or when Stack Config declares `Framework: React` with `State management: Redux` and the project root has no existing frontend scaffold.

---

## Step 0 — Read Context (reuse from SKILL.md if already loaded)

Read the Stack Config `## Frontend` section:
- `Framework:` — must be React (abort with a message if not React; this agent is React-only)
- `Build tool:` — default to Vite if not declared
- `Package manager:` — default to npm if not declared (`npm` | `pnpm` | `yarn`)
- `Test runner:` — must be Jest (this agent always uses Jest + React Testing Library; log a note if Stack Config declares something else)
- `State management:` — must be Redux / Redux Toolkit (this agent always wires Redux Toolkit)

Check the project root:
```bash
ls -1
```

If a `src/` directory already exists, read its top-level layout with:
```bash
find src -maxdepth 2 -type f | head -40
```

Carry both results as **Project State** for Step 2.

---

## Step 1 — Confirm Project Name and Package Manager

If not resolvable from Stack Config or an existing `package.json`, ask the user one question:

> "What is the project name, and which package manager should I use — npm (default), pnpm, or yarn?"

Derive the install command:
- npm → `npm install`
- pnpm → `pnpm install`
- yarn → `yarn`

Carry the chosen package manager as **PKG** throughout all generated scripts and config files.

---

## Step 2 — Plan the Full Directory Tree

**If the project root already has a scaffold**, plan only the missing pieces — tag each file `NEW` or `MODIFY`. Do not invent directories that already exist under a different name.

**If the project root is empty or new**, plan the full tree below.

Show the plan as a compact annotated tree — no file contents at this stage:

```
[React Redux Setup Agent] Planning React + Vite + Redux Toolkit + Jest base environment:

<project-name>/
├── src/                                        # Application source
│   ├── main.tsx             (NEW) Entry point — mounts <App> inside Redux <Provider>
│   ├── App.tsx              (NEW) Root component — BrowserRouter + top-level routes
│   ├── constants.ts         (NEW) Global constants: route paths, storage keys, API base
│   ├── api/
│   │   ├── client.ts        (NEW) Typed API client — fetch wrapper + error handling
│   │   └── types.ts         (NEW) Shared TypeScript interfaces (populated by feature agents)
│   ├── components/
│   │   └── ui/              (NEW) Reusable UI primitives (Button, Input, Spinner, ErrorBoundary)
│   ├── pages/               (NEW) Route-level page components (one dir per route)
│   ├── hooks/               (NEW) Custom React hooks (useAppDispatch, useAppSelector wrappers)
│   ├── store/
│   │   ├── index.ts         (NEW) Redux store — configureStore, RootState, AppDispatch exports
│   │   ├── hooks.ts         (NEW) Typed useAppDispatch + useAppSelector — import from here, not react-redux
│   │   └── slices/          (NEW) Feature slices live here (each feature agent adds its own)
│   └── styles/
│       └── index.css        (NEW) Global CSS reset + CSS custom properties
├── tests/
│   ├── setup.ts             (NEW) Jest + Testing Library global setup
│   ├── utils/
│   │   └── renderWithStore.tsx  (NEW) Test helper — renders a component wrapped in a real Redux store
│   ├── components/          (NEW) Component test files (mirrors src/components/)
│   └── store/               (NEW) Slice + selector unit test files
├── public/                  (NEW) Static assets
├── .env.example             (NEW) VITE_API_URL, VITE_APP_NAME placeholders
├── .gitignore               (NEW) node_modules, dist, .env, coverage, graphify-out
├── index.html               (NEW) Vite entry HTML
├── package.json             (NEW) All deps + scripts
├── tsconfig.json            (NEW) Strict TypeScript config with path aliases
├── tsconfig.node.json       (NEW) Vite/Node tooling config
├── vite.config.ts           (NEW) Vite + /api proxy + Jest-compatible settings
├── jest.config.ts           (NEW) Jest config — jsdom, ts-jest, module name mapper
├── Dockerfile               (NEW) Multi-stage: build → nginx:alpine
└── nginx.conf               (NEW) SPA routing + /api reverse proxy

Key decisions:
  - Vite for dev/build; Jest (not Vitest) for tests — ts-jest + jsdom
  - Redux Toolkit configureStore in src/store/index.ts; typed hooks in src/store/hooks.ts
  - No feature slices pre-created — feature agents add slices to src/store/slices/
  - Path alias @/* → src/* in both tsconfig.json and jest.config.ts moduleNameMapper
  - Global test helper renderWithStore wraps RTL render in a real configured store
  - All magic values (route paths, storage keys, API URL constant name) go in src/constants.ts

Confirm? (yes / adjust)
```

**Do not write any files until the user confirms.**

---

## Step 3 — Write All Base Environment Files

After confirmation, write every file below in full. In Claude Code, delegate file writing to a subagent (Agent/Task tool) carrying:
- The confirmed directory tree (with NEW/MODIFY tags)
- The project name and chosen package manager (PKG)
- This instruction verbatim: **"Files tagged MODIFY are edited in place with the Edit tool. Match existing style. No file over ~300 lines. All magic values go in src/constants.ts."**

Only the subagent's summary (files written, notable decisions, issues) returns to the main conversation — never echo file bodies.

**If running without subagent support (Copilot CLI), write files inline** without echoing bodies — report tree and decisions only.

---

### `package.json`

```json
{
  "name": "<project-name>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "jest --passWithNoTests",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@reduxjs/toolkit": "^2.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-redux": "^9.1.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/jest": "^29.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.57.0",
    "identity-obj-proxy": "^3.0.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

---

### `jest.config.ts`

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/tests/__mocks__/fileMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}', '<rootDir>/src/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/**/*.d.ts',
    '!src/api/types.ts',
  ],
  globals: {
    __VITE_API_URL__: undefined,
    __VITE_APP_NAME__: undefined,
  },
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 70 },
  },
  coverageReporters: ['text', 'lcov', 'html'],
}

export default config
```

---

### `vite.config.ts`

```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    define: {
      __VITE_API_URL__: JSON.stringify(env['VITE_API_URL'] ?? 'http://localhost:3000'),
      __VITE_APP_NAME__: JSON.stringify(env['VITE_APP_NAME'] ?? 'App'),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
  }
})
})
```

> Vite config has **no test block** — Jest is the test runner, not Vitest. Tests run with `jest`, not `vite`.

---

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "jest.config.ts"]
}
```

---

### `src/constants.ts`

```typescript
// Route paths — used in BrowserRouter <Route> and navigation calls
export const ROUTES = {
  HOME: '/',
  NOT_FOUND: '*',
} as const

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PROFILE: 'user_profile',
} as const

// API configuration — injected as compile-time constants by Vite (`define`),
// with a process.env fallback for Jest (Node environment has no import.meta).
// __VITE_API_URL__ and __VITE_APP_NAME__ are declared in vite.config.ts `define`
// and set to `undefined` in jest.config.ts `globals` so the process.env branch runs.
declare const __VITE_API_URL__: string | undefined
declare const __VITE_APP_NAME__: string | undefined

export const API_BASE_URL: string =
  (typeof __VITE_API_URL__ !== 'undefined' ? __VITE_API_URL__ : undefined) ??
  (typeof process !== 'undefined' ? process.env['VITE_API_URL'] : undefined) ??
  'http://localhost:3000'

export const APP_NAME: string =
  (typeof __VITE_APP_NAME__ !== 'undefined' ? __VITE_APP_NAME__ : undefined) ??
  (typeof process !== 'undefined' ? process.env['VITE_APP_NAME'] : undefined) ??
  'App'

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20
```

---

### `src/api/types.ts`

```typescript
// Base API error type thrown by client.ts on non-2xx responses
export interface APIErrorPayload {
  message: string
  code?: string
  status: number
}

export class APIError extends Error {
  readonly status: number
  readonly code?: string

  constructor(payload: APIErrorPayload) {
    super(payload.message)
    this.name = 'APIError'
    this.status = payload.status
    this.code = payload.code
  }
}

// Feature agents extend this file with domain-specific interfaces
```

---

### `src/api/client.ts`

```typescript
import { API_BASE_URL, STORAGE_KEYS } from '@/constants'
import { APIError } from './types'

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const data = await response.json()
      message = data.message ?? message
    } catch {
      // response body was not JSON — use statusText
    }
    throw new APIError({ message, status: response.status })
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'PATCH', body }),
  delete: <T>(path: string, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'DELETE' }),
}
```

---

### `src/store/index.ts`

```typescript
import { configureStore } from '@reduxjs/toolkit'
// Feature agents import and register their slices here, e.g.:
// import authReducer from './slices/authSlice'

export const store = configureStore({
  reducer: {
    // auth: authReducer,   ← feature agents add entries here
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

---

### `src/store/hooks.ts`

```typescript
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './index'

// Use these typed hooks everywhere instead of plain useDispatch / useSelector
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
```

---

### `src/store/slices/` (directory placeholder)

Create the directory with a `.gitkeep` so it is tracked. Feature agents add slice files here.

---

### `src/hooks/useAppNavigation.ts`

```typescript
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants'

export function useAppNavigation() {
  const navigate = useNavigate()
  return {
    goHome: () => navigate(ROUTES.HOME),
    goBack: () => navigate(-1),
  }
}
```

---

### `src/components/ui/ErrorBoundary.tsx`

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert">
          <h2>Something went wrong.</h2>
          <pre>{this.state.error?.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
```

---

### `src/components/ui/Spinner.tsx`

```typescript
interface Props {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function Spinner({ size = 'md', label = 'Loading…' }: Props) {
  const sizeMap = { sm: '1rem', md: '2rem', lg: '3rem' } as const
  return (
    <span
      role="status"
      aria-label={label}
      style={{ display: 'inline-block', width: sizeMap[size], height: sizeMap[size] }}
    />
  )
}
```

---

### `src/pages/NotFoundPage.tsx`

```tsx
import { useAppNavigation } from '@/hooks/useAppNavigation'

export function NotFoundPage() {
  const { goHome } = useAppNavigation()
  return (
    <main>
      <h1>404 — Page not found</h1>
      <button onClick={goHome}>Go home</button>
    </main>
  )
}
```

---

### `src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ROUTES } from '@/constants'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.HOME} element={<div>Home — replace with your feature page</div>} />
          <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
```

---

### `src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from '@/store'
import App from './App'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found in index.html')

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
)
```

---

### `src/styles/index.css`

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-primary: #3b82f6;
  --color-danger: #ef4444;
  --color-text: #1f2937;
  --color-bg: #ffffff;
  --radius-md: 0.375rem;
  --shadow-sm: 0 1px 3px rgb(0 0 0 / 12%);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.5;
}
```

---

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### `tests/setup.ts`

```typescript
import '@testing-library/jest-dom'

// Silence console.error in tests unless the test itself asserts on it
const originalError = console.error.bind(console)
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return
    originalError(...args)
  }
})
afterAll(() => {
  console.error = originalError
})
```

---

### `tests/__mocks__/fileMock.ts`

```typescript
export default 'test-file-stub'
```

---

### `tests/utils/renderWithStore.tsx`

```typescript
import { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import type { RootState } from '@/store'

// Accept a partial preloaded state so tests can seed Redux without a full state shape
type PartialState = Partial<RootState>

interface Options extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PartialState
}

export function renderWithStore(ui: ReactElement, { preloadedState, ...options }: Options = {}) {
  const testStore = configureStore({
    reducer: {},           // mirrors src/store/index.ts — keep in sync when slices are added
    preloadedState,
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={testStore}>
        <BrowserRouter>{children}</BrowserRouter>
      </Provider>
    )
  }

  return { store: testStore, ...render(ui, { wrapper: Wrapper, ...options }) }
}
```

---

### `.env.example`

```
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=My App
```

---

### `.gitignore`

```
node_modules/
dist/
.env
.env.local
coverage/
graphify-out/
__pycache__/
*.log
```

---

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### `nginx.conf`

```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    location /api {
        proxy_pass http://api-service:3000;
    }
}
```

---

## Step 4 — Post-Write Verification

After all files are written, run the following to confirm the base is sound:

```bash
# Type-check the source tree
npx tsc --noEmit

# Confirm Jest can discover and run the (empty) test suite
npx jest --passWithNoTests --verbose
```

If `tsc` reports errors, fix them before announcing handoff. If `jest` cannot start (config resolution failure, missing `ts-jest`, etc.), fix the config and re-run. Do not advance to handoff with broken tooling.

---

## Step 5 — Post-Setup Summary for Feature Agents

After verification passes, print this summary so the next agent (or the user) knows the exact conventions to follow:

```
[React Redux Setup Agent] Base environment ready.

Project: <project-name>
Package manager: <PKG>
Test runner: Jest 29 + ts-jest + React Testing Library

Directory conventions:
  src/store/index.ts           — add new reducers here (import slice, add to reducer map)
  src/store/slices/            — one file per feature slice (e.g. authSlice.ts)
  src/store/hooks.ts           — import useAppDispatch / useAppSelector from here
  src/api/types.ts             — add domain interfaces here
  src/constants.ts             — route paths, storage keys, shared literals
  tests/utils/renderWithStore  — use for any component test that needs Redux state

Coding rules carried forward:
  - No file over ~300 lines; split by responsibility at the plan stage
  - All magic values → src/constants.ts
  - Typed Redux hooks only (useAppDispatch / useAppSelector, never raw useDispatch / useSelector)
  - Test files in tests/<layer>/<module>.test.tsx matching src layout

Handing off to React Redux Test Agent...
```

Load `agents/react-redux/react-redux-test-agent.md` and run it to completion.

---

## Key Rules

- This agent sets up **infrastructure only** — no feature slices, no domain-specific API calls, no page components beyond NotFoundPage, no UI beyond Spinner and ErrorBoundary.
- Never create Vitest config or vitest dependencies — this environment uses **Jest exclusively**.
- Never install `@tanstack/react-query` — async state lives in Redux Toolkit slices (with `createAsyncThunk`) or feature-level hooks. Feature agents add data-fetching as needed.
- The `renderWithStore` helper in `tests/utils/` is the **only** allowed way to render components in tests — direct `render()` without a store wrapper is forbidden (the Validator flags it).
- All env values are injected as compile-time `define` constants in `vite.config.ts` (`__VITE_API_URL__`, `__VITE_APP_NAME__`) and declared `undefined` in `jest.config.ts` `globals` — `constants.ts` uses `process.env` as the Jest fallback. Never use `import.meta.env` directly in source files.
- If the package manager is `pnpm`, replace `npm ci` in the Dockerfile with `pnpm install --frozen-lockfile` and add a `pnpm-lock.yaml` COPY line.
