import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DgmgReserveValidationPage } from './DgmgReserveValidationPage';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

const queueRow = {
  id: 'allocation-1', reference: 'AFF-2026-0049', allocation_date: '2026-08-28',
  status: 'UNDER_REVIEW', reason: 'Constitution de la réserve',
  decision_reference: 'DEC-118', decision_authority: 'Ministère des Finances',
  depository_name: 'BCEAO', lot_count: 3, ingot_count: 10,
  gross_weight_grams: 1_250, fine_weight_grams: 1_249.85,
  submitted_at: '2026-08-28T10:00:00Z',
};

describe('file de validation Réserve DGMG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation((name: string) => Promise.resolve(
      name === 'snp_dgmg_lister_validations_reserve_level_1'
        ? { data: [queueRow], error: null }
        : { data: 'VALIDATED_LEVEL_1', error: null },
    ));
  });

  it('ne lit que la projection minimale et valide via la RPC dédiée', async () => {
    render(<MemoryRouter><DgmgReserveValidationPage /></MemoryRouter>);

    fireEvent.click(await screen.findByText('AFF-2026-0049'));
    expect(screen.getByText('En cours de contrôle')).toBeInTheDocument();
    expect(screen.queryByText('UNDER_REVIEW')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Commentaire ou motif/), {
      target: { value: 'Contrôles réglementaires conformes.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Valider le niveau 1' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
      'snp_dgmg_transition_reserve_level_1',
      {
        p_allocation_id: 'allocation-1',
        p_target_status: 'VALIDATED_LEVEL_1',
        p_comment: 'Contrôles réglementaires conformes.',
      },
    ));
    expect(mocks.from).not.toHaveBeenCalled();
    expect(screen.getByText(/ni aux positions physiques.*ni aux valorisations/i)).toBeInTheDocument();
  });

  it('impose un motif détaillé avant un rejet', async () => {
    render(<MemoryRouter><DgmgReserveValidationPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText('AFF-2026-0049'));

    const reject = screen.getByRole('button', { name: 'Rejeter le dossier' });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Commentaire ou motif/), { target: { value: 'Court' } });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Commentaire ou motif/), {
      target: { value: 'Écart réglementaire documenté.' },
    });
    expect(reject).toBeEnabled();
  });
});
