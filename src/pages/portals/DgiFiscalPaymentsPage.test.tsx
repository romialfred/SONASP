import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DgiFiscalPaymentsPage } from './DgiFiscalPaymentsPage';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

describe('paiements fiscaux DGI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: [{
        id: 'payment-1', reference_paiement: 'PA-001', numero_facture: 'FA-001',
        montant_paye: 1_000_000, montant_taxes_retenues: 100_000,
        statut: 'complete', date_paiement: '2026-08-28T10:00:00Z',
      }],
      error: null,
    });
  });

  it('charge uniquement la projection RPC fiscale et aucune table de paiement brute', async () => {
    render(<MemoryRouter><DgiFiscalPaymentsPage /></MemoryRouter>);

    expect(await screen.findByText('PA-001')).toBeInTheDocument();
    expect(screen.getByText(/1.000.000 FCFA/u)).toBeInTheDocument();
    expect(screen.getByText(/preuves bancaires.*jamais exposés/i)).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith('snp_dgi_lister_paiements_fiscaux', {
      p_limit: 200, p_offset: 0,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('échoue fermé si la RPC refuse le périmètre', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Périmètre fiscal DGI requis.' } });
    render(<MemoryRouter><DgiFiscalPaymentsPage /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Périmètre fiscal DGI requis.');
    await waitFor(() => expect(screen.queryByText('PA-001')).not.toBeInTheDocument());
  });
});
