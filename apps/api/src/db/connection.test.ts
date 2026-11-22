import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { memoryLogger } from '../test/helpers.js';
import { useTestDatabase } from '../test/database.js';
import {
  connectDatabase,
  databaseHealthCheck,
  disconnectDatabase,
  ensureIndexes,
  redactUri,
} from './connection.js';
import { UserModel } from './models/index.js';

describe('redactUri', () => {
  it.each([
    [
      'mongodb+srv://sabaq-app:s3cret@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority',
      'mongodb+srv://cluster0.abcde.mongodb.net/',
    ],
    ['mongodb://127.0.0.1:27017/sabaq', 'mongodb://127.0.0.1:27017/sabaq'],
    ['mongodb://user:p%40ss@a:1,b:2/db?replicaSet=rs0', 'mongodb://a:1,b:2/db'],
  ])('hides credentials and options in %s', (uri, expected) => {
    expect(redactUri(uri)).toBe(expected);
  });
});

describe('connectDatabase', () => {
  const database = useTestDatabase();

  it('retries with growing delays, then gives up with a clear message', async () => {
    await mongoose.disconnect();
    const { logger, entries } = memoryLogger();
    const sleep = vi.fn(() => Promise.resolve());

    await expect(
      connectDatabase({
        uri: 'mongodb://user:secret@127.0.0.1:9/sabaq',
        dbName: 'sabaq',
        logger,
        attempts: 3,
        retryDelayMs: 100,
        serverSelectionTimeoutMs: 200,
        sleep,
      }),
    ).rejects.toThrow(
      'Could not connect to the database at mongodb://127.0.0.1:9/sabaq after 3 attempts',
    );

    expect(sleep.mock.calls).toEqual([[100], [200]]);
    const warnings = entries.filter(
      (entry) => entry.msg === 'Database connection failed; retrying',
    );
    expect(warnings).toHaveLength(2);
    expect(JSON.stringify(entries)).not.toContain('secret');
  });

  it('connects, creates indexes, reports health and logs connection changes', async () => {
    const { logger, entries } = memoryLogger();
    await connectDatabase({ uri: database.uri(), dbName: 'sabaq_test', logger });
    await expect(databaseHealthCheck.check()).resolves.toBeUndefined();

    const indexes = await UserModel.collection.indexes();
    expect(indexes.some((index) => index.key.email === 1 && index.unique)).toBe(true);
    await expect(ensureIndexes()).resolves.toBeUndefined();

    await disconnectDatabase(logger);
    await expect(databaseHealthCheck.check()).rejects.toThrow('Not connected');
    const messages = entries.map((entry) => entry.msg);
    expect(messages).toContain('Connected to the database');
    expect(messages).toContain('Database connection lost');
    expect(messages).toContain('Disconnected from the database');

    // Reconnecting reuses the existing listeners instead of adding duplicates.
    await connectDatabase({ uri: database.uri(), dbName: 'sabaq_test', logger });
    expect(mongoose.connection.listenerCount('disconnected')).toBe(1);
  });
});
