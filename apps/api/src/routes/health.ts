import type { Health, Readiness } from '@sabaq/shared';
import { Router } from 'express';

/** A dependency the API needs, such as the database. `check` rejects when it is unreachable. */
export interface HealthCheck {
  name: string;
  check: () => Promise<void>;
  timeoutMs?: number;
}

export const DEFAULT_CHECK_TIMEOUT_MS = 2000;

interface CheckOutcome {
  name: string;
  result: Readiness['checks'][string];
  error?: unknown;
}

/** Runs one check with a time limit, measuring how long it took. */
export async function runCheck({
  name,
  check,
  timeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
}: HealthCheck): Promise<CheckOutcome> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    await Promise.race([check(), timeout]);
    return { name, result: { status: 'up', latencyMs: elapsed() } };
  } catch (error) {
    return { name, result: { status: 'down', latencyMs: elapsed() }, error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * - `GET /health`: liveness. Always fast and dependency-free, so it doubles as a wake-up ping.
 * - `GET /health/ready`: readiness. Checks every dependency and answers 503 if any is down.
 */
export function healthRouter({
  version,
  checks = [],
}: {
  version: string;
  checks?: HealthCheck[];
}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: Health = {
      status: 'ok',
      version,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
    res.json(body);
  });

  router.get('/health/ready', async (req, res) => {
    const outcomes = await Promise.all(checks.map(runCheck));
    const failed = outcomes.filter((outcome) => outcome.result.status === 'down');
    for (const { name, error } of failed) {
      req.log.warn({ err: error, check: name }, 'Health check failed');
    }
    const body: Readiness = {
      status: failed.length === 0 ? 'ready' : 'not_ready',
      checks: Object.fromEntries(outcomes.map(({ name, result }) => [name, result])),
    };
    res.status(failed.length === 0 ? 200 : 503).json(body);
  });

  return router;
}
