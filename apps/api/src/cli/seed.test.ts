import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMemoryDatabase } from '../db/memory.js';
import { runSeedCli } from './seed.js';

let memory: Awaited<ReturnType<typeof startMemoryDatabase>>;

beforeAll(async () => {
  memory = await startMemoryDatabase();
}, 120_000);

afterAll(async () => {
  await memory.stop();
});

function capture() {
  const lines: string[] = [];
  return {
    lines,
    output: {
      log: (message: string) => lines.push(message),
      error: (message: string) => lines.push(`error: ${message}`),
    },
  };
}

describe('runSeedCli', () => {
  it('explains how to configure the database when MONGODB_URI is missing', async () => {
    const { lines, output } = capture();
    expect(await runSeedCli([], { NODE_ENV: 'development' }, output)).toBe(1);
    expect(lines[0]).toContain('MONGODB_URI is not set');
  });

  it('reports invalid configuration', async () => {
    const { lines, output } = capture();
    expect(await runSeedCli([], { MONGODB_URI: 'http://nope' }, output)).toBe(1);
    expect(lines[0]).toContain('Invalid configuration');
  });

  it('seeds, refuses to seed twice, and starts over with --reset', async () => {
    const env = { NODE_ENV: 'development', MONGODB_URI: memory.uri, MONGODB_DB_NAME: 'seed_cli' };

    const first = capture();
    expect(await runSeedCli([], env, first.output)).toBe(0);
    const text = first.lines.join('\n');
    expect(text).toContain('✔ Seeded the demo institution into "seed_cli"');
    expect(text).toContain('zara.ahmed@northfield.example');
    expect(text).toContain('password: sabaq-demo');

    const second = capture();
    expect(await runSeedCli([], env, second.output)).toBe(1);
    expect(second.lines[0]).toContain('--reset');

    const reset = capture();
    expect(await runSeedCli(['--reset'], env, reset.output)).toBe(0);
    expect(reset.lines[0]).toBe('Deleted the existing Sabaq data in "seed_cli".');
  }, 60_000);

  it('reports a database it cannot reach', async () => {
    const { lines, output } = capture();
    const env = { MONGODB_URI: 'mongodb://127.0.0.1:9/sabaq' };
    const fastFailure = { attempts: 1, serverSelectionTimeoutMs: 200 };
    expect(await runSeedCli([], env, output, fastFailure)).toBe(1);
    expect(lines[0]).toBe(
      'error: Seeding failed: Could not connect to the database at mongodb://127.0.0.1:9/sabaq after 1 attempts',
    );
  });
});
