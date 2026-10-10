import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TableCheckbox } from './TableCheckbox';

describe('TableCheckbox component', () => {
  it('renders unchecked state without checkmark or minus', () => {
    const handleChange = vi.fn();
    render(
      <TableCheckbox
        checked={false}
        onChange={handleChange}
        ariaLabel="Select item"
      />
    );

    const btn = screen.getByRole('checkbox', { name: /select item/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(btn);
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('renders checked state with aria-checked true and check icon', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <TableCheckbox
        checked={true}
        onChange={handleChange}
        ariaLabel="Select item"
      />
    );

    const btn = screen.getByRole('checkbox', { name: /select item/i });
    expect(btn).toHaveAttribute('aria-checked', 'true');
    // Lucide check icon renders an SVG with lucide-check class
    expect(container.querySelector('svg.lucide-check')).toBeInTheDocument();
  });

  it('renders indeterminate state with aria-checked mixed and minus icon', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <TableCheckbox
        checked={false}
        indeterminate={true}
        onChange={handleChange}
        ariaLabel="Select all items"
      />
    );

    const btn = screen.getByRole('checkbox', { name: /select all items/i });
    expect(btn).toHaveAttribute('aria-checked', 'mixed');
    expect(container.querySelector('svg.lucide-minus')).toBeInTheDocument();
  });

  it('does not trigger onChange when disabled', () => {
    const handleChange = vi.fn();
    render(
      <TableCheckbox
        checked={false}
        disabled={true}
        onChange={handleChange}
        ariaLabel="Disabled item"
      />
    );

    const btn = screen.getByRole('checkbox', { name: /disabled item/i });
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
