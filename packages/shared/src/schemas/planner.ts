import { z } from 'zod';
import { idSchema, isoDateTimeSchema, shortText } from './common.js';

const MAX_SLOT_HOURS = 12;

/** A block of time a student reserves to work on a task (or anything else). */
const slotFields = {
  taskId: idSchema.nullable().default(null),
  title: shortText(140),
  start: isoDateTimeSchema,
  end: isoDateTimeSchema,
};

const validSlot = <T extends { start: string; end: string }>(slot: T) => {
  const duration = new Date(slot.end).getTime() - new Date(slot.start).getTime();
  return duration > 0 && duration <= MAX_SLOT_HOURS * 3_600_000;
};
const slotError = {
  error: `A study slot must end after it starts and last at most ${MAX_SLOT_HOURS} hours`,
  path: ['end'],
};

export const studySlotSchema = z
  .object({ id: idSchema, ...slotFields, createdAt: isoDateTimeSchema })
  .refine(validSlot, slotError);
export type StudySlot = z.infer<typeof studySlotSchema>;

export const createStudySlotInputSchema = z.object(slotFields).refine(validSlot, slotError);
export type CreateStudySlotInput = z.infer<typeof createStudySlotInputSchema>;
