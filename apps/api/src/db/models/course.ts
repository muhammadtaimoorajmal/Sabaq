import { COLOR_TOKENS, type ColorToken } from '@sabaq/shared';
import { model, Schema } from 'mongoose';
import {
  baseOptions,
  nullableString,
  type ObjectId,
  requiredRef,
  type Timestamps,
  type WeeklySession,
  weeklySessionSchema,
} from '../schema-helpers.js';

export interface CourseRecord extends Timestamps {
  classId: ObjectId;
  code: string;
  title: string;
  instructorName: string | null;
  color: ColorToken;
  schedule: WeeklySession[];
}

const courseSchema = new Schema<CourseRecord>(
  {
    classId: requiredRef('Class'),
    code: { type: String, required: true, trim: true, maxlength: 20 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructorName: nullableString(80),
    color: { type: String, enum: COLOR_TOKENS, required: true },
    schedule: {
      type: [weeklySessionSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => value.length <= 14,
        message: 'Too many sessions',
      },
    },
  },
  baseOptions('courses'),
);

// Course codes are unique within a class, ignoring letter case ("cs-301" equals "CS-301").
courseSchema.index(
  { classId: 1, code: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export const CourseModel = model<CourseRecord>('Course', courseSchema);
