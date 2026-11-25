import {
  avatarUploadSchema,
  deleteAccountInputSchema,
  preferencesUpdateSchema,
  profileUpdateSchema,
} from '@sabaq/shared';
import { type RequestHandler, Router } from 'express';
import { authOf } from '../auth/middleware.js';
import { REFRESH_COOKIE, refreshCookieOptions } from '../auth/routes.js';
import type { Config } from '../config/env.js';
import { parseInput } from '../lib/validate.js';
import type { AccountService } from './service.js';

/** The signed-in person's own account, mounted at `/api/account`. */
export function accountRouter({
  service,
  authenticated,
  config,
}: {
  service: AccountService;
  authenticated: RequestHandler;
  config: Pick<Config, 'isProduction'>;
}): Router {
  const router = Router();
  router.use(authenticated);

  router.patch('/profile', async (req, res) => {
    res.json(
      await service.updateProfile(authOf(res).userId, parseInput(profileUpdateSchema, req.body)),
    );
  });

  router.patch('/preferences', async (req, res) => {
    res.json(
      await service.updatePreferences(
        authOf(res).userId,
        parseInput(preferencesUpdateSchema, req.body),
      ),
    );
  });

  router.put('/avatar', async (req, res) => {
    const { image } = parseInput(avatarUploadSchema, req.body);
    res.json(await service.setAvatar(authOf(res).userId, image));
  });

  router.delete('/avatar', async (_req, res) => {
    res.json(await service.removeAvatar(authOf(res).userId));
  });

  router.post('/onboarding', async (_req, res) => {
    res.json(await service.completeOnboarding(authOf(res).userId));
  });

  router.get('/export', async (_req, res) => {
    const data = await service.exportData(authOf(res).userId);
    const day = data.exportedAt.slice(0, 10);
    res.attachment(`sabaq-data-${day}.json`).json(data);
  });

  router.delete('/', async (req, res) => {
    const { password } = parseInput(deleteAccountInputSchema, req.body);
    await service.deleteAccount(authOf(res).userId, password);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(config));
    res.status(204).end();
  });

  return router;
}

/**
 * Profile photos, mounted at `/api/users`. Public like any profile picture, but only reachable
 * through an address that changes with every upload, so they cannot be enumerated and each
 * one can be cached for a year.
 */
export function usersRouter({ service }: { service: AccountService }): Router {
  const router = Router();
  router.get('/:userId/avatar/:version', async (req, res) => {
    const avatar = await service.avatar(req.params.userId, req.params.version);
    res
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .type(avatar.contentType)
      .send(avatar.data);
  });
  return router;
}
