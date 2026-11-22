import {
  isValidJoinCode,
  MEMBERSHIP_ROLES,
  type MembershipRole,
  normalizeJoinCode,
} from '@sabaq/shared';
import { model, Schema } from 'mongoose';
import {
  baseOptions,
  nullableString,
  type ObjectId,
  requiredRef,
  timeZoneField,
  type Timestamps,
} from '../schema-helpers.js';

export interface ClassRecord extends Timestamps {
  name: string;
  program: string;
  term: string;
  institution: string | null;
  /** IANA time zone in which "due today" is judged for everyone in the class. */
  timeZone: string;
  /** Normalized (uppercase, no separators); unique across the platform. */
  joinCode: string;
  createdBy: ObjectId;
  archivedAt: Date | null;
}

const classSchema = new Schema<ClassRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    program: { type: String, required: true, trim: true, maxlength: 120 },
    term: { type: String, required: true, trim: true, maxlength: 60 },
    institution: nullableString(120),
    timeZone: timeZoneField,
    joinCode: {
      type: String,
      required: true,
      set: normalizeJoinCode,
      validate: { validator: isValidJoinCode, message: 'Invalid join code' },
    },
    createdBy: requiredRef('User'),
    archivedAt: { type: Date, default: null },
  },
  baseOptions('classes'),
);

classSchema.index({ joinCode: 1 }, { unique: true });

export const ClassModel = model<ClassRecord>('Class', classSchema);

export interface MembershipRecord extends Timestamps {
  classId: ObjectId;
  userId: ObjectId;
  role: MembershipRole;
  joinedAt: Date;
}

const membershipSchema = new Schema<MembershipRecord>(
  {
    classId: requiredRef('Class'),
    userId: requiredRef('User'),
    role: { type: String, enum: MEMBERSHIP_ROLES, default: 'student' },
    joinedAt: { type: Date, default: () => new Date() },
  },
  baseOptions('memberships'),
);

// One membership per person per class; list a person's classes; list a class's members by role.
membershipSchema.index({ classId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1 });
membershipSchema.index({ classId: 1, role: 1 });

export const MembershipModel = model<MembershipRecord>('Membership', membershipSchema);
