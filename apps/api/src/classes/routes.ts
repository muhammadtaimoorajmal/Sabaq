import {
  changeMemberRoleInputSchema,
  createClassInputSchema,
  createCourseInputSchema,
  joinClassInputSchema,
  updateClassInputSchema,
  updateCourseInputSchema,
} from '@sabaq/shared';
import { type Request, type RequestHandler, type Response, Router } from 'express';
import { authOf } from '../auth/middleware.js';
import { parseInput } from '../lib/validate.js';
import type { ClassService } from './service.js';

/**
 * Classes, members and courses, mounted at `/api/classes`. Every route needs a session, and
 * every class route checks membership and permissions in the service.
 */
export function classesRouter({
  service,
  authenticated,
}: {
  service: ClassService;
  authenticated: RequestHandler;
}): Router {
  const router = Router();
  router.use(authenticated);

  const access = (req: Request, res: Response) =>
    service.access(authOf(res).userId, req.params.classId as string);

  router.get('/', async (_req, res) => {
    res.json(await service.listForUser(authOf(res).userId));
  });

  router.post('/', async (req, res) => {
    res
      .status(201)
      .json(await service.create(authOf(res).userId, parseInput(createClassInputSchema, req.body)));
  });

  router.post('/join', async (req, res) => {
    const { code } = parseInput(joinClassInputSchema, req.body);
    const result = await service.join(authOf(res).userId, code);
    res.status(result.joined ? 201 : 200).json(result.class);
  });

  router.get('/:classId', async (req, res) => {
    res.json(await service.get(await access(req, res)));
  });

  router.patch('/:classId', async (req, res) => {
    res.json(
      await service.update(await access(req, res), parseInput(updateClassInputSchema, req.body)),
    );
  });

  router.delete('/:classId', async (req, res) => {
    await service.archive(await access(req, res));
    res.status(204).end();
  });

  router.post('/:classId/join-code', async (req, res) => {
    res.json(await service.regenerateJoinCode(await access(req, res)));
  });

  router.get('/:classId/members', async (req, res) => {
    res.json(await service.members(await access(req, res)));
  });

  router.patch('/:classId/members/:userId', async (req, res) => {
    const { role } = parseInput(changeMemberRoleInputSchema, req.body);
    res.json(await service.changeRole(await access(req, res), req.params.userId as string, role));
  });

  router.delete('/:classId/members/:userId', async (req, res) => {
    await service.removeMember(await access(req, res), req.params.userId as string);
    res.status(204).end();
  });

  router.get('/:classId/courses', async (req, res) => {
    res.json(await service.courses(await access(req, res)));
  });

  router.post('/:classId/courses', async (req, res) => {
    const input = parseInput(createCourseInputSchema, req.body);
    res.status(201).json(await service.createCourse(await access(req, res), input));
  });

  router.patch('/:classId/courses/:courseId', async (req, res) => {
    const input = parseInput(updateCourseInputSchema, req.body);
    res.json(
      await service.updateCourse(await access(req, res), req.params.courseId as string, input),
    );
  });

  router.delete('/:classId/courses/:courseId', async (req, res) => {
    await service.deleteCourse(await access(req, res), req.params.courseId as string);
    res.status(204).end();
  });

  return router;
}
