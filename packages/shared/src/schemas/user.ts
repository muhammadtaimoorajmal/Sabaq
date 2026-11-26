import { z } from 'zod';
import { idSchema, isoDateTimeSchema, timeOfDaySchema, timeZoneSchema } from './common.js';

export const THEMES = ['system', 'light', 'dark', 'high-contrast'] as const;
export const DENSITIES = ['comfortable', 'compact'] as const;
export const LANGUAGES = ['en', 'ur'] as const;
export const MOTION_PREFERENCES = ['system', 'reduce', 'full'] as const;
export const TIME_FORMATS = ['12h', '24h'] as const;
export const DIGEST_FREQUENCIES = ['immediate', 'hourly', 'daily'] as const;

/** Right-to-left languages among the supported ones. */
export const RTL_LANGUAGES: readonly Language[] = ['ur'];

export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

/** Text size relative to the default, from 87.5% to 150%. */
export const TEXT_SCALE_MIN = 0.875;
export const TEXT_SCALE_MAX = 1.5;

export const quietHoursSchema = z.object({
  enabled: z.boolean().default(false),
  start: timeOfDaySchema.default('22:00'),
  end: timeOfDaySchema.default('07:00'),
});
export type QuietHours = z.infer<typeof quietHoursSchema>;

/**
 * Quiet-hours fields for partial updates. Deliberately has no defaults: a default here would
 * silently overwrite a person's saved times whenever they change only one field.
 */
const quietHoursUpdateSchema = z
  .object({ enabled: z.boolean(), start: timeOfDaySchema, end: timeOfDaySchema })
  .partial();

export const notificationPreferencesSchema = z.object({
  digest: z.enum(DIGEST_FREQUENCIES).default('immediate'),
  email: z.boolean().default(false),
  quietHours: quietHoursSchema.prefault({}),
});

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).default('system'),
  textScale: z.number().min(TEXT_SCALE_MIN).max(TEXT_SCALE_MAX).default(1),
  density: z.enum(DENSITIES).default('comfortable'),
  language: languageSchema.default('en'),
  motion: z.enum(MOTION_PREFERENCES).default('system'),
  timeFormat: z.enum(TIME_FORMATS).default('12h'),
  weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]).default(1),
  timeZone: timeZoneSchema.default('UTC'),
  notifications: notificationPreferencesSchema.prefault({}),
});
export type Preferences = z.infer<typeof preferencesSchema>;

/** Preferences for a brand-new account. */
export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({});

/** Partial update of preferences, as sent from the settings screen. */
export const preferencesUpdateSchema = z
  .object({
    theme: z.enum(THEMES),
    textScale: z.number().min(TEXT_SCALE_MIN).max(TEXT_SCALE_MAX),
    density: z.enum(DENSITIES),
    language: languageSchema,
    motion: z.enum(MOTION_PREFERENCES),
    timeFormat: z.enum(TIME_FORMATS),
    weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]),
    timeZone: timeZoneSchema,
    notifications: z
      .object({
        digest: z.enum(DIGEST_FREQUENCIES),
        email: z.boolean(),
        quietHours: quietHoursUpdateSchema,
      })
      .partial(),
  })
  .partial();
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;

export const PLATFORM_ROLES = ['user', 'admin'] as const;
export const platformRoleSchema = z.enum(PLATFORM_ROLES);
export type PlatformRole = z.infer<typeof platformRoleSchema>;

export const personNameSchema = z.string().trim().min(2).max(80);

/** Institution-issued student or staff number. Letters, digits, dots, dashes and underscores. */
export const studentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[\w.-]+$/, 'Use only letters, numbers, dots, dashes and underscores');

/**
 * Where a profile photo is served from: an `https` address, or a path on the API itself such as
 * `/api/users/<id>/avatar/<version>` (the version changes with every new photo, so browsers can
 * cache each one forever).
 */
export const avatarUrlSchema = z.union([
  z.url({ protocol: /^https$/ }),
  z.string().regex(/^\/api\/users\/[a-f\d]{24}\/avatar\/[\w-]{1,64}$/),
]);

/** A user as returned by the API to its owner. */
export const userSchema = z.object({
  id: idSchema,
  name: personNameSchema,
  email: z.email(),
  emailVerified: z.boolean(),
  studentId: studentIdSchema.nullable(),
  avatarUrl: avatarUrlSchema.nullable(),
  platformRole: platformRoleSchema,
  preferences: preferencesSchema,
  /** When the person finished or skipped the welcome steps; `null` until then. */
  onboardedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

/** The minimal public view of another user (for member lists, receipts and groups). */
export const userSummarySchema = userSchema.pick({ id: true, name: true, avatarUrl: true });
export type UserSummary = z.infer<typeof userSummarySchema>;

export const profileUpdateSchema = z
  .object({
    name: personNameSchema,
    studentId: studentIdSchema.nullable(),
  })
  .partial();
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

/** Image types accepted for profile photos. */
export const AVATAR_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
/** Largest accepted profile photo, after the browser has resized it. */
export const AVATAR_MAX_BYTES = 64 * 1024;
/** Profile photos are resized to this many pixels square before upload. */
export const AVATAR_SIZE = 256;

/** A new profile photo, as a `data:` URL of a small square image. */
export const avatarUploadSchema = z.object({
  image: z
    .string()
    .max(Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 64)
    .regex(
      /^data:image\/(webp|jpeg|png);base64,[A-Za-z\d+/]+={0,2}$/,
      'Choose a JPEG, PNG or WebP image',
    ),
});
export type AvatarUpload = z.infer<typeof avatarUploadSchema>;

/** Deleting an account needs the password again, so an unattended device cannot do it. */
export const deleteAccountInputSchema = z.object({ password: z.string().min(1).max(128) });
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;
