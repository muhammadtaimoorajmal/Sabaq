import { Router } from 'express';
import type { OutboxMessage } from '../mail/mailer.js';

/**
 * Development-only helpers, never mounted in production: `GET /dev/mail` lists the e-mails the
 * API would have sent (optionally filtered with `?to=`), so verification and password links
 * can be followed locally and in end-to-end tests.
 */
export function devRouter({ outbox }: { outbox: OutboxMessage[] }): Router {
  const router = Router();
  router.get('/dev/mail', (req, res) => {
    const to = typeof req.query.to === 'string' ? req.query.to.toLowerCase() : null;
    res.json(to ? outbox.filter((message) => message.to === to) : outbox);
  });
  return router;
}
