import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DatePicker } from './DatePicker';

describe('DatePicker Component', () => {
  it('renders formatted selected date in the trigger button', () => {
    render(<DatePicker value="2026-10-09" onChange={vi.fn()} />);
    // October 9, 2026
    expect(screen.getByText(/Today \(9 Oct\)|9 Oct|Oct 9/i)).toBeInTheDocument();
  });

  it('toggles calendar popover open and closed on trigger button click', () => {
    render(<DatePicker value="2026-10-09" onChange={vi.fn()} />);

    // Calendar is closed initially
    expect(screen.queryByText('October 2026')).not.toBeInTheDocument();

    // Click trigger to open
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Calendar popover is visible
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(screen.getByText('Su')).toBeInTheDocument();
    expect(screen.getByText('Fr')).toBeInTheDocument();
    expect(screen.getByText('Sa')).toBeInTheDocument();

    // Click Done to close
    const doneBtn = screen.getByText('Done');
    fireEvent.click(doneBtn);

    expect(screen.queryByText('October 2026')).not.toBeInTheDocument();
  });

  it('renders with right alignment class when align="right"', () => {
    const { container } = render(
      <DatePicker value="2026-10-09" onChange={vi.fn()} align="right" />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    const popover = container.querySelector('.sm\\:right-0');
    expect(popover).toBeInTheDocument();
  });

  it('calls onChange with selected date when day number is clicked', () => {
    const handleChange = vi.fn();
    render(<DatePicker value="2026-10-09" onChange={handleChange} />);

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Pick day 15
    const day15Btn = screen.getByRole('button', { name: '15' });
    fireEvent.click(day15Btn);

    expect(handleChange).toHaveBeenCalledWith('2026-10-15');
  });
});
