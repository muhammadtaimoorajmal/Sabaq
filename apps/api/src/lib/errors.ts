import type { ApiErrorCode, FieldIssue } from '@sabaq/shared';

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_failed: 400,
  invalid_json: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
};

/** An expected failure whose code and message are safe to show to the client. */
export class AppError extends Error {
  readonly status: number;
  readonly issues: FieldIssue[] | undefined;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    options: { issues?: FieldIssue[]; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.status = STATUS_BY_CODE[code];
    this.issues = options.issues;
  }
}
