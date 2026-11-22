import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { mockApi, resetClient } from './api';

beforeEach(() => {
  // Every test starts signed out, with a healthy API; tests replace routes as needed.
  mockApi();
});

afterEach(() => {
  cleanup();
  resetClient();
  systemMedia.clear();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  for (const name of ['data-theme', 'data-density', 'data-motion', 'lang', 'dir']) {
    document.documentElement.removeAttribute(name);
  }
});

/** System settings the tests can change; read by the matchMedia stand-in below. */
export const systemMedia = new Map<string, boolean>();

// jsdom has no layout engine, so browser APIs that depend on it are replaced with stand-ins.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: systemMedia.get(query) ?? false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

class ResizeObserverStandIn {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver ??= ResizeObserverStandIn as unknown as typeof ResizeObserver;

Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= vi.fn();
