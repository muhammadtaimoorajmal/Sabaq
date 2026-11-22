import { Writable } from 'node:stream';
import { pino, type Logger } from 'pino';
import { loadConfig, type Config } from '../config/env.js';

/** A valid test configuration; individual tests override only what they exercise. */
export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({ NODE_ENV: 'test', ...env });
}

/** A logger that keeps every entry in memory so tests can assert on what was logged. */
export function memoryLogger(): { logger: Logger; entries: Record<string, unknown>[] } {
  const entries: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      entries.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { logger: pino({ level: 'trace' }, stream), entries };
}
