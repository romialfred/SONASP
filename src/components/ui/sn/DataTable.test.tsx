import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './index';

describe('DataTable interactive rows', () => {
  it('exposes clickable rows to the keyboard', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[{ key: 'reference', header: 'Reference' }]}
        rows={[{ id: 'shipment-1', reference: 'HUM-SONASP-0001/2026' }]}
        onRowClick={onRowClick}
        caption="Shipments"
      />,
    );

    const row = screen.getByText('HUM-SONASP-0001/2026').closest('tr');
    expect(row).toHaveAttribute('tabindex', '0');
    row?.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'shipment-1' }));
  });
});
