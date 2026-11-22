import { SUBMISSION_CHANNELS, type SubmissionRule, TASK_TYPES, type TaskType } from '@sabaq/shared';
import { model, Schema } from 'mongoose';
import {
  baseOptions,
  nullableRef,
  nullableString,
  type ObjectId,
  requiredRef,
  type Timestamps,
} from '../schema-helpers.js';

export const LATE_POLICY_KINDS = ['not_accepted', 'penalty', 'accepted'] as const;

/** Stored form of a submission rule; `penaltyPercent` is `null` unless the policy is a penalty. */
export interface SubmissionRuleRecord extends Omit<SubmissionRule, 'latePolicy'> {
  latePolicy: {
    kind: (typeof LATE_POLICY_KINDS)[number];
    graceMinutes: number;
    penaltyPercent: number | null;
  };
}

const submissionRuleSchema = new Schema<SubmissionRuleRecord>(
  {
    namingPattern: nullableString(120),
    caseSensitive: { type: Boolean, default: false },
    allowedExtensions: { type: [String], default: [] },
    maxSizeMB: { type: Number, min: 0, max: 1024, default: null },
    channel: {
      kind: { type: String, enum: SUBMISSION_CHANNELS, required: true },
      label: nullableString(120),
      url: nullableString(2048),
    },
    latePolicy: {
      kind: { type: String, enum: LATE_POLICY_KINDS, default: 'not_accepted' },
      graceMinutes: { type: Number, min: 0, max: 1440, default: 0 },
      penaltyPercent: { type: Number, min: 1, max: 100, default: null },
    },
  },
  { _id: false },
);

export interface TaskRecord extends Timestamps {
  /** Set for class tasks (visible to every member); `null` for personal tasks. */
  classId: ObjectId | null;
  /** Set for personal tasks; `null` for class tasks. */
  ownerId: ObjectId | null;
  /** The announcement that created this task, if any. */
  announcementId: ObjectId | null;
  courseId: ObjectId | null;
  title: string;
  type: TaskType;
  dueAt: Date;
  description: string;
  effort: number | null;
  submissionRule: SubmissionRuleRecord | null;
  createdBy: ObjectId;
}

const taskSchema = new Schema<TaskRecord>(
  {
    classId: nullableRef('Class'),
    ownerId: nullableRef('User'),
    announcementId: nullableRef('Announcement'),
    courseId: nullableRef('Course'),
    title: { type: String, required: true, trim: true, maxlength: 140 },
    type: { type: String, enum: TASK_TYPES, required: true },
    dueAt: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    effort: { type: Number, min: 1, max: 5, default: null },
    submissionRule: { type: submissionRuleSchema, default: null },
    createdBy: requiredRef('User'),
  },
  baseOptions('tasks'),
);

taskSchema.pre('validate', function () {
  if ((this.classId === null) === (this.ownerId === null)) {
    this.invalidate('classId', 'A task belongs either to a class or to one person, not both');
  }
});

// Timelines read a class's or a person's tasks in due-date order.
taskSchema.index({ classId: 1, dueAt: 1 });
taskSchema.index({ ownerId: 1, dueAt: 1 });
taskSchema.index({ announcementId: 1 }, { sparse: true });

export const TaskModel = model<TaskRecord>('Task', taskSchema);

/** One person marking one task as done. */
export interface TaskCompletionRecord extends Timestamps {
  taskId: ObjectId;
  userId: ObjectId;
  completedAt: Date;
}

const taskCompletionSchema = new Schema<TaskCompletionRecord>(
  {
    taskId: requiredRef('Task'),
    userId: requiredRef('User'),
    completedAt: { type: Date, default: () => new Date() },
  },
  baseOptions('task_completions'),
);

taskCompletionSchema.index({ userId: 1, taskId: 1 }, { unique: true });
taskCompletionSchema.index({ taskId: 1 });

export const TaskCompletionModel = model<TaskCompletionRecord>(
  'TaskCompletion',
  taskCompletionSchema,
);
