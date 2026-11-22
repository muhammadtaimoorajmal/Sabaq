import type { Logger } from 'pino';
import type { Config } from '../config/env.js';
import { hashPassword } from '../lib/password.js';
import type { ShutdownHook } from '../server.js';
import { connectDatabase, disconnectDatabase } from './connection.js';
import { startMemoryDatabase } from './memory.js';
import { DEMO_PASSWORD, DEMO_STUDENT } from './seed/demo-data.js';
import { seedDemoData } from './seed/seed.js';

/**
 * Connects to the configured database. Without MONGODB_URI (never allowed in production),
 * starts a temporary in-memory database filled with demo data, so `npm run dev:api` works
 * without any account or installation.
 */
export async function setUpDatabase(
  config: Pick<Config, 'database'>,
  logger: Logger,
): Promise<ShutdownHook[]> {
  const { uri, name } = config.database;
  const disconnect = () => disconnectDatabase(logger);

  if (uri) {
    await connectDatabase({ uri, dbName: name, logger });
    return [disconnect];
  }

  logger.warn(
    'MONGODB_URI is not set: using a temporary in-memory database with demo data. Changes are lost when the server stops.',
  );
  const memory = await startMemoryDatabase();
  await connectDatabase({ uri: memory.uri, dbName: name, logger });
  await seedDemoData({ passwordHash: await hashPassword(DEMO_PASSWORD) });
  logger.info({ email: DEMO_STUDENT.email, password: DEMO_PASSWORD }, 'Demo data is ready');
  return [disconnect, memory.stop];
}
