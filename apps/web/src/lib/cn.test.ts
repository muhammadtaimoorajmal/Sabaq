import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('keeps theme-aware border widths next to border colors', () => {
    expect(cn('border-default border-border-strong')).toBe('border-default border-border-strong');
    expect(cn('border-b-default border-border', 'border-t-default border-e-default')).toBe(
      'border-b-default border-border border-t-default border-e-default',
    );
  });

  it('lets later classes override conflicting earlier ones', () => {
    expect(cn('h-control px-4', 'h-9')).toBe('px-4 h-9');
    expect(cn('border-default', 'border-2')).toBe('border-2');
    expect(cn('bg-primary', false, undefined, 'bg-danger')).toBe('bg-danger');
  });
});
