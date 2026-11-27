import { workloadQuerySchema } from '@sabaq/shared';
import { type RequestHandler, Router } from 'express';
import { authOf } from '../auth/middleware.js';
import { parseInput } from '../lib/validate.js';
import type { WorkloadService } from './service.js';

/** The person's own workload (`/api/workload`). */
export function workloadRouter({
  service,
  authenticated,
}: {
  service: WorkloadService;
  authenticated: RequestHandler;
}): Router {
  const router = Router();
  router.get('/', authenticated, async (req, res) => {
    res.json(await service.mine(authOf(res).userId, parseInput(workloadQuerySchema, req.query)));
  });
  return router;
}

/** A class's workload (`/api/classes/:classId/workload`). */
export function classWorkloadRouter({
  service,
  authenticated,
}: {
  service: WorkloadService;
  authenticated: RequestHandler;
}): Router {
  const router = Router({ mergeParams: true });
  router.get('/', authenticated, async (req, res) => {
    res.json(
      await service.ofClass(
        authOf(res).userId,
        req.params.classId as string,
        parseInput(workloadQuerySchema, req.query),
      ),
    );
  });
  return router;
}
