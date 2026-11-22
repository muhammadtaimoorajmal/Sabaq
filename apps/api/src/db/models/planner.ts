import { model, Schema } from 'mongoose';
import {
  baseOptions,
  nullableRef,
  type ObjectId,
  requiredRef,
  type Timestamps,
} from '../schema-helpers.js';

export const MAX_SLOT_HOURS = 12;

/** A block of time a person reserves in their planner, optionally for one task. */
export interface StudySlotRecord extends Timestamps {
  userId: ObjectId;
  taskId: ObjectId | null;
  title: string;
  start: Date;
  end: Date;
}

const studySlotSchema = new Schema<StudySlotRecord>(
  {
    userId: requiredRef('User'),
    taskId: nullableRef('Task'),
    title: { type: String, required: true, trim: true, maxlength: 140 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  baseOptions('study_slots'),
);

studySlotSchema.pre('validate', function () {
  // Missing times are reported by the `required` rules.
  if (!(this.start instanceof Date) || !(this.end instanceof Date)) return;
  const duration = this.end.getTime() - this.start.getTime();
  if (!(duration > 0 && duration <= MAX_SLOT_HOURS * 3_600_000)) {
    this.invalidate(
      'end',
      `A study slot must end after it starts and last at most ${MAX_SLOT_HOURS} hours`,
    );
  }
});

studySlotSchema.index({ userId: 1, start: 1 });

export const StudySlotModel = model<StudySlotRecord>('StudySlot', studySlotSchema);
