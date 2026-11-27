import { getDb } from '../db/getDb';
import type { BackendSurveyRecord } from '../db/schema';
import type { BackendSurvey, SurveyAnswer } from '@/types/backendSurvey';

const recordId = (userId: string, jobRef: string) => JSON.stringify([userId, jobRef]);
const answerId = (sectionId: number, itemId: number) => `${sectionId}:${itemId}`;

export const backendSurveyRepo = {
  get(userId: string, jobRef: string): Promise<BackendSurveyRecord | undefined> {
    return getDb().backendSurveys.get(recordId(userId, jobRef));
  },

  async receive(userId: string, jobRef: string, survey: BackendSurvey): Promise<BackendSurveyRecord> {
    const db = getDb();
    return db.transaction('rw', db.backendSurveys, async () => {
      const id = recordId(userId, jobRef);
      const existing = await db.backendSurveys.get(id);
      if (existing && existing.survey.sessionId !== survey.sessionId && Object.keys(existing.pending).length) {
        throw new Error('The survey session changed while local answers are pending. They have been retained on this device.');
      }
      const record = { id, survey, pending: existing?.survey.sessionId === survey.sessionId ? existing.pending : {} };
      await db.backendSurveys.put(record);
      return record;
    });
  },

  async edit(userId: string, jobRef: string, sectionId: number, answer: SurveyAnswer): Promise<BackendSurveyRecord> {
    const db = getDb();
    return db.transaction('rw', db.backendSurveys, async () => {
      const record = await db.backendSurveys.get(recordId(userId, jobRef));
      if (!record) throw new Error('The survey is not saved on this device.');
      record.pending[answerId(sectionId, answer.itemId)] = answer;
      await db.backendSurveys.put(record);
      return record;
    });
  },

  async acknowledge(
    userId: string, jobRef: string, survey: BackendSurvey, sectionId: number, sent: SurveyAnswer[],
  ): Promise<BackendSurveyRecord> {
    const db = getDb();
    return db.transaction('rw', db.backendSurveys, async () => {
      const record = await db.backendSurveys.get(recordId(userId, jobRef));
      if (!record || record.survey.sessionId !== survey.sessionId) {
        throw new Error('The survey session changed while saving. Local answers have been retained.');
      }
      for (const answer of sent) {
        const key = answerId(sectionId, answer.itemId);
        if (JSON.stringify(record.pending[key]) === JSON.stringify(answer)) delete record.pending[key];
      }
      record.survey = survey;
      await db.backendSurveys.put(record);
      return record;
    });
  },
};

export function pendingAnswer(record: BackendSurveyRecord, sectionId: number, itemId: number): SurveyAnswer | undefined {
  return record.pending[answerId(sectionId, itemId)];
}
