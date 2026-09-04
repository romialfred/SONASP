import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExportLicense } from '@/services/exportLicenseService';
import { ShippingLicenseSelect } from './ShippingLicenseSelect';

const license = (overrides: Partial<ExportLicense>): ExportLicense => ({
  id: 'active',
  license_number: 'EXP-ACTIVE',
  mining_company_id: 'mine-1',
  request_date: '2026-01-01',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  issuing_institution: 'Ministère chargé des Mines',
  authorized_quantity_grams: 500_000,
  used_quantity_grams: 100_000,
  remaining_quantity_grams: 400_000,
  average_sale_price: null,
  status: 'active',
  comments: null,
  notes: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  created_by: null,
  updated_by: null,
  ...overrides,
});

describe('ShippingLicenseSelect', () => {
  it('liste uniquement les licences actives, valides, libres et du tenant', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ShippingLicenseSelect
        companyId="mine-1"
        licenses={[
          license({}),
          license({ id: 'other', license_number: 'EXP-OTHER', mining_company_id: 'mine-2' }),
          license({ id: 'pending', license_number: 'EXP-PENDING', status: 'pending' }),
          license({ id: 'expired', license_number: 'EXP-EXPIRED', end_date: '2026-01-31' }),
          license({ id: 'empty', license_number: 'EXP-EMPTY', remaining_quantity_grams: 0 }),
        ]}
        value=""
        onChange={onChange}
      />,
    );

    const select = screen.getByLabelText('Licence d’exportation *');
    expect(screen.getByRole('option', { name: /EXP-ACTIVE — Disponible : 400/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /EXP-OTHER/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /EXP-PENDING/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /EXP-EXPIRED/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /EXP-EMPTY/ })).not.toBeInTheDocument();

    await user.selectOptions(select, 'active');
    expect(onChange).toHaveBeenCalledWith('active');
  });

  it('bloque la sélection lorsqu’aucun quota libre n’est disponible', () => {
    render(
      <ShippingLicenseSelect
        companyId="mine-1"
        licenses={[license({ remaining_quantity_grams: 0 })]}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Licence d’exportation *')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Aucune licence active');
  });
});
