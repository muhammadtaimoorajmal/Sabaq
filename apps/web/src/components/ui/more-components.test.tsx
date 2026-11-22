import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { accessibilityViolations, renderWithProviders } from '../../test/render';
import {
  Avatar,
  Button,
  colorOf,
  DateTimeField,
  initialsOf,
  Sheet,
  SheetContent,
  SheetTrigger,
} from './index';

describe('Avatar', () => {
  it('shows initials with the name as its label', () => {
    renderWithProviders(<Avatar name="Zara Ahmed" />);
    expect(screen.getByRole('img', { name: 'Zara Ahmed' })).toHaveTextContent('ZA');
  });

  it('can be decorative when the name is shown beside it', () => {
    const { container } = renderWithProviders(<Avatar name="Zara Ahmed" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('ZA');
  });

  it('derives initials and a stable color from the name', () => {
    expect(initialsOf('Dr. Ayesha Siddiqui')).toBe('AS');
    expect(initialsOf('Zara')).toBe('Z');
    expect(initialsOf('  ')).toBe('?');
    expect(initialsOf('زارا احمد')).toBe('زا');
    expect(colorOf('Zara Ahmed')).toBe(colorOf('Zara Ahmed'));
  });
});

describe('Sheet', () => {
  it('opens as a labelled dialog and closes with Escape', async () => {
    const { user } = renderWithProviders(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Filters</Button>
        </SheetTrigger>
        <SheetContent title="Filter deadlines" footer={<Button>Apply</Button>}>
          Content
        </SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog', { name: 'Filter deadlines' })).toHaveAccessibleDescription(
      'Filter deadlines',
    );
    expect(await accessibilityViolations()).toEqual([]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DateTimeField', () => {
  const NOW = new Date('2026-11-22T10:00:00Z');

  it('sets a deadline in the class time zone with a quick choice and confirms it in words', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <DateTimeField
        label="Due"
        value={null}
        onChange={onChange}
        timeZone="Asia/Karachi"
        now={NOW}
      />,
    );
    expect(
      screen.getByText('Times are in the class time zone (Asia/Karachi).'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
    // 23:59 on 23 November in Karachi (UTC+5).
    expect(onChange).toHaveBeenLastCalledWith('2026-11-23T18:59:00.000Z');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-23');
    expect(screen.getByLabelText('Time')).toHaveValue('23:59');
  });

  it('shows the chosen moment and reports incomplete input as no value', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DateTimeField
        label="Due"
        hint="Students see it immediately."
        error="Choose a date in the future."
        value="2026-11-27T18:59:00.000Z"
        onChange={onChange}
        timeZone="Asia/Karachi"
        now={NOW}
      />,
    );
    expect(screen.getByText(/^Selected: Friday, November 27, 2026/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Due' })).toHaveAccessibleDescription(
      /Choose a date in the future\. Students see it immediately\. Selected:/,
    );
    expect(screen.getByLabelText('Date')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-01' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-12-01T18:59:00.000Z');
  });

  it('keeps the chosen time when picking another day', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <DateTimeField
        label="Due"
        value="2026-11-22T04:00:00.000Z"
        onChange={onChange}
        timeZone="Asia/Karachi"
        now={NOW}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'In a week' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-29T04:00:00.000Z');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-22T04:00:00.000Z');
  });
});
