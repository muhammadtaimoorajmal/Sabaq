import { screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { routes } from '../app/routes';
import { formatDay, monthGrid, startOfWeek, weekRange } from '../lib/calendar';
import { json, mockApi, session, TEST_USER } from '../test/api';
import { renderWithProviders } from '../test/render';
import {
  CACHE_KEY,
  clearOfflineData,
  loadOfflineUser,
  OFFLINE_USER_KEY,
  persistOptions,
  saveOfflineUser,
} from './offline';

afterEach(() => {
  window.localStorage.clear();
});

/** A storage whose every call fails, as in some private browsing modes. */
const brokenStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
} as unknown as Storage;

describe('offline data', () => {
  it('remembers the signed-in person, and forgets everything on request', () => {
    saveOfflineUser(TEST_USER);
    window.localStorage.setItem(CACHE_KEY, '{}');
    expect(loadOfflineUser()).toEqual(TEST_USER);
    clearOfflineData();
    expect(loadOfflineUser()).toBeNull();
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('copes with storage that refuses every call', () => {
    expect(() => saveOfflineUser(TEST_USER, brokenStorage)).not.toThrow();
    expect(loadOfflineUser(brokenStorage)).toBeNull();
    expect(() => clearOfflineData(brokenStorage)).not.toThrow();
  });

  it('keeps only successful agenda, class and announcement answers', () => {
    const { dehydrateOptions } = persistOptions(window.localStorage, 'build-1');
    const keep = dehydrateOptions?.shouldDehydrateQuery as (query: unknown) => boolean;
    const query = (key: string, status = 'success') => ({ queryKey: [key], state: { status } });
    expect(keep(query('agenda'))).toBe(true);
    expect(keep(query('classes'))).toBe(true);
    expect(keep(query('announcements'))).toBe(true);
    expect(keep(query('sessions'))).toBe(false);
    expect(keep(query('agenda', 'error'))).toBe(false);
  });
});

describe('opening without a connection', () => {
  const offlineRefresh = () => {
    throw new TypeError('Failed to fetch');
  };

  it('opens with the remembered person', async () => {
    window.localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(TEST_USER));
    mockApi({ 'POST /api/auth/refresh': offlineRefresh, 'GET /api/agenda': offlineRefresh });
    renderWithProviders(<App router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
    expect(await screen.findByRole('heading', { level: 1, name: /Zara/ })).toBeInTheDocument();
  });

  it('asks to sign in when nobody is remembered', async () => {
    mockApi({ 'POST /api/auth/refresh': offlineRefresh });
    renderWithProviders(<App router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('remembers the person after signing in, and forgets them when the session ends', async () => {
    mockApi({ 'POST /api/auth/refresh': () => json(200, session()) });
    renderWithProviders(<App router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
    await screen.findByRole('heading', { level: 1, name: /Zara/ });
    expect(loadOfflineUser()?.id).toBe(TEST_USER.id);
  });
});

describe('calendar', () => {
  it('finds the start of a week for any first weekday', () => {
    // Thursday 26 November 2026.
    expect(startOfWeek('2026-11-26', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-26', 0)).toBe('2026-11-22');
    expect(startOfWeek('2026-11-26', 6)).toBe('2026-11-21');
    expect(weekRange('2026-11-26', 1)).toMatchObject({ from: '2026-11-23', to: '2026-11-29' });
  });

  it('builds whole weeks around a month', () => {
    const grid = monthGrid('2026-02-10', 1);
    expect(grid).toMatchObject({ from: '2026-01-26', to: '2026-03-01', month: '2026-02' });
    expect(grid.weeks).toHaveLength(5);
    expect(grid.weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('writes days in the interface language', () => {
    expect(formatDay('2026-11-26', 'en')).toBe('Thursday, November 26');
    expect(formatDay('2026-11-26', 'en', { month: 'long', year: 'numeric' })).toBe('November 2026');
  });
});
