import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('hashes with Argon2id and a unique salt, and verifies only the right password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(first, 'Correct horse battery staple')).toBe(false);
  });

  it('treats a malformed hash as a failed check instead of an error', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});
