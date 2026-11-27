export interface SurveyAnswer {
  itemId: number;
  value: string;
  isFlagged: boolean;
  note: string;
  floorId?: string;
}

export interface SurveyCardAnswers {
  sectionId: number;
  answers: SurveyAnswer[];
}

export interface SurveyItem {
  id: number;
  sectionId: number;
  code: string;
  prompt: string;
  answerType: string;
  isRequired: boolean;
  minPhotos: number;
  flagOn: string | null;
  sortOrder: number;
  responseValue: string | null;
  isAnswered: boolean;
  isFlagged: boolean;
  note: string | null;
}

export interface SurveySection {
  id: number;
  code: string;
  title: string;
  sortOrder: number;
  repeatPerFloor: boolean;
  isCompleted: boolean;
  items: SurveyItem[];
}

export interface BackendSurvey {
  jobId: number;
  jobRef: string;
  sessionId: string;
  status: string;
  sections: SurveySection[];
}

export function parseBackendSurvey(value: unknown): BackendSurvey | undefined {
  let normalized = value;
  if (value !== null && typeof value === 'object' && 'sessionId' in value &&
      typeof value.sessionId === 'number' && Number.isSafeInteger(value.sessionId) && value.sessionId >= 0) {
    normalized = { ...value, sessionId: String(value.sessionId) };
  }
  return isBackendSurvey(normalized) ? normalized : undefined;
}

export function isBackendSurvey(value: unknown): value is BackendSurvey {
  if (!value || typeof value !== 'object') return false;
  const survey = value as Record<string, unknown>;
  if (!Number.isInteger(survey.jobId) || typeof survey.jobRef !== 'string' ||
      typeof survey.sessionId !== 'string' || !survey.sessionId ||
      typeof survey.status !== 'string' || !Array.isArray(survey.sections)) return false;
  return survey.sections.every((section: unknown) => {
    if (!section || typeof section !== 'object') return false;
    const s = section as Record<string, unknown>;
    if (!Number.isInteger(s.id) || typeof s.code !== 'string' || typeof s.title !== 'string' ||
        typeof s.sortOrder !== 'number' || typeof s.repeatPerFloor !== 'boolean' ||
        typeof s.isCompleted !== 'boolean' || !Array.isArray(s.items)) return false;
    return s.items.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const i = item as Record<string, unknown>;
      return Number.isInteger(i.id) && i.sectionId === s.id && typeof i.code === 'string' &&
        typeof i.prompt === 'string' && typeof i.answerType === 'string' &&
        typeof i.isRequired === 'boolean' && typeof i.minPhotos === 'number' &&
        (i.flagOn === null || typeof i.flagOn === 'string') && typeof i.sortOrder === 'number' &&
        (i.responseValue === null || typeof i.responseValue === 'string') &&
        typeof i.isAnswered === 'boolean' && typeof i.isFlagged === 'boolean' &&
        (i.note === null || typeof i.note === 'string');
    });
  });
}
