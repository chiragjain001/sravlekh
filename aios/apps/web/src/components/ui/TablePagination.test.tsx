import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TablePagination, getPaginationPages } from './TablePagination';

describe('TablePagination component', () => {
  it('correctly calculates pagination pages with ellipses', () => {
    expect(getPaginationPages(1, 4)).toEqual([1, 2, 3, 4]);
    expect(getPaginationPages(1, 10)).toEqual([1, 2, 3, '...', 10]);
    expect(getPaginationPages(9, 10)).toEqual([1, '...', 8, 9, 10]);
    expect(getPaginationPages(5, 10)).toEqual([1, '...', 5, '...', 10]);
  });

  it('returns null when totalItems is 0', () => {
    const { container } = render(
      <TablePagination
        page={1}
        pageSize={10}
        totalItems={0}
        totalPages={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders item range and triggers page change', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <TablePagination
        page={2}
        pageSize={10}
        totalItems={35}
        totalPages={4}
        itemLabel="batches"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    // Range display: "11–20 of 35 batches"
    expect(screen.getByText(/11–20/)).toBeInTheDocument();
    expect(screen.getByText(/batches/)).toBeInTheDocument();

    // Click next page button
    const nextBtn = screen.getByTitle('Next Page');
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);

    // Click specific page number button (e.g. page 4)
    const page4Btn = screen.getByRole('button', { name: '4' });
    fireEvent.click(page4Btn);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});
