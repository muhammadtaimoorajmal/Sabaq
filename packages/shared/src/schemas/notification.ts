import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common.js';

export const NOTIFICATION_TYPES = [
  'announcement.created',
  'announcement.updated',
  'task.due_soon',
  'task.changed',
  'study_group.join_requested',
  'study_group.join_approved',
  'class.role_changed',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * Notifications store a type and parameters rather than text, so they are rendered in the
 * reader's language. `link` always points to the source, so every notification is actionable.
 */
export const notificationSchema = z.object({
  id: idSchema,
  type: notificationTypeSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  link: z.string().startsWith('/'),
  createdAt: isoDateTimeSchema,
  /** Held back until this moment by quiet hours or digest settings. */
  deliverAt: isoDateTimeSchema,
  readAt: isoDateTimeSchema.nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;
