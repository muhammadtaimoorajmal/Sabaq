import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id (the library default) with the parameters OWASP recommends:
 * 19 MiB of memory, 2 iterations, 1 degree of parallelism.
 */
export const PASSWORD_HASH_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_OPTIONS);
}

/** Returns `false` for a wrong password and for a malformed hash; never throws. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
