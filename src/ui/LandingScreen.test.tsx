import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingScreen } from './LandingScreen';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

// Feature: 00-foundation, Task 6.3: component test for the landing screen and the Lights-On toggle
describe('LandingScreen', () => {
  it('renders the heading', () => {
    render(<LandingScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ledger Mortis' })).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<LandingScreen />);
    expect(
      screen.getByText('Paste your transactions. Summon the ghosts of your money.'),
    ).toBeInTheDocument();
  });

  it('renders the toggle as a real button with aria-pressed false', () => {
    render(<LandingScreen />);
    const toggle = screen.getByRole('button', { name: 'Lights-On mode' });
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts in the dark theme', () => {
    render(<LandingScreen />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('flips on and back on click while keeping the accessible name', async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    await user.click(screen.getByRole('button', { name: 'Lights-On mode' }));
    expect(screen.getByRole('button', { name: 'Lights-On mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'lights-on');
    await user.click(screen.getByRole('button', { name: 'Lights-On mode' }));
    expect(screen.getByRole('button', { name: 'Lights-On mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('toggles with the Enter key', async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    const toggle = screen.getByRole('button', { name: 'Lights-On mode' });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'lights-on');
  });

  it('toggles with the Space key', async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    const toggle = screen.getByRole('button', { name: 'Lights-On mode' });
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'lights-on');
  });

  it('is reachable with the Tab key', async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Lights-On mode' })).toHaveFocus();
  });

  it('shows the visible state text in an aria-hidden span', async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    const off = screen.getByText('Off');
    expect(off).toBeInTheDocument();
    expect(off).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('button', { name: 'Lights-On mode' }));
    const on = screen.getByText('On');
    expect(on).toBeInTheDocument();
    expect(on).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no aria-label on the toggle', () => {
    render(<LandingScreen />);
    expect(screen.getByRole('button', { name: 'Lights-On mode' })).not.toHaveAttribute(
      'aria-label',
    );
  });
});
