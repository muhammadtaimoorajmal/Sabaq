import { JOIN_REQUEST_STATUSES } from '@sabaq/shared';
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

export const MEETING_PLACE_KINDS = ['in_person', 'online'] as const;

export interface StudyGroupRecord extends Timestamps {
  classId: ObjectId;
  courseId: ObjectId;
  ownerId: ObjectId;
  /** Includes the owner. */
  memberIds: ObjectId[];
  name: string;
  topic: string;
  capacity: number;
  place: {
    kind: (typeof MEETING_PLACE_KINDS)[number];
    location: string | null;
    url: string | null;
  };
  meetings: WeeklySession[];
  openToJoin: boolean;
}

const studyGroupSchema = new Schema<StudyGroupRecord>(
  {
    classId: requiredRef('Class'),
    courseId: requiredRef('Course'),
    ownerId: requiredRef('User'),
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    topic: { type: String, trim: true, maxlength: 500, default: '' },
    capacity: { type: Number, min: 2, max: 50, default: 6 },
    place: {
      kind: { type: String, enum: MEETING_PLACE_KINDS, required: true },
      location: nullableString(120),
      url: nullableString(2048),
    },
    meetings: { type: [weeklySessionSchema], default: [] },
    openToJoin: { type: Boolean, default: true },
  },
  baseOptions('study_groups'),
);

studyGroupSchema.pre('validate', function () {
  if (this.memberIds.length > this.capacity) this.invalidate('memberIds', 'The group is full');
});

// Browse a course's groups; list the groups a person belongs to.
studyGroupSchema.index({ classId: 1, courseId: 1 });
studyGroupSchema.index({ memberIds: 1 });

export const StudyGroupModel = model<StudyGroupRecord>('StudyGroup', studyGroupSchema);

export interface JoinRequestRecord extends Timestamps {
  groupId: ObjectId;
  userId: ObjectId;
  message: string;
  status: (typeof JOIN_REQUEST_STATUSES)[number];
  decidedAt: Date | null;
}

const joinRequestSchema = new Schema<JoinRequestRecord>(
  {
    groupId: requiredRef('StudyGroup'),
    userId: requiredRef('User'),
    message: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: JOIN_REQUEST_STATUSES, default: 'pending' },
    decidedAt: { type: Date, default: null },
  },
  baseOptions('study_group_join_requests'),
);

// At most one open request per person per group; earlier decided requests may remain.
joinRequestSchema.index(
  { groupId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
joinRequestSchema.index({ groupId: 1, status: 1 });

export const JoinRequestModel = model<JoinRequestRecord>('JoinRequest', joinRequestSchema);
