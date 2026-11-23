import { PASSWORD_MIN_LENGTH } from '@sabaq/shared';

export type StrengthScore = 0 | 1 | 2 | 3 | 4;
export type StrengthHint =
  'hintLength' | 'hintCommon' | 'hintPersonal' | 'hintPattern' | 'hintMore';

export interface Strength {
  score: StrengthScore;
  /** Advice for this password, most useful first. */
  hints: StrengthHint[];
}

/**
 * Frequently used passwords (compared after removing digits and symbols), including local
 * favourites. A small list catches most real-world guesses without a large download.
 */
const COMMON = new Set([
  'password',
  'passw',
  'qwerty',
  'qwertyuiop',
  'asdfgh',
  'asdfghjkl',
  'zxcvbnm',
  'abc',
  'abcdef',
  'letmein',
  'welcome',
  'iloveyou',
  'admin',
  'login',
  'monkey',
  'dragon',
  'football',
  'cricket',
  'baseball',
  'sunshine',
  'princess',
  'master',
  'shadow',
  'superman',
  'batman',
  'starwars',
  'whatever',
  'trustno',
  'freedom',
  'hello',
  'secret',
  'computer',
  'internet',
  'samsung',
  'google',
  'pakistan',
  'lahore',
  'karachi',
  'islamabad',
  'allah',
  'bismillah',
  'mashallah',
  'muhammad',
  'student',
  'university',
  'college',
  'school',
  'teacher',
  'sabaq',
  'changeme',
  'default',
  'test',
  'guest',
  'user',
  'love',
  'lovely',
  'money',
  'family',
  'india',
  'qwer',
  'zaq',
  'pass',
]);

const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

/** Runs of three identical characters, or four characters of a keyboard or alphabet sequence. */
function hasPattern(lower: string): boolean {
  if (/(.)\1\1/.test(lower)) return true;
  for (let index = 0; index + 4 <= lower.length; index += 1) {
    const chunk = lower.slice(index, index + 4);
    const reversed = [...chunk].reverse().join('');
    if (SEQUENCES.some((sequence) => sequence.includes(chunk) || sequence.includes(reversed))) {
      return true;
    }
  }
  return false;
}

/** Pieces of the person's name and e-mail address worth avoiding (three characters or more). */
function personalParts(personal: string[]): string[] {
  return personal
    .flatMap((value) => value.toLowerCase().split(/[^\p{L}\p{N}]+/u))
    .filter((part) => part.length >= 3);
}

/**
 * Estimates how hard a password is to guess, from 0 (too short) to 4 (strong). It rewards
 * length and variety, and penalizes common passwords, personal details and patterns. It never
 * demands particular kinds of characters: a long phrase of plain words is strong.
 */
export function passwordStrength(password: string, personal: string[] = []): Strength {
  if (password.length < PASSWORD_MIN_LENGTH) return { score: 0, hints: ['hintLength'] };
  const lower = password.toLowerCase();
  const hints: StrengthHint[] = [];

  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^a-zA-Z\d]/.test(password)) pool += 33;
  let bits = password.length * Math.log2(Math.max(pool, 10));

  const letters = lower.replace(/[^a-z]/g, '');
  if (COMMON.has(letters) || COMMON.has(lower)) {
    hints.push('hintCommon');
    bits = Math.min(bits, 30);
  }
  if (personalParts(personal).some((part) => lower.includes(part))) {
    hints.push('hintPersonal');
    bits -= 20;
  }
  if (hasPattern(lower)) {
    hints.push('hintPattern');
    bits -= 15;
  }

  const score: StrengthScore = bits < 35 ? 1 : bits < 50 ? 2 : bits < 65 ? 3 : 4;
  if (score < 4 && password.length < 14) hints.push('hintLength');
  if (score < 3 && hints.length === 0) hints.push('hintMore');
  return { score, hints };
}
