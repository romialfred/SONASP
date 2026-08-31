import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaiementDetails from './PaiementDetails';
import type { ArtisanPaymentDossier } from '@/services/artisanPaiementsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getPaiementDossier: vi.fn(),
  transitionPaiement: vi.fn(),
  confirm: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  user: {
    id: 'executor-id',
    role: 'management',
    is_active: true,
    capabilities: ['sonasp.finance.execute', 'sonasp.finance.reconcile'],
  } as Record<string, unknown>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ paiementId: 'payment-id' }),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({
    open: mocks.confirm,
    ConfirmationDialog: () => null,
  }),
}));
vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/artisanPaiementsService', () => ({
  default: {
    getPaiementDossier: mocks.getPaiementDossier,
    transitionPaiement: mocks.transitionPaiement,
  },
  createArtisanPaymentIdempotencyKey: () => '10000000-0000-4000-8000-000000000001',
}));

const dossier = (over: Partial<ArtisanPaymentDossier> = {}): ArtisanPaymentDossier => ({
  id: 'payment-id',
  reference_paiement: 'PA-ART-20260823-001',
  facture_id: 'invoice-id',
  vente_or_id: 'sale-id',
  artisan_id: 'artisan-id',
  type_paiement: 'virement_bancaire',
  montant_paye: 383_200_000,
  montant_taxes_retenues: 92_800_000,
  details_paiement: { account_last4: '7712', verifie: true },
  statut: 'en_attente',
  version: 2,
  traite_par: 'executor-id',
  date_paiement: '2026-08-23T10:00:00Z',
  created_at: '2026-08-23T10:00:00Z',
  artisan: {
    id: 'artisan-id', nom: 'KABORE', prenoms: 'Jean-Baptiste',
    numero_carte: 'SONASP/AM/2025/BF/0010', telephone: '+22670000000',
    commune: 'Ouagadougou', region: 'Centre',
  },
  vente: {
    id: 'sale-id', numero_recu: 'VE-OR-2026-00024', date_vente: '2026-08-20',
    type_or: 'pepites', quantite_grammes: 607.42, purete_karat: 22,
    prix_kg_fcfa: 85000000, montant_brut_fcfa: 476000000,
    montant_total_fcfa: 476000000, statut: 'validee', statut_paiement: 'en_paiement',
  },
  facture: {
    id: 'invoice-id', numero_facture: 'FACT-2026-00891', vente_or_id: 'sale-id', artisan_id: 'artisan-id',
    montant_brut: 476000000, montant_taxe_tva: 0, montant_taxe_retenue_source: 88000000,
    montant_autres_taxes: 4800000, montant_total_taxes: 92800000, montant_net_a_payer: 383200000,
    taux_tva: 0, taux_retenue_source: 18.49, date_emission: '2026-08-21',
    statut: 'en_paiement', certification_dgi_status: 'certified',
  },
  moyen_paiement: {
    id: 'method-id', type: 'virement_bancaire', titulaire: 'KABORE Jean-Baptiste',
    banque: 'Banque nationale', numero_compte: 'BF7712', est_principal: true,
    actif: true, verifie_le: '2026-08-10',
  },
  organisation: { id: 'org-id', code: 'SONASP', name: 'SONASP', organization_type: 'sonasp' },
  taxes: [],
  historique: [{
    id: '1', action: 'created', actor_role: 'management', status_after: 'en_attente',
    occurred_at: '2026-08-23T10:00:00Z',
  }],
  ...over,
});

describe('PaiementDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: 'executor-id', role: 'management', is_active: true,
      capabilities: ['sonasp.finance.execute', 'sonasp.finance.reconcile'],
    };
    mocks.getPaiementDossier.mockResolvedValue(dossier());
    mocks.transitionPaiement.mockResolvedValue(undefined);
    mocks.confirm.mockResolvedValue(true);
  });

  it('présente un véritable dossier relié à la vente, à la facture et au bénéficiaire', async () => {
    render(<PaiementDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'PA-ART-20260823-001' })).toBeInTheDocument());
    expect(screen.getAllByText('KABORE Jean-Baptiste').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VE-OR-2026-00024').length).toBeGreaterThan(0);
    expect(screen.getByText('FACT-2026-00891')).toBeInTheDocument();
    expect(screen.getAllByText('383 200 000 FCFA').length).toBeGreaterThan(0);
    expect(screen.getByText('Soumettre au contrôle indépendant')).toBeInTheDocument();
  });

  it('explique les retenues calculées à partir de la facture', async () => {
    render(<PaiementDetails />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Retenues et taxes/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /Retenues et taxes/ }));

    expect(screen.getByText('Retenue à la source')).toBeInTheDocument();
    expect(screen.getByText('Taxe de développement communal')).toBeInTheDocument();
    expect(screen.getAllByText('À générer à la clôture').length).toBeGreaterThan(0);
  });

  it('transmet un paiement préparé au contrôle avec verrou optimiste', async () => {
    render(<PaiementDetails />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Transmettre au contrôle/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Transmettre au contrôle/ }));

    await waitFor(() => expect(mocks.transitionPaiement).toHaveBeenCalledWith({
      paymentId: 'payment-id',
      expectedStatus: 'en_attente',
      expectedVersion: 2,
      newStatus: 'en_traitement',
      idempotencyKey: '10000000-0000-4000-8000-000000000001',
      notes: undefined,
    }));
  });

  it('rend visible la séparation des fonctions au contrôleur', async () => {
    mocks.getPaiementDossier.mockResolvedValue(dossier({ statut: 'en_traitement', traite_par: 'executor-id' }));
    render(<PaiementDetails />);

    await waitFor(() => expect(screen.getByText(/Le préparateur ne peut pas valider son propre paiement/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Confirmer le contrôle/ })).not.toBeInTheDocument();
  });

  it('n’invente aucun bouton de clôture lorsque la preuve sécurisée manque', async () => {
    mocks.getPaiementDossier.mockResolvedValue(dossier({ statut: 'valide', date_validation: '2026-08-24T09:00:00Z' }));
    render(<PaiementDetails />);

    await waitFor(() => expect(screen.getByText('Preuve en attente')).toBeInTheDocument());
    expect(screen.getByText('Attendre la confirmation du versement')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clôturer/ })).not.toBeInTheDocument();
  });
});
