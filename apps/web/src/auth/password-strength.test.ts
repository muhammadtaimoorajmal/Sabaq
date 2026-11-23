import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password-strength';

describe('passwordStrength', () => {
  it('asks for more length below the minimum', () => {
    expect(passwordStrength('short')).toEqual({ score: 0, hints: ['hintLength'] });
  });

  it('flags common passwords, even with digits and symbols added', () => {
    for (const password of ['password', 'Password123!', 'pakistan1947', 'qwertyuiop']) {
      const result = passwordStrength(password);
      expect(result.score, password).toBe(1);
      expect(result.hints, password).toContain('hintCommon');
    }
  });

  it('flags the person’s own name and e-mail address', () => {
    const result = passwordStrength('zaraahmed2026', ['Zara Ahmed', 'zara.ahmed@example.com']);
    expect(result.hints).toContain('hintPersonal');
    expect(result.score).toBeLessThanOrEqual(2);
  });

  it('flags repeats and sequences', () => {
    expect(passwordStrength('Kx9aaaaa!m').hints).toContain('hintPattern');
    expect(passwordStrength('Tq7x1234zR').hints).toContain('hintPattern');
    expect(passwordStrength('Tq7x4321zR').hints).toContain('hintPattern');
  });

  it('rates a long phrase of plain words as strong, without symbols or capitals', () => {
    expect(passwordStrength('correct horse battery staple')).toEqual({ score: 4, hints: [] });
  });

  it('grows with length and variety', () => {
    const scores = ['mkvtrpln', 'mkvtrplnqdxz', 'Mk7vtrplnQ!', 'Mk7vtr pln Qw!x zy'].map(
      (password) => passwordStrength(password).score,
    );
    expect(scores).toEqual([2, 3, 4, 4]);
  });

  it('suggests more length for short passwords and another word for long, simple ones', () => {
    expect(passwordStrength('mkvtrpln')).toEqual({ score: 2, hints: ['hintLength'] });
    expect(passwordStrength('19283746')).toEqual({ score: 1, hints: ['hintLength'] });
    expect(passwordStrength('19283746501928')).toEqual({ score: 2, hints: ['hintMore'] });
  });
});
