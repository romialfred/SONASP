import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VerifyAffiliation from './VerifyAffiliation';
const verify = vi.hoisted(() => vi.fn());
vi.mock('@/services/affiliationService', () => ({ affiliationService: { verify } }));
const reference = 'a0000000-0000-4000-8000-000000000001';
const show = (id = reference) => render(<MemoryRouter initialEntries={[`/verifier-carte/${id}`]}><Routes><Route path="/verifier-carte/:reference" element={<VerifyAffiliation />} /></Routes></MemoryRouter>);
describe('Vérification publique de la carte', () => {
  beforeEach(() => vi.resetAllMocks());
  it('ne présente pas une indisponibilité comme une carte valide et permet un nouveau contrôle', async () => {
    verify.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ numero_affiliation: 'TEST', version: 1, statut_effectif: 'expiree', valid_until: '2026-09-05', verified_at: '2026-09-06T00:00:00Z' });
    show(); expect(await screen.findByRole('alert')).toHaveTextContent('ne peut pas être confirmée');
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier à nouveau' }));
    expect(await screen.findByText('Expirée')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it.each(['inactive', 'suspendue', 'remplacee', 'a_reexaminer'] as const)('affiche l’état serveur %s sans l’assimiler à une activation', async statut_effectif => {
    verify.mockResolvedValue({ numero_affiliation: 'TEST', version: 1, statut_effectif, valid_until: null, verified_at: '2026-09-06T00:00:00Z' });
    show(); await screen.findByText('TEST'); expect(screen.queryByText('Active', { exact: true })).not.toBeInTheDocument();
  });
  it('rejette une référence mal formée sans appel serveur', async () => {
    show('invalide'); expect(await screen.findByText(/Référence inconnue/)).toBeInTheDocument(); expect(verify).not.toHaveBeenCalled();
  });
});
