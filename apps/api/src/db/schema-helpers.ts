import { isValidTimeZone, SESSION_KINDS } from '@sabaq/shared';
import type { Types } from 'mongoose';
import { Schema, type SchemaOptions } from 'mongoose';

/** Fields every stored document gets from Mongoose's `timestamps` option. */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Options shared by every collection: automatic timestamps, and JSON output with a string
 * `id` instead of `_id` and without the internal version key or password hash.
 */
export function baseOptions<T>(collection: string): SchemaOptions<T> {
  return {
    collection,
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_document, record: Record<string, unknown>) => {
        record.id = String(record._id);
        delete record._id;
        delete record.passwordHash;
        return record;
      },
    },
  };
}

/** A required reference to another document. */
export const requiredRef = (model: string) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required: true,
});

/** An optional reference that is stored as `null` when absent, never as a missing field. */
export const nullableRef = (model: string) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  default: null,
});

/** Optional text stored as `null` when absent. */
export const nullableString = (maxlength: number) => ({
  type: String,
  trim: true,
  maxlength,
  default: null,
});

export const TIME_OF_DAY = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const timeZoneField = {
  type: String,
  required: true,
  validate: { validator: isValidTimeZone, message: 'Unknown time zone' },
};

export interface WeeklySession {
  kind: (typeof SESSION_KINDS)[number];
  dayOfWeek: number;
  start: string;
  end: string;
  venue: string | null;
}

/** A recurring weekly session, used for class timetables and study group meetings. */
export const weeklySessionSchema = new Schema<WeeklySession>(
  {
    kind: { type: String, enum: SESSION_KINDS, required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, match: TIME_OF_DAY, required: true },
    end: { type: String, match: TIME_OF_DAY, required: true },
    venue: nullableString(80),
  },
  { _id: false },
);

weeklySessionSchema.pre('validate', function () {
  if (this.end <= this.start) this.invalidate('end', 'The session must end after it starts');
});

export type ObjectId = Types.ObjectId;
