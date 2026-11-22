import type { PreferencesUpdate } from '@sabaq/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLink } from '../components/ui';
import { DesignSystemPage } from './DesignSystemPage';
import { accessibilityViolations, renderWithProviders } from '../test/render';

function Page() {
  return (
    <>
      <SkipLink />
      <DesignSystemPage />
    </>
  );
}

describe('design system page', () => {
  it.each<[string, PreferencesUpdate]>([
    ['light', { theme: 'light' }],
    ['dark', { theme: 'dark', density: 'compact' }],
    ['high contrast', { theme: 'high-contrast', textScale: 1.5 }],
    ['Urdu, right to left', { language: 'ur' }],
  ])('has no detectable accessibility violations (%s)', async (_name, preferences) => {
    renderWithProviders(<Page />, preferences);
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('starts with a skip link to the main content', async () => {
    const { user } = renderWithProviders(<Page />);
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('applies display settings to the whole page immediately', async () => {
    const { user } = renderWithProviders(<Page />);
    const root = document.documentElement;

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(root.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Larger text' }));
    expect(root.style.getPropertyValue('--text-scale')).toBe('1.125');
    expect(screen.getByText('113%')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(root.dataset.density).toBe('compact');

    await user.click(screen.getByRole('radio', { name: 'Reduce' }));
    expect(root.dataset.motion).toBe('reduce');

    await user.click(screen.getByRole('radio', { name: 'اردو (Urdu)' }));
    expect(root.lang).toBe('ur');
    expect(root.dir).toBe('rtl');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ڈیزائن سسٹم' }),
    ).toBeInTheDocument();

    expect(JSON.parse(localStorage.getItem('sabaq.preferences') ?? '{}')).toMatchObject({
      theme: 'dark',
      density: 'compact',
      language: 'ur',
    });
  });

  it('validates the sample form and lists every problem', async () => {
    const { user } = renderWithProviders(<Page />);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('There are 3 problems to fix');
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText(/Full name/), 'Zara Ahmed');
    await user.type(screen.getByLabelText(/E-mail address/), 'zara@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText(/^Saved\./).closest('[role="status"]')).not.toBeNull();
  });

  it('shows a busy state on the sample submit button', async () => {
    const { user } = renderWithProviders(<Page />);
    const [submit] = screen.getAllByRole('button', { name: 'Submit' });
    await user.click(submit as HTMLElement);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('clamps the text size to the supported range', async () => {
    const { user } = renderWithProviders(<Page />, { textScale: 1.5 });
    expect(screen.getByRole('button', { name: 'Larger text' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reset text size' }));
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1');
  });
});
