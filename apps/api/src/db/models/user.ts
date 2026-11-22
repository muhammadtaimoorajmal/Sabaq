import {
  DEFAULT_PREFERENCES,
  DENSITIES,
  DIGEST_FREQUENCIES,
  LANGUAGES,
  MOTION_PREFERENCES,
  PLATFORM_ROLES,
  type PlatformRole,
  type Preferences,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  THEMES,
  TIME_FORMATS,
} from '@sabaq/shared';
import { model, Schema } from 'mongoose';
import {
  baseOptions,
  nullableString,
  TIME_OF_DAY,
  timeZoneField,
  type Timestamps,
} from '../schema-helpers.js';

export interface UserRecord extends Timestamps {
  name: string;
  /** Stored lowercase; unique across the platform. */
  email: string;
  emailVerified: boolean;
  /** Argon2id hash. Never selected unless explicitly requested. */
  passwordHash: string;
  studentId: string | null;
  avatarUrl: string | null;
  platformRole: PlatformRole;
  preferences: Preferences;
  lastLoginAt: Date | null;
}

const defaults = DEFAULT_PREFERENCES;
const { notifications } = defaults;

const preferencesSchema = new Schema<Preferences>(
  {
    theme: { type: String, enum: THEMES, default: defaults.theme },
    textScale: { type: Number, min: TEXT_SCALE_MIN, max: TEXT_SCALE_MAX, default: 1 },
    density: { type: String, enum: DENSITIES, default: defaults.density },
    language: { type: String, enum: LANGUAGES, default: defaults.language },
    motion: { type: String, enum: MOTION_PREFERENCES, default: defaults.motion },
    timeFormat: { type: String, enum: TIME_FORMATS, default: defaults.timeFormat },
    weekStartsOn: { type: Number, enum: [0, 1, 6], default: defaults.weekStartsOn },
    timeZone: { ...timeZoneField, required: false, default: defaults.timeZone },
    notifications: {
      digest: { type: String, enum: DIGEST_FREQUENCIES, default: notifications.digest },
      email: { type: Boolean, default: notifications.email },
      quietHours: {
        enabled: { type: Boolean, default: notifications.quietHours.enabled },
        start: { type: String, match: TIME_OF_DAY, default: notifications.quietHours.start },
        end: { type: String, match: TIME_OF_DAY, default: notifications.quietHours.end },
      },
    },
  },
  { _id: false },
);

const userSchema = new Schema<UserRecord>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String, required: true, select: false },
    studentId: nullableString(32),
    avatarUrl: nullableString(2048),
    platformRole: { type: String, enum: PLATFORM_ROLES, default: 'user' },
    preferences: { type: preferencesSchema, default: () => ({}) },
    lastLoginAt: { type: Date, default: null },
  },
  baseOptions('users'),
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel = model<UserRecord>('User', userSchema);
