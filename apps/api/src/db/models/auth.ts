import { model, Schema } from 'mongoose';
import { baseOptions, type ObjectId, requiredRef, type Timestamps } from '../schema-helpers.js';

/**
 * One signed-in device. The refresh token itself is never stored, only its SHA-256 hash.
 * Each refresh replaces the token ("rotation"); presenting an already-replaced token after
 * a short grace period signals theft and ends the session.
 */
export interface SessionRecord extends Timestamps {
  userId: ObjectId;
  tokenHash: string;
  /** Hash of the token replaced by the latest rotation. */
  previousTokenHash: string | null;
  rotatedAt: Date | null;
  /** Browser description, such as "Chrome on Windows". */
  device: string;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

const sessionSchema = new Schema<SessionRecord>(
  {
    userId: requiredRef('User'),
    tokenHash: { type: String, required: true },
    previousTokenHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    device: { type: String, maxlength: 120, default: 'Unknown device' },
    lastUsedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  baseOptions('sessions'),
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ previousTokenHash: 1 }, { sparse: true });
sessionSchema.index({ userId: 1, revokedAt: 1 });
// Expired sessions are deleted automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<SessionRecord>('Session', sessionSchema);

export const EMAIL_TOKEN_PURPOSES = ['verify_email', 'reset_password'] as const;
export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];

/** A single-use link sent by e-mail. Only the token's hash is stored. */
export interface EmailTokenRecord extends Timestamps {
  userId: ObjectId;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
}

const emailTokenSchema = new Schema<EmailTokenRecord>(
  {
    userId: requiredRef('User'),
    purpose: { type: String, enum: EMAIL_TOKEN_PURPOSES, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  baseOptions('email_tokens'),
);

emailTokenSchema.index({ tokenHash: 1 }, { unique: true });
emailTokenSchema.index({ userId: 1, purpose: 1 });
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailTokenModel = model<EmailTokenRecord>('EmailToken', emailTokenSchema);
