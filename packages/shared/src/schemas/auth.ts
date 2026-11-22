import { z } from 'zod';
import { personNameSchema, studentIdSchema } from './user.js';

/**
 * Password policy following NIST SP 800-63B: a minimum length and a generous maximum,
 * with no arbitrary composition rules (they make passwords harder to remember, not stronger).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, { error: 'Password cannot be only spaces' });

/** Email addresses are trimmed and lower-cased so the same person cannot register twice. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const registerInputSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  studentId: studentIdSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  /** Not validated against the policy, so older passwords keep working if the policy changes. */
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/** Single-use tokens sent by email are 32 random bytes encoded as URL-safe base64. */
export const emailTokenSchema = z
  .string()
  .regex(/^[\w-]{43}$/, 'This link is invalid. Request a new one.');

export const verifyEmailInputSchema = z.object({ token: emailTokenSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;

export const resendVerificationInputSchema = z.object({ email: emailSchema });
export type ResendVerificationInput = z.infer<typeof resendVerificationInputSchema>;

export const forgotPasswordInputSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  token: emailTokenSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    error: 'Choose a password different from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
