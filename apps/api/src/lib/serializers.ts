import type { User } from '@sabaq/shared';
import type { HydratedDocument } from 'mongoose';
import type { UserRecord } from '../db/models/user.js';

/** The public shape of a user (the shared `userSchema`); never includes security fields. */
export function serializeUser(user: HydratedDocument<UserRecord>): User {
  const { preferences } = user.toObject();
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    studentId: user.studentId,
    avatarUrl: user.avatarUrl,
    platformRole: user.platformRole,
    preferences,
    createdAt: user.createdAt.toISOString(),
  };
}
