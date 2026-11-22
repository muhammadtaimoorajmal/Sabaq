import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(import.meta.dirname, 'index.css'), 'utf8');

/** The custom properties declared for one theme. */
function themeTokens(theme: string): Record<string, string> {
  const block = new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!block) throw new Error(`No block for theme ${theme}`);
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]),
  );
}

/** WCAG 2.2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Pairs that appear together in the interface: [foreground, background, minimum ratio]. */
const TEXT = 4.5;
const NON_TEXT = 3;
const PAIRS: [string, string, number][] = [
  ['text', 'canvas', TEXT],
  ['text', 'surface', TEXT],
  ['text', 'surface-sunken', TEXT],
  ['text-muted', 'surface', TEXT],
  ['text-muted', 'canvas', TEXT],
  ['text-muted', 'surface-sunken', TEXT],
  ['primary-fg', 'primary', TEXT],
  ['primary-fg', 'primary-hover', TEXT],
  ['primary-text', 'surface', TEXT],
  ['primary-text', 'canvas', TEXT],
  ['primary-text', 'primary-soft', TEXT],
  ['danger-fg', 'danger', TEXT],
  ['danger-text', 'surface', TEXT],
  ['danger-text', 'danger-soft', TEXT],
  ['warning-text', 'surface', TEXT],
  ['warning-text', 'warning-soft', TEXT],
  ['success-text', 'surface', TEXT],
  ['success-text', 'success-soft', TEXT],
  ['text', 'primary-soft', TEXT],
  ['text', 'danger-soft', TEXT],
  ['border-strong', 'surface', NON_TEXT],
  ['border-strong', 'canvas', NON_TEXT],
  ['focus', 'canvas', NON_TEXT],
  ['focus', 'surface', NON_TEXT],
  ['primary', 'surface', NON_TEXT],
];

const COURSES = [
  'blue',
  'teal',
  'green',
  'lime',
  'amber',
  'orange',
  'red',
  'pink',
  'purple',
  'indigo',
  'slate',
];

describe.each([
  ['light', 1],
  ['dark', 1],
  // High contrast meets the enhanced level (WCAG 1.4.6): 7:1 for text.
  ['high-contrast', 7 / 4.5],
])('the %s theme', (theme, factor) => {
  const tokens = themeTokens(theme);

  it.each(PAIRS)('%s on %s meets its contrast minimum', (foreground, background, minimum) => {
    const fg = tokens[foreground];
    const bg = tokens[background];
    expect(fg, `--${foreground} is missing`).toBeDefined();
    expect(bg, `--${background} is missing`).toBeDefined();
    const required = minimum === TEXT ? minimum * factor : minimum;
    expect(contrast(fg as string, bg as string)).toBeGreaterThanOrEqual(required);
  });

  it('keeps avatar initials (canvas color) readable on every course color', () => {
    for (const course of COURSES) {
      expect(
        contrast(tokens.canvas as string, tokens[`course-${course}`] as string),
        course,
      ).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('gives every course color enough contrast to be told apart from the surface', () => {
    for (const course of COURSES) {
      expect(
        contrast(tokens[`course-${course}`] as string, tokens.surface as string),
      ).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });
});

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
