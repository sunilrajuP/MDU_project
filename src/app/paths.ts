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
  QC_ROOT: '/qc',
  DESIGNER_ROOT: '/designer',
} as const;
