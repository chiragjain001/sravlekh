import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label and value properly', () => {
    render(<StatCard label="Active Students" value={101} color="indigo" />);
    expect(screen.getByText('Active Students')).toBeDefined();
    expect(screen.getByText('101')).toBeDefined();
  });

  it('handles onClick callback when clicked', () => {
    const handleClick = vi.fn();
    render(<StatCard label="Active Teachers" value={5} onClick={handleClick} color="emerald" />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard navigation with Enter and Space', () => {
    const handleClick = vi.fn();
    render(<StatCard label="Active Batches" value={13} onClick={handleClick} color="sky" />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(card, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
