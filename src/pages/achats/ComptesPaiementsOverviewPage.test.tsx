import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { achatsIndustrielsService } from '@/services/achatsIndustrielsService';
import ComptesPaiementsOverviewPage from './ComptesPaiementsOverviewPage';

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('ComptesPaiementsOverviewPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('compose le pilotage depuis les services comptables existants', async () => {
    vi.spyOn(achatsIndustrielsService, 'listerFactures').mockResolvedValue([{
      id: 'facture-1', numero_facture: 'FA-2026-001', achat_id: 'achat-1', mining_company_id: 'mine-1',
      date_emission: '2026-08-01', periode_debut: '2026-08-01', periode_fin: '2026-08-31',
      quantite_oz: 1, titre_pct: 99.9, prix_once_fcfa: 1, montant_ht_fcfa: 1_000,
      tva_montant_fcfa: 0, taxe_dev_comm_montant_fcfa: 0, montant_ttc_fcfa: 1_000,
      montant_ajustements_fcfa: 0, montant_paye_fcfa: 400, devise: 'XOF', conditions_paiement: 'comptant',
      date_echeance: '2026-08-31', statut: 'partiellement_payee', statut_certification: 'certifiee',
      certification_reference: null, certification_date: null, reste_du_fcfa: 600,
      mining_company: { id: 'mine-1', name: 'Mine du Centre' },
    }]);
    vi.spyOn(achatsIndustrielsService, 'listerReglements').mockResolvedValue([{
      id: 'reglement-1', reference_reglement: 'REG-2026-001', mining_company_id: 'mine-1',
      date_reglement: '2026-08-15', montant_fcfa: 500, montant_affecte_fcfa: 400, devise: 'XOF',
      mode_reglement: 'virement', banque: null, reference_bancaire: null, statut: 'valide', observations: null,
      mining_company: { id: 'mine-1', name: 'Mine du Centre' },
    }]);
    vi.spyOn(achatsIndustrielsService, 'balanceAgee').mockResolvedValue([{
      mining_company_id: 'mine-1', societe: 'Mine du Centre', devise: 'XOF', non_echu: 0,
      j1_30: 600, j31_60: 0, j61_90: 0, j91_180: 0, plus_180: 0, total: 600,
      nb_factures: 1, plus_ancienne: '2026-08-31', anciennete_moyenne: 1,
    }]);
    vi.spyOn(achatsIndustrielsService, 'societesProductrices').mockResolvedValue([{ id: 'mine-1', name: 'Mine du Centre' }]);

    render(<MemoryRouter><ComptesPaiementsOverviewPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Vue d’ensemble des comptes & paiements' })).toBeInTheDocument();
    expect(screen.getAllByText('Mine du Centre').length).toBeGreaterThan(0);
    expect(screen.getByText('FA-2026-001')).toBeInTheDocument();
    expect(screen.getByText('REG-2026-001')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir tous les paiements/ })).toHaveAttribute('href', '/achats/reglements');
    expect(screen.getByRole('link', { name: /Ouvrir les comptes des mines/ })).toHaveAttribute('href', '/achats/comptes');
  });
});
