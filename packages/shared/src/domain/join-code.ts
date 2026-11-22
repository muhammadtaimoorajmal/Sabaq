/**
 * Class join codes are read aloud, written on whiteboards and typed on phones, so the
 * alphabet leaves out characters that are easily confused: 0/O, 1/I/L.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;

const JOIN_CODE_PATTERN = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`);

/** Fills a byte array with cryptographically secure random values. */
export type RandomBytes = (bytes: Uint8Array) => Uint8Array;

const secureRandomBytes: RandomBytes = (bytes) => {
  const { crypto } = globalThis as {
    crypto?: { getRandomValues: (array: Uint8Array) => Uint8Array };
  };
  if (!crypto) throw new Error('A secure random number generator is not available');
  return crypto.getRandomValues(bytes);
};

/**
 * Generates a new join code such as `K7MQ3XRA`. Uses rejection sampling so every
 * character is equally likely (no modulo bias).
 */
export function generateJoinCode(randomBytes: RandomBytes = secureRandomBytes): string {
  const alphabetSize = JOIN_CODE_ALPHABET.length;
  const limit = 256 - (256 % alphabetSize);
  let code = '';
  while (code.length < JOIN_CODE_LENGTH) {
    for (const byte of randomBytes(new Uint8Array(JOIN_CODE_LENGTH * 2))) {
      if (byte < limit && code.length < JOIN_CODE_LENGTH) {
        code += JOIN_CODE_ALPHABET.charAt(byte % alphabetSize);
      }
    }
  }
  return code;
}

/** Accepts whatever a person typed (lower case, spaces, dashes) and returns the canonical code. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z\d]/g, '');
}

/** True when the input, once normalized, is a well-formed join code. */
export function isValidJoinCode(input: string): boolean {
  return JOIN_CODE_PATTERN.test(normalizeJoinCode(input));
}

/** Groups a code for display, for example `K7MQ-3XRA`. */
export function formatJoinCode(code: string): string {
  const normalized = normalizeJoinCode(code);
  const half = JOIN_CODE_LENGTH / 2;
  return normalized.length === JOIN_CODE_LENGTH
    ? `${normalized.slice(0, half)}-${normalized.slice(half)}`
    : normalized;
}
