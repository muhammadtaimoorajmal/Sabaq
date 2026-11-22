import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SessionInfo,
  User,
} from '@sabaq/shared';
import { isValidObjectId, type HydratedDocument, type Types } from 'mongoose';
import type { Logger } from 'pino';
import type { Config } from '../config/env.js';
import {
  EmailTokenModel,
  type EmailTokenPurpose,
  SessionModel,
  type SessionRecord,
  UserModel,
  type UserRecord,
} from '../db/models/index.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { serializeUser } from '../lib/serializers.js';
import type { Mailer } from '../mail/mailer.js';
import { type EmailKind, renderEmail } from '../mail/templates.js';
import { hashToken, randomToken, signAccessToken } from './tokens.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Failed sign-ins allowed before the account is locked for `LOCK_DURATION_MS`. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * MINUTE;
/** A rotated refresh token still works this long, so parallel tabs do not sign each other out. */
export const ROTATION_GRACE_MS = 30_000;
/** Minimum time between two e-mails of the same kind to the same person. */
export const EMAIL_COOLDOWN_MS = MINUTE;
export const EMAIL_TOKEN_TTL_MS: Record<EmailTokenPurpose, number> = {
  verify_email: DAY,
  reset_password: HOUR,
};

type UserDocument = HydratedDocument<UserRecord>;

/** The result of signing in, signing up or refreshing. */
export interface IssuedSession {
  user: User;
  accessToken: string;
  accessTokenExpiresAt: Date;
  /** `null` when the existing cookie stays valid (refresh during the rotation grace period). */
  refreshToken: string | null;
  refreshTokenExpiresAt: Date;
}

export interface AuthServiceOptions {
  config: Pick<Config, 'auth' | 'appUrl'>;
  mailer: Mailer;
  logger: Logger;
  now?: () => Date;
}

const invalidCredentials = () =>
  new AppError('invalid_credentials', 'The e-mail address or password is incorrect.');
const sessionExpired = () =>
  new AppError('session_expired', 'Your session has ended. Please sign in again.');

/** All account rules: sign-up, sign-in, sessions, e-mail verification and passwords. */
export class AuthService {
  private readonly config: AuthServiceOptions['config'];
  private readonly mailer: Mailer;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private timingHash: Promise<string> | undefined;

  constructor({ config, mailer, logger, now = () => new Date() }: AuthServiceOptions) {
    this.config = config;
    this.mailer = mailer;
    this.logger = logger;
    this.now = now;
  }

  async register(input: RegisterInput, device: string): Promise<IssuedSession> {
    if (await UserModel.exists({ email: input.email })) throw this.emailTaken();
    let user: UserDocument;
    try {
      user = await UserModel.create({
        name: input.name,
        email: input.email,
        studentId: input.studentId ?? null,
        passwordHash: await hashPassword(input.password),
      });
    } catch (error) {
      // Two simultaneous sign-ups with one address: the unique index decides.
      if ((error as { code?: unknown }).code === 11000) throw this.emailTaken();
      throw error;
    }
    await this.sendEmailLink(user, 'verify_email');
    return this.startSession(user, device);
  }

  async login({ email, password }: LoginInput, device: string): Promise<IssuedSession> {
    const now = this.now();
    const user = await UserModel.findOne({ email }).select('+passwordHash');
    if (!user) {
      // Take as long as a real check, so response times do not reveal which addresses exist.
      await verifyPassword(await this.timingEqualizer(), password);
      throw invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil > now) throw this.locked(user.lockedUntil, now);

    if (!(await verifyPassword(user.passwordHash, password))) {
      const updated = await UserModel.findByIdAndUpdate(
        user._id,
        { $inc: { failedLoginCount: 1 } },
        { returnDocument: 'after' },
      );
      if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
        const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
        await UserModel.updateOne({ _id: user._id }, { lockedUntil, failedLoginCount: 0 });
        this.logger.warn({ userId: String(user._id) }, 'Account locked after failed sign-ins');
        throw this.locked(lockedUntil, now);
      }
      throw invalidCredentials();
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = now;
    await user.save();
    return this.startSession(user, device);
  }

  /**
   * Exchanges a refresh token for a new access token and a new refresh token. Presenting a
   * token that was already replaced, after the grace period, means it was copied: the
   * whole session is ended.
   */
  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    if (!refreshToken) throw sessionExpired();
    const now = this.now();
    const tokenHash = hashToken(refreshToken);
    const nextToken = randomToken();
    const expiresAt = this.refreshExpiry(now);

    const rotated = await SessionModel.findOneAndUpdate(
      { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
      {
        tokenHash: hashToken(nextToken),
        previousTokenHash: tokenHash,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt,
      },
      { returnDocument: 'after' },
    );
    if (rotated) return this.issue(rotated, nextToken);

    const previous = await SessionModel.findOne({ previousTokenHash: tokenHash, revokedAt: null });
    if (previous?.rotatedAt && now.getTime() - previous.rotatedAt.getTime() <= ROTATION_GRACE_MS) {
      return this.issue(previous, null);
    }
    if (previous) {
      await SessionModel.updateOne({ _id: previous._id }, { revokedAt: now });
      this.logger.warn(
        { userId: String(previous.userId), sessionId: String(previous._id) },
        'Replaced refresh token reused; session ended',
      );
    }
    throw sessionExpired();
  }

  /** Ends the session that owns this refresh token. Unknown tokens are ignored. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await SessionModel.updateOne(
      { tokenHash: hashToken(refreshToken), revokedAt: null },
      { revokedAt: this.now() },
    );
  }

  /** Ends every session of a user, optionally keeping one (the current device). */
  async logoutEverywhere(userId: string, exceptSessionId?: string): Promise<void> {
    await SessionModel.updateMany(
      {
        userId,
        revokedAt: null,
        ...(exceptSessionId && { _id: { $ne: exceptSessionId } }),
      },
      { revokedAt: this.now() },
    );
  }

  async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    if (!isValidObjectId(sessionId)) return false;
    const active = await SessionModel.exists({
      _id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { $gt: this.now() },
    });
    return active !== null;
  }

  async currentUser(userId: string): Promise<User> {
    const user = await UserModel.findById(userId);
    if (!user) throw sessionExpired();
    return serializeUser(user);
  }

  async listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const sessions = await SessionModel.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: this.now() },
    }).sort({ lastUsedAt: -1 });
    return sessions.map((session) => ({
      id: String(session._id),
      device: session.device,
      current: String(session._id) === currentSessionId,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = isValidObjectId(sessionId)
      ? await SessionModel.updateOne(
          { _id: sessionId, userId, revokedAt: null },
          { revokedAt: this.now() },
        )
      : { matchedCount: 0 };
    if (result.matchedCount === 0) {
      throw new AppError('not_found', 'That session does not exist or has already ended.');
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeToken(token, 'verify_email');
    await UserModel.updateOne({ _id: record.userId }, { emailVerified: true });
  }

  /** Always succeeds from the caller's view, so it cannot be used to discover accounts. */
  async resendVerification(email: string): Promise<void> {
    const user = await UserModel.findOne({ email });
    if (user && !user.emailVerified) await this.sendEmailLink(user, 'verify_email');
  }

  /** Always succeeds from the caller's view, so it cannot be used to discover accounts. */
  async forgotPassword(email: string): Promise<void> {
    const user = await UserModel.findOne({ email });
    if (user) await this.sendEmailLink(user, 'reset_password');
  }

  /** Sets a new password from an e-mailed link and signs the account out everywhere. */
  async resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    const record = await this.consumeToken(token, 'reset_password');
    const user = await UserModel.findById(record.userId);
    if (!user) throw this.invalidToken();
    await this.setPassword(user, password, {
      // Opening the e-mailed link proves the address belongs to this person.
      emailVerified: true,
    });
    await this.logoutEverywhere(String(user._id));
  }

  /** Changes the password, keeping the current device signed in and ending all others. */
  async changePassword(
    userId: string,
    sessionId: string,
    { currentPassword, newPassword }: ChangePasswordInput,
  ): Promise<void> {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) throw sessionExpired();
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppError('validation_failed', 'Some fields are not valid.', {
        issues: [
          {
            path: 'currentPassword',
            code: 'incorrect',
            message: 'The current password is incorrect.',
          },
        ],
      });
    }
    await this.setPassword(user, newPassword, {});
    await this.logoutEverywhere(userId, sessionId);
  }

  // Internals ------------------------------------------------------------------------------

  private async startSession(user: UserDocument, device: string): Promise<IssuedSession> {
    const now = this.now();
    const refreshToken = randomToken();
    const session = await SessionModel.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      device,
      lastUsedAt: now,
      expiresAt: this.refreshExpiry(now),
    });
    return this.issue(session, refreshToken, user);
  }

  private async issue(
    session: HydratedDocument<SessionRecord>,
    refreshToken: string | null,
    knownUser?: UserDocument,
  ): Promise<IssuedSession> {
    const user = knownUser ?? (await UserModel.findById(session.userId));
    if (!user) throw sessionExpired();
    const access = await signAccessToken(
      { userId: String(user._id), sessionId: String(session._id) },
      {
        secret: this.config.auth.jwtSecret,
        ttlSeconds: this.config.auth.accessTokenTtlSeconds,
        now: this.now(),
      },
    );
    return {
      user: serializeUser(user),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    };
  }

  private refreshExpiry(now: Date): Date {
    return new Date(now.getTime() + this.config.auth.refreshTokenTtlDays * DAY);
  }

  private async setPassword(
    user: UserDocument,
    password: string,
    extra: Partial<Pick<UserRecord, 'emailVerified'>>,
  ): Promise<void> {
    await UserModel.updateOne(
      { _id: user._id },
      {
        passwordHash: await hashPassword(password),
        passwordChangedAt: this.now(),
        failedLoginCount: 0,
        lockedUntil: null,
        ...extra,
      },
    );
    await this.sendEmail(user, 'password_changed', `${this.config.appUrl}/forgot-password`);
  }

  /** Creates a single-use link (replacing older ones) and e-mails it, at most once a minute. */
  private async sendEmailLink(user: UserDocument, purpose: EmailTokenPurpose): Promise<void> {
    const now = this.now();
    const recent = await EmailTokenModel.exists({
      userId: user._id,
      purpose,
      createdAt: { $gt: new Date(now.getTime() - EMAIL_COOLDOWN_MS) },
    });
    if (recent) return;

    const token = randomToken();
    await EmailTokenModel.deleteMany({ userId: user._id, purpose });
    await EmailTokenModel.create({
      userId: user._id,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + EMAIL_TOKEN_TTL_MS[purpose]),
      createdAt: now,
      updatedAt: now,
    });
    // The token travels in the URL fragment, which browsers never send to servers or in
    // Referer headers, so it cannot leak into logs.
    const path = purpose === 'verify_email' ? 'verify-email' : 'reset-password';
    await this.sendEmail(user, purpose, `${this.config.appUrl}/${path}#token=${token}`);
  }

  /** Delivery problems are logged, never shown: the account action itself succeeded. */
  private async sendEmail(user: UserDocument, kind: EmailKind, link: string): Promise<void> {
    try {
      await this.mailer.send(
        renderEmail(kind, {
          to: user.email,
          name: user.name,
          link,
          language: user.preferences.language,
        }),
      );
    } catch (error) {
      this.logger.error({ err: error, kind, userId: String(user._id) }, 'E-mail delivery failed');
    }
  }

  private async consumeToken(token: string, purpose: EmailTokenPurpose) {
    const record = await EmailTokenModel.findOneAndDelete({
      tokenHash: hashToken(token),
      purpose,
      expiresAt: { $gt: this.now() },
    });
    if (!record) throw this.invalidToken();
    return record as { userId: Types.ObjectId };
  }

  private timingEqualizer(): Promise<string> {
    this.timingHash ??= hashPassword(randomToken());
    return this.timingHash;
  }

  private emailTaken() {
    return new AppError('email_taken', 'An account with this e-mail address already exists.');
  }

  private invalidToken() {
    return new AppError('invalid_token', 'This link is invalid or has expired. Request a new one.');
  }

  private locked(until: Date, now: Date) {
    const seconds = Math.ceil((until.getTime() - now.getTime()) / 1000);
    const minutes = Math.ceil(seconds / 60);
    return new AppError(
      'account_locked',
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
      { retryAfterSeconds: seconds },
    );
  }
}
