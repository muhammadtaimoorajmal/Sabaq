import { agendaQuerySchema, createTaskInputSchema, updateTaskInputSchema } from '@sabaq/shared';
import { type RequestHandler, Router } from 'express';
import { authOf } from '../auth/middleware.js';
import { parseInput } from '../lib/validate.js';
import type { TaskService } from './service.js';

/** The agenda (`/api/agenda`) and tasks (`/api/tasks`). */
export function tasksRouter({
  service,
  authenticated,
}: {
  service: TaskService;
  authenticated: RequestHandler;
}): Router {
  const router = Router();
  // Mounted at /api: guard each route, so other /api paths are untouched.

  router.get('/agenda', authenticated, async (req, res) => {
    res.json(await service.agenda(authOf(res).userId, parseInput(agendaQuerySchema, req.query)));
  });

  router.post('/tasks', authenticated, async (req, res) => {
    res
      .status(201)
      .json(await service.create(authOf(res).userId, parseInput(createTaskInputSchema, req.body)));
  });

  router.patch('/tasks/:taskId', authenticated, async (req, res) => {
    res.json(
      await service.update(
        authOf(res).userId,
        req.params.taskId as string,
        parseInput(updateTaskInputSchema, req.body),
      ),
    );
  });

  router.delete('/tasks/:taskId', authenticated, async (req, res) => {
    await service.remove(authOf(res).userId, req.params.taskId as string);
    res.status(204).end();
  });

  router.put('/tasks/:taskId/completion', authenticated, async (req, res) => {
    res.json(await service.complete(authOf(res).userId, req.params.taskId as string));
  });

  router.delete('/tasks/:taskId/completion', authenticated, async (req, res) => {
    await service.uncomplete(authOf(res).userId, req.params.taskId as string);
    res.status(204).end();
  });

  return router;
}
