import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { memoryLogger } from '../test/helpers.js';
import { startMemoryDatabase } from './memory.js';
import { UserModel } from './models/index.js';
import { DEMO_STUDENT } from './seed/demo-data.js';
import { setUpDatabase } from './setup.js';

describe('setUpDatabase', () => {
  let external: Awaited<ReturnType<typeof startMemoryDatabase>>;

  beforeAll(async () => {
    external = await startMemoryDatabase();
  }, 120_000);

  afterAll(async () => {
    await external.stop();
  });

  it('connects to the configured database and disconnects on shutdown', async () => {
    const { logger } = memoryLogger();
    const hooks = await setUpDatabase({ database: { uri: external.uri, name: 'setup' } }, logger);
    expect(mongoose.connection.name).toBe('setup');
    expect(await UserModel.countDocuments()).toBe(0);
    for (const hook of hooks) await hook();
    expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.disconnected);
  });

  it('starts a temporary database with demo data when none is configured', async () => {
    const { logger, entries } = memoryLogger();
    const hooks = await setUpDatabase({ database: { uri: null, name: 'sabaq' } }, logger);
    expect(await UserModel.exists({ email: DEMO_STUDENT.email })).not.toBeNull();
    expect(entries.map((entry) => entry.msg)).toContain('Demo data is ready');
    for (const hook of hooks) await hook();
    expect(hooks).toHaveLength(2);
  }, 120_000);
});
