/**
 * Fills the configured database with the demo institution.
 *
 *   npm run db:seed -w @sabaq/api            seed an empty database
 *   npm run db:seed -w @sabaq/api -- --reset delete Sabaq's data first, then seed
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { pino } from 'pino';
import { ConfigError, loadConfig, type Config } from '../config/env.js';
import { connectDatabase, type DatabaseOptions, redactUri } from '../db/connection.js';
import {
  DEMO_ADMIN,
  DEMO_CLASS_REP,
  DEMO_INSTRUCTOR,
  DEMO_PASSWORD,
  DEMO_STUDENT,
} from '../db/seed/demo-data.js';
import { prepareForSeed, seedDemoData } from '../db/seed/seed.js';
import { hashPassword } from '../lib/password.js';

export interface CliOutput {
  log: (message: string) => void;
  error: (message: string) => void;
}

export const DEMO_ACCOUNTS = [
  ['Student', DEMO_STUDENT.email],
  ['Class representative', DEMO_CLASS_REP.email],
  ['Instructor', DEMO_INSTRUCTOR.email],
  ['Administrator', DEMO_ADMIN.email],
] as const;

/** Runs the seed command and returns the process exit code. */
export async function runSeedCli(
  args: string[],
  env: Record<string, string | undefined>,
  output: CliOutput,
  connection: Pick<DatabaseOptions, 'attempts' | 'serverSelectionTimeoutMs'> = { attempts: 3 },
): Promise<number> {
  let config: Config;
  try {
    config = loadConfig(env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    output.error(error.message);
    return 1;
  }
  const { uri, name } = config.database;
  if (!uri) {
    output.error(
      'MONGODB_URI is not set. Put your connection string in apps/api/.env (see .env.example).',
    );
    return 1;
  }

  try {
    await connectDatabase({ uri, dbName: name, logger: pino({ level: 'silent' }), ...connection });
    const prepared = await prepareForSeed({ reset: args.includes('--reset') });
    if (!prepared.ok) {
      output.error(prepared.reason);
      return 1;
    }
    if (prepared.cleared) output.log(`Deleted the existing Sabaq data in "${name}".`);

    const summary = await seedDemoData({ passwordHash: await hashPassword(DEMO_PASSWORD) });
    output.log(`✔ Seeded the demo institution into "${name}" at ${redactUri(uri)}`);
    output.log(
      Object.entries(summary)
        .map(([collection, count]) => `  ${collection.padEnd(14)} ${count}`)
        .join('\n'),
    );
    output.log(`\nDemo accounts (password: ${DEMO_PASSWORD}):`);
    output.log(DEMO_ACCOUNTS.map(([role, email]) => `  ${role.padEnd(22)} ${email}`).join('\n'));
    return 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    output.error(`Seeding failed: ${detail}`);
    return 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runSeedCli(process.argv.slice(2), process.env, console);
}
