import { NOTIFICATION_TYPES, type NotificationType } from '@sabaq/shared';
import { model, Schema } from 'mongoose';
import { baseOptions, type ObjectId, requiredRef, type Timestamps } from '../schema-helpers.js';

/** Notifications are removed automatically after this many days. */
export const NOTIFICATION_RETENTION_DAYS = 180;

export interface NotificationRecord extends Timestamps {
  userId: ObjectId;
  type: NotificationType;
  /** Values for the translated message, such as `{ course: "CS-301" }`. */
  params: Record<string, string | number | null>;
  /** In-app path to open, such as `/classes/…/announcements/…`. */
  link: string;
  /** When to show it; later than `createdAt` during quiet hours. */
  deliverAt: Date;
  readAt: Date | null;
}

const notificationSchema = new Schema<NotificationRecord>(
  {
    userId: requiredRef('User'),
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    params: { type: Schema.Types.Mixed, default: () => ({}) },
    link: { type: String, required: true, match: /^\//, maxlength: 512 },
    deliverAt: { type: Date, default: () => new Date() },
    readAt: { type: Date, default: null },
  },
  { ...baseOptions<NotificationRecord>('notifications'), minimize: false },
);

notificationSchema.index({ userId: 1, deliverAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 },
);

export const NotificationModel = model<NotificationRecord>('Notification', notificationSchema);
