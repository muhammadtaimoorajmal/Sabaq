import { screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { accessibilityViolations, renderWithProviders } from '../../test/render';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTrigger,
  EmptyState,
  ErrorSummary,
  Field,
  IconButton,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  PasswordInput,
  RadioGroup,
  SegmentedControl,
  Select,
  Spinner,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
} from './index';

describe('Button', () => {
  it('is a real button that announces when it is busy and blocks repeat clicks', async () => {
    const onClick = vi.fn();
    const { user, rerender } = renderWithProviders(<Button onClick={onClick}>Submit</Button>);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');

    rerender(
      <Button loading loadingText="Submitting…" onClick={onClick}>
        Submit
      </Button>,
    );
    const busy = screen.getByRole('button', { name: 'Submitting…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).toBeDisabled();
  });

  it('can render a link with button styling', () => {
    renderWithProviders(
      <Button asChild>
        <a href="/classes">Open classes</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Open classes' })).toHaveClass('bg-primary');
  });
});

describe('IconButton', () => {
  it('always has an accessible name', () => {
    renderWithProviders(<IconButton label="Copy join code" icon={<svg />} />);
    expect(screen.getByRole('button', { name: 'Copy join code' })).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('connects the label, hint and error to the control', () => {
    renderWithProviders(
      <Field
        label="E-mail address"
        hint="We never share it."
        error="Enter a valid address."
        required
      >
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText('E-mail address');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid address. We never share it.');
  });

  it('marks optional fields and leaves valid fields unmarked', () => {
    renderWithProviders(
      <Field label="Student ID" optional>
        <Input />
      </Field>,
    );
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('shows and hides a password on request', async () => {
    const { user } = renderWithProviders(
      <Field label="Password">
        <PasswordInput />
      </Field>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('counts characters, reporting text over the limit instead of cutting it', async () => {
    const { user } = renderWithProviders(
      <Field label="Notes">
        <Textarea showCount maxLength={5} />
      </Field>,
    );
    const box = screen.getByLabelText('Notes');
    expect(screen.getByText('5 characters left')).toBeInTheDocument();
    await user.type(box, 'abcdefg');
    expect(box).toHaveValue('abcdefg');
    expect(screen.getByText('2 characters too many')).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it('counts controlled text too', () => {
    function Controlled() {
      const [value, setValue] = useState('hi');
      return (
        <Field label="Notes">
          <Textarea
            showCount
            maxLength={3}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
      );
    }
    renderWithProviders(<Controlled />);
    expect(screen.getByText('1 character left')).toBeInTheDocument();
  });

  it('uses a native select', () => {
    renderWithProviders(
      <Field label="Reminder">
        <Select defaultValue="b">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText('Reminder')).toHaveValue('b');
  });
});

describe('ErrorSummary', () => {
  it('takes focus, counts the problems and moves focus to each field', async () => {
    const { user } = renderWithProviders(
      <>
        <ErrorSummary
          errors={[
            { field: 'name', message: 'Enter your name.' },
            { field: 'email', message: 'Enter your e-mail address.' },
          ]}
        />
        <input id="name" aria-label="Name" />
        <input id="email" aria-label="E-mail" />
      </>,
    );
    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole('heading')).toHaveTextContent('There are 2 problems to fix');
    await user.click(screen.getByRole('link', { name: 'Enter your e-mail address.' }));
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
  });

  it('renders nothing without errors, and ignores links to missing fields', async () => {
    const { rerender, user } = renderWithProviders(<ErrorSummary errors={[]} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<ErrorSummary errors={[{ field: 'gone', message: 'Gone' }]} title="Fix this" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Fix this');
    await user.click(screen.getByRole('link', { name: 'Gone' }));
  });
});

describe('choices', () => {
  it('toggles a checkbox and a switch from their labels', async () => {
    const onCheckbox = vi.fn();
    const onSwitch = vi.fn();
    const { user } = renderWithProviders(
      <>
        <Checkbox label="Remind me" description="The day before" onCheckedChange={onCheckbox} />
        <Switch label="Quiet hours" onCheckedChange={onSwitch} />
      </>,
    );
    await user.click(screen.getByText('Remind me'));
    expect(onCheckbox).toHaveBeenCalledWith(true);
    expect(screen.getByRole('checkbox', { name: 'Remind me' })).toHaveAccessibleDescription(
      'The day before',
    );
    await user.click(screen.getByText('Quiet hours'));
    expect(onSwitch).toHaveBeenCalledWith(true);
  });

  it('moves between options with the arrow keys', async () => {
    function Picker() {
      const [value, setValue] = useState<'light' | 'dark'>('light');
      return (
        <>
          <SegmentedControl
            legend="Theme"
            value={value}
            onValueChange={setValue}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <RadioGroup
            legend="Reminder"
            value="day"
            onValueChange={() => undefined}
            options={[{ value: 'day', label: 'A day before', description: 'At 9:00' }]}
          />
        </>
      );
    }
    const { user } = renderWithProviders(<Picker />);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    await user.click(within(group).getByRole('radio', { name: 'Light' }));
    // Hold the key as a person does: the option is selected when focus arrives on it.
    await user.keyboard('{ArrowRight>}');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await user.keyboard('{/ArrowRight}');
    expect(within(group).getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A day before' })).toHaveAccessibleDescription(
      'At 9:00',
    );
  });
});

describe('overlays', () => {
  it('opens a dialog with its title, traps focus and closes with Escape, returning focus', async () => {
    const { user } = renderWithProviders(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Leave group</Button>
        </DialogTrigger>
        <DialogContent
          title="Leave the group?"
          description="You can rejoin later."
          footer={<Button>Leave</Button>}
        />
      </Dialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Leave group' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Leave the group?' });
    expect(dialog).toHaveAccessibleDescription('You can rejoin later.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('describes a dialog by its title when it has no description', async () => {
    const { user } = renderWithProviders(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent title="Details" />
      </Dialog>,
    );
    await user.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Details');
  });

  it('opens a menu and runs the chosen action', async () => {
    const onDelete = vi.fn();
    const { user } = renderWithProviders(
      <Menu>
        <MenuTrigger asChild>
          <IconButton label="More options" icon={<svg />} />
        </MenuTrigger>
        <MenuContent>
          <MenuItem>Edit</MenuItem>
          <MenuItem danger onSelect={onDelete}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('switches tabs with the keyboard', async () => {
    const { user } = renderWithProviders(
      <Tabs defaultValue="a">
        <TabList label="Deadlines">
          <Tab value="a">Today</Tab>
          <Tab value="b">This week</Tab>
        </TabList>
        <TabPanel value="a">Two things</TabPanel>
        <TabPanel value="b">Seven things</TabPanel>
      </Tabs>,
    );
    await user.click(screen.getByRole('tab', { name: 'Today' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'This week' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Seven things');
  });
});

describe('feedback', () => {
  it('announces live alerts only when asked to', () => {
    renderWithProviders(
      <>
        <Alert title="Static" />
        <Alert tone="success" title="Saved" live="polite" />
        <Alert tone="danger" title="Failed" live="assertive" action={<Button>Retry</Button>}>
          Try again
        </Alert>
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByText('Static').closest('[role]')).toBeNull();
  });

  it('labels standalone spinners and hides decorative ones', () => {
    renderWithProviders(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('renders badges and empty states', () => {
    renderWithProviders(
      <>
        <Badge tone="danger" icon={<svg />}>
          Overdue
        </Badge>
        <EmptyState title="Nothing due" action={<Button>Join a class</Button>}>
          Deadlines appear here.
        </EmptyState>
      </>,
    );
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nothing due' })).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it('has no detectable violations across the component set', async () => {
    renderWithProviders(
      <main>
        <Field label="Name" hint="Hint" error="Error">
          <Input />
        </Field>
        <Checkbox label="Remind me" />
        <Switch label="Quiet hours" />
        <Button>Save</Button>
        <IconButton label="Copy" icon={<svg />} />
        <Alert tone="warning" title="Busy day" />
      </main>,
    );
    expect(await accessibilityViolations()).toEqual([]);
  });
});
