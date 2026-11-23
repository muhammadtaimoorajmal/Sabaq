import { describe, expect, it } from 'vitest';
import { classSubtitle, formatTime, timeZones } from './helpers';

describe('classSubtitle', () => {
  const base = {
    section: '5A',
    program: 'BS Computer Science',
    term: 'Fall 2026',
    institution: 'Northfield University',
  };

  it('leaves out what the class name already says, and empty parts', () => {
    expect(classSubtitle({ ...base, name: 'BS Computer Science · 5A' })).toBe(
      'Fall 2026 · Northfield University',
    );
    expect(classSubtitle({ ...base, name: 'Evening cohort', institution: null })).toBe(
      '5A · BS Computer Science · Fall 2026',
    );
  });
});

describe('formatTime', () => {
  it('follows the 12- or 24-hour preference', () => {
    expect(formatTime('14:05', 'en', '12h')).toBe('2:05 PM');
    expect(formatTime('14:05', 'en', '24h')).toBe('14:05');
  });
});

describe('timeZones', () => {
  it('always includes the requested zones and UTC, sorted', () => {
    const zones = timeZones('Asia/Karachi');
    expect(zones).toContain('Asia/Karachi');
    expect(zones).toContain('UTC');
    expect([...zones].sort((a, b) => a.localeCompare(b))).toEqual(zones);
  });
});
