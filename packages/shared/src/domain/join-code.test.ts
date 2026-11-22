import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatJoinCode,
  generateJoinCode,
  isValidJoinCode,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  normalizeJoinCode,
} from './join-code.js';

describe('generateJoinCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates valid codes with the secure random generator', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect(isValidJoinCode(code)).toBe(true);
    }
  });

  it('never uses look-alike characters', () => {
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });

  it('rejects biased bytes instead of wrapping them around', () => {
    const batches = [new Array<number>(16).fill(255), Array.from({ length: 16 }, (_, i) => i)];
    const randomBytes = (bytes: Uint8Array) => {
      bytes.set(batches.shift() ?? []);
      return bytes;
    };
    expect(generateJoinCode(randomBytes)).toBe('ABCDEFGH');
  });

  it('fails loudly when no secure generator exists', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => generateJoinCode()).toThrow('secure random');
  });
});

describe('normalizing and formatting', () => {
  it('accepts what people actually type', () => {
    expect(normalizeJoinCode(' k7mq-3xra ')).toBe('K7MQ3XRA');
    expect(isValidJoinCode('k7mq 3xra')).toBe(true);
  });

  it('rejects malformed codes', () => {
    expect(isValidJoinCode('K7MQ3XR')).toBe(false); // too short
    expect(isValidJoinCode('K7MQ3XRO')).toBe(false); // O is not in the alphabet
  });

  it('groups codes for display', () => {
    expect(formatJoinCode('k7mq3xra')).toBe('K7MQ-3XRA');
    expect(formatJoinCode('abc')).toBe('ABC');
  });
});
