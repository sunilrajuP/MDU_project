export const PATHS = {
  LOGIN: '/login',

  MANAGEMENT_DASHBOARD: '/dashboard',
  MANAGEMENT_CREATE_JOB: '/createJob',
  MANAGEMENT_JOB_DETAILS_ROUTE: '/dashboard/jobdetails/:jobRef',
  MANAGEMENT_JOB_DETAILS: (jobRef: string) => `/dashboard/jobdetails/${jobRef}`,
  MANAGEMENT_EDIT_JOB_ROUTE: '/dashboard/editjob/:jobRef',
  MANAGEMENT_EDIT_JOB: (jobRef: string) => `/dashboard/editjob/${jobRef}`,

  // Out of scope this task — stubbed only because routes/nav already reference them.
  SURVEYOR_ROOT: '/survey',

  // Surveyor app. SURVEYOR_ROOT is "My Jobs".
  SURVEYOR_ACCOUNT: '/survey/account',
  SURVEYOR_JOB_OVERVIEW_ROUTE: '/survey/jobs/:jobRef/overview',
  SURVEYOR_JOB_OVERVIEW: (jobRef: string) => `/survey/jobs/${encodeURIComponent(jobRef)}/overview`,
  SURVEYOR_JOB_MAP_ROUTE: '/survey/jobs/:jobRef/map',
  SURVEYOR_JOB_MAP: (jobRef: string) => `/survey/jobs/${encodeURIComponent(jobRef)}/map`,
  SURVEYOR_JOB_SITE_INFO_ROUTE: '/survey/jobs/:jobRef/site-info',
  SURVEYOR_JOB_SITE_INFO: (jobRef: string) => `/survey/jobs/${encodeURIComponent(jobRef)}/site-info`,
  SURVEYOR_JOB_RUNBOOK_ROUTE: '/survey/jobs/:jobRef/runbook',
  SURVEYOR_JOB_RUNBOOK: (jobRef: string) => `/survey/jobs/${encodeURIComponent(jobRef)}/runbook`,
  QC_ROOT: '/qc',
  DESIGNER_ROOT: '/designer',
} as const;
