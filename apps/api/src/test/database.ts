import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { ensureIndexes } from '../db/connection.js';
import { startMemoryDatabase } from '../db/memory.js';
import { ALL_MODELS } from '../db/models/index.js';

/**
 * Gives a test file its own in-memory MongoDB with every index created, and empties all
 * collections after each test. Needs no network access once the MongoDB binary is cached.
 */
export function useTestDatabase(): { uri: () => string } {
  let memory: Awaited<ReturnType<typeof startMemoryDatabase>> | undefined;

  beforeAll(async () => {
    memory = await startMemoryDatabase();
    await mongoose.connect(memory.uri, { dbName: 'sabaq_test' });
    await ensureIndexes();
  }, 120_000);

  afterEach(async () => {
    if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
      await Promise.all(ALL_MODELS.map((model) => model.deleteMany()));
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await memory?.stop();
  });

  return {
    uri: () => {
      if (!memory) throw new Error('The test database has not started yet');
      return memory.uri;
    },
  };
}
