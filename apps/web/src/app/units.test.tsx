import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { relativeTime } from '../pages/SettingsPage';
import { safeNext } from '../pages/auth/SignInPage';
import { greetingName, partOfDay } from '../pages/TodayPage';
import { AppErrorBoundary } from './App';

describe('safeNext', () => {
  it.each([
    ['/settings', '/settings'],
    ['/classes/1?tab=people', '/classes/1?tab=people'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    [null, '/'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});

describe('partOfDay', () => {
  it('uses the person’s own time zone', () => {
    const instant = new Date('2026-11-22T06:00:00Z');
    expect(partOfDay(instant, 'Asia/Karachi')).toBe('morning');
    expect(partOfDay(instant, 'Asia/Tokyo')).toBe('afternoon');
    expect(partOfDay(instant, 'America/New_York')).toBe('morning');
    expect(partOfDay(new Date('2026-11-22T14:00:00Z'), 'Asia/Karachi')).toBe('evening');
  });
});

describe('greetingName', () => {
  it.each([
    ['Zara Ahmed', 'Zara'],
    ['Dr. Ayesha Siddiqui', 'Dr. Ayesha'],
    ['Prof Imran Qureshi', 'Prof Imran'],
    ['Madonna', 'Madonna'],
    ['Dr.', 'Dr.'],
  ])('%s → %s', (name, expected) => {
    expect(greetingName(name)).toBe(expected);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-11-22T10:00:00Z');
  it('describes how long ago something happened, in the interface language', () => {
    expect(relativeTime('2026-11-22T09:59:40Z', 'en', now)).toBe('this minute');
    expect(relativeTime('2026-11-22T09:55:00Z', 'en', now)).toBe('5 minutes ago');
    expect(relativeTime('2026-11-22T07:00:00Z', 'en', now)).toBe('3 hours ago');
    expect(relativeTime('2026-11-21T10:00:00Z', 'en', now)).toBe('yesterday');
  });
});

describe('AppErrorBoundary', () => {
  it('replaces a crashed app with a bilingual reload message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    function Crash(): never {
      throw new Error('boom');
    }
    render(
      <AppErrorBoundary>
        <Crash />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Sabaq could not start');
    await userEvent.click(screen.getByRole('button', { name: /Reload/ }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('renders children when nothing fails', () => {
    render(
      <AppErrorBoundary>
        <p>Fine</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Fine')).toBeInTheDocument();
  });
});
