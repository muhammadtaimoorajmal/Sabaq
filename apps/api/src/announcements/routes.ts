import {
  announcementFeedQuerySchema,
  createAnnouncementInputSchema,
  markSeenInputSchema,
  updateAnnouncementInputSchema,
} from '@sabaq/shared';
import { type Request, type RequestHandler, type Response, Router } from 'express';
import { authOf } from '../auth/middleware.js';
import type { ClassService } from '../classes/service.js';
import { parseInput } from '../lib/validate.js';
import type { AnnouncementService } from './service.js';

/** The person's announcement feed across all their classes, mounted at `/api/announcements`. */
export function announcementFeedRouter({
  service,
  authenticated,
}: {
  service: AnnouncementService;
  authenticated: RequestHandler;
}): Router {
  const router = Router();
  router.use(authenticated);

  router.get('/', async (req, res) => {
    res.json(
      await service.feed(authOf(res).userId, parseInput(announcementFeedQuerySchema, req.query)),
    );
  });

  router.get('/unread', async (_req, res) => {
    res.json(await service.unreadCount(authOf(res).userId));
  });

  router.post('/seen', async (req, res) => {
    await service.markSeen(authOf(res).userId, parseInput(markSeenInputSchema, req.body).ids);
    res.status(204).end();
  });

  return router;
}

/** Posting and managing announcements, mounted at `/api/classes/:classId/announcements`. */
export function classAnnouncementsRouter({
  service,
  classes,
  authenticated,
}: {
  service: AnnouncementService;
  classes: ClassService;
  authenticated: RequestHandler;
}): Router {
  const router = Router({ mergeParams: true });
  router.use(authenticated);
  const access = (req: Request, res: Response) =>
    classes.access(authOf(res).userId, req.params.classId as string);
  const id = (req: Request) => req.params.announcementId as string;

  router.post('/', async (req, res) => {
    res
      .status(201)
      .json(
        await service.create(
          await access(req, res),
          parseInput(createAnnouncementInputSchema, req.body),
        ),
      );
  });

  router.patch('/:announcementId', async (req, res) => {
    res.json(
      await service.update(
        await access(req, res),
        id(req),
        parseInput(updateAnnouncementInputSchema, req.body),
      ),
    );
  });

  router.delete('/:announcementId', async (req, res) => {
    await service.remove(await access(req, res), id(req));
    res.status(204).end();
  });

  router.get('/:announcementId/receipts', async (req, res) => {
    res.json(await service.receipts(await access(req, res), id(req)));
  });

  return router;
}
