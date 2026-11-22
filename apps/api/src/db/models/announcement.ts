import { ANNOUNCEMENT_TYPES, type AnnouncementType } from '@sabaq/shared';
import { model, Schema } from 'mongoose';
import {
  baseOptions,
  nullableRef,
  nullableString,
  type ObjectId,
  requiredRef,
  type Timestamps,
} from '../schema-helpers.js';

export interface AnnouncementEditRecord {
  editedAt: Date;
  editedBy: ObjectId;
  changedFields: string[];
}

export interface AnnouncementRecord extends Timestamps {
  classId: ObjectId;
  authorId: ObjectId;
  type: AnnouncementType;
  courseId: ObjectId | null;
  title: string;
  body: string;
  links: { label: string; url: string }[];
  pinned: boolean;
  dueAt: Date | null;
  startsAt: Date | null;
  venue: string | null;
  /** The class task created from a deadline or assessment announcement. */
  taskId: ObjectId | null;
  /** Every edit is kept, so students can see what changed and when. */
  edits: AnnouncementEditRecord[];
}

const announcementSchema = new Schema<AnnouncementRecord>(
  {
    classId: requiredRef('Class'),
    authorId: requiredRef('User'),
    type: { type: String, enum: ANNOUNCEMENT_TYPES, required: true },
    courseId: nullableRef('Course'),
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, trim: true, maxlength: 5000, default: '' },
    links: {
      type: [
        new Schema(
          {
            label: { type: String, required: true, trim: true, maxlength: 80 },
            url: { type: String, required: true, maxlength: 2048 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    pinned: { type: Boolean, default: false },
    dueAt: { type: Date, default: null },
    startsAt: { type: Date, default: null },
    venue: nullableString(120),
    taskId: nullableRef('Task'),
    edits: {
      type: [
        new Schema<AnnouncementEditRecord>(
          {
            editedAt: { type: Date, required: true },
            editedBy: requiredRef('User'),
            changedFields: { type: [String], required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  baseOptions('announcements'),
);

// A class's feed: pinned first, newest next. The text index powers search.
announcementSchema.index({ classId: 1, pinned: -1, createdAt: -1 });
announcementSchema.index({ title: 'text', body: 'text' }, { weights: { title: 3, body: 1 } });

export const AnnouncementModel = model<AnnouncementRecord>('Announcement', announcementSchema);

/** Records that one person has seen one announcement ("Seen by" receipts). */
export interface AnnouncementReceiptRecord extends Timestamps {
  announcementId: ObjectId;
  classId: ObjectId;
  userId: ObjectId;
  seenAt: Date;
}

const receiptSchema = new Schema<AnnouncementReceiptRecord>(
  {
    announcementId: requiredRef('Announcement'),
    classId: requiredRef('Class'),
    userId: requiredRef('User'),
    seenAt: { type: Date, default: () => new Date() },
  },
  baseOptions('announcement_receipts'),
);

receiptSchema.index({ announcementId: 1, userId: 1 }, { unique: true });
receiptSchema.index({ userId: 1, classId: 1 });

export const AnnouncementReceiptModel = model<AnnouncementReceiptRecord>(
  'AnnouncementReceipt',
  receiptSchema,
);
