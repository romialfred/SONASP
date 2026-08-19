import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaiementForm, { buildInvoicePayload, fieldsForMethod, missingRequiredFields } from './PaiementForm';
import type { ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { FactureDefinitive, PaiementArtisan } from '@/services/artisanPaiementsService';

const mocks = vi.hoisted(() => ({
  listerMoyens: vi.fn(),
  navigate: vi.fn(),
  params: { venteId: 'v1' as string | undefined },
  getVente: vi.fn(),
  getArtisan: vi.fn(),
  getFacture: vi.fn(),
  calculerTaxes: vi.fn(),
  creerFacture: vi.fn(),
  creerPaiement: vi.fn(),
  telecharger: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  openConfirm: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

vi.mock('@/components/payment/PaymentMethodLogos', () => ({
  BankTransferLogo: () => null,
  OrangeMoneyLogo: () => null,
  MoovMoneyLogo: () => null,
  WaveLogo: () => null,
  MobileMoneyLogo: () => null,
  CashLogo: () => null,
  ChequeLogo: () => null,
}));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({ open: mocks.openConfirm, ConfirmationDialog: () => null }),
}));

vi.mock('@/services/artisanGoldSalesService', () => ({
  artisanGoldSalesService: { getById: mocks.getVente },
}));

vi.mock('@/services/artisanMoyenPaiementService', async () => {
  const reel = await vi.importActual<typeof import('@/services/artisanMoyenPaiementService')>(
    '@/services/artisanMoyenPaiementService'
  );
  return {
    ...reel,
    artisanMoyenPaiementService: { listerParArtisan: mocks.listerMoyens },
  };
});

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getById: mocks.getArtisan },
}));

vi.mock('@/services/artisanPaiementsService', () => ({
  default: {
    getFactureByVenteId: mocks.getFacture,
    calculerTaxes: mocks.calculerTaxes,
    creerFactureDefinitive: mocks.creerFacture,
    creerPaiement: mocks.creerPaiement,
  },
}));

vi.mock('@/services/factureArtisanPdfService', () => ({
  telechargerFacturePaiementArtisan: mocks.telecharger,
}));

const vente = {
  id: 'v1',
  artisan_id: 'a1',
  date_vente: '2026-05-10',
  quantite_grammes: 1000,
  type_or: 'lingot',
  purete_karat: 22,
  prix_kg_fcfa: 40_000_000,
  montant_total_fcfa: 47_600_000,
  numero_recu: 'REC-001',
  statut: 'validee',
} as ArtisanGoldSale;

const artisan = {
  id: 'a1',
  nom: 'KABORE',
  prenoms: 'Awa',
  adresse: 'Secteur 12, Ouagadougou',
  telephone: '+226 70 00 00 01',
  numero_carte: 'CP-0001',
} as unknown as ArtisanMinier;

const facture = {
  id: 'f1',
  numero_facture: 'FA-2026-001',
  montant_brut: 47_600_000,
  montant_taxe_tva: 8_568_000,
  montant_taxe_retenue_source: 714_000,
  montant_total_taxes: 9_282_000,
  montant_net_a_payer: 38_318_000,
  taux_tva: 18,
  taux_retenue_source: 1.5,
  statut: 'emise',
} as FactureDefinitive;

describe('champs par moyen de paiement', () => {
  it('ne demande que les champs du canal retenu', () => {
    expect(fieldsForMethod('cash').map((f) => f.key)).toEqual(['recu_par', 'lieu_paiement', 'numero_recu']);
    expect(fieldsForMethod('cheque').map((f) => f.key)).toContain('numero_cheque');
    expect(fieldsForMethod('virement_bancaire').map((f) => f.key)).toContain('numero_compte');
    // Les quatre services mobiles partagent le même jeu de champs.
    ['orange_money', 'moov_money', 'wave', 'mobile_money'].forEach((method) => {
      expect(fieldsForMethod(method as never).map((f) => f.key)).toEqual([
        'numero_telephone',
        'nom_titulaire',
        'reference_transaction',
      ]);
    });
  });

  it('liste les obligations non satisfaites', () => {
    expect(missingRequiredFields('cash', {})).toEqual(['Reçu par', 'Lieu du paiement']);
    expect(missingRequiredFields('cash', { recu_par: 'A', lieu_paiement: 'B' })).toEqual([]);
    expect(missingRequiredFields('orange_money', { numero_telephone: '70' })).toEqual(['Nom du titulaire']);
  });
});

describe('buildInvoicePayload', () => {
  it('traduit la vente dans le vocabulaire de la facture', () => {
    const payload = buildInvoicePayload(facture, {} as PaiementArtisan, artisan, vente);

    // L'ancienne version transmettait `poids_grammes` et `prix_unitaire_fcfa` inexistants
    // sur la vente : la génération du PDF échouait.
    expect(payload.venteOr.poids_grammes).toBe(1000);
    expect(payload.venteOr.prix_unitaire_fcfa).toBe(40_000_000);
    expect(payload.venteOr.purete_pourcentage).toBeCloseTo(91.67, 2);
    expect(payload.venteOr.poids_onces).toBeCloseTo(32.15, 1);
    expect(payload.artisan).toMatchObject({ nom: 'KABORE', prenom: 'Awa', adresse: 'Secteur 12, Ouagadougou' });
  });
});

describe('PaiementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.venteId = 'v1';
    mocks.getVente.mockResolvedValue(vente);
    mocks.getArtisan.mockResolvedValue(artisan);
    mocks.getFacture.mockResolvedValue(facture);
    mocks.creerPaiement.mockResolvedValue({ id: 'p1' });
    mocks.listerMoyens.mockResolvedValue([
      {
        id: 'm1',
        artisan_id: 'a1',
        type: 'orange_money',
        titulaire: 'KABORE Awa',
        numero_telephone: '+22670000001',
        est_principal: true,
        actif: true,
      },
      {
        id: 'm2',
        artisan_id: 'a1',
        type: 'virement_bancaire',
        titulaire: 'KABORE Awa',
        banque: 'Coris Bank',
        numero_compte: 'BF1234567890',
        est_principal: false,
        actif: true,
      },
    ]);
    mocks.openConfirm.mockResolvedValue(false);
  });

  it('affiche la facture et le net à payer', async () => {
    render(<PaiementForm />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Règlement d’une vente d’or' })).toBeInTheDocument());

    expect(screen.getByText('FA-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Net à payer')).toBeInTheDocument();
    expect(screen.getByText('38 318 000 FCFA')).toBeInTheDocument();
    // Le nom figure aussi sur les moyens de paiement : on cible le bénéficiaire.
    expect(screen.getAllByText('KABORE Awa').length).toBeGreaterThan(0);
  });

  it('ne propose que les moyens enregistrés sur la fiche, sans champ de saisie', async () => {
    render(<PaiementForm />);
    await waitFor(() => expect(screen.getByText('Moyen de paiement de l’artisan')).toBeInTheDocument());

    // Les coordonnées étaient frappées ici, à chaque règlement.
    expect(screen.queryByLabelText(/Numéro de compte/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reçu par/)).not.toBeInTheDocument();

    expect(screen.getByRole('radio', { name: /Orange Money/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Virement bancaire/ })).toBeInTheDocument();
  });

  it('présélectionne le moyen principal et affiche ses coordonnées en lecture', async () => {
    render(<PaiementForm />);
    await waitFor(() => expect(screen.getByText('Moyen de paiement de l’artisan')).toBeInTheDocument());

    expect(screen.getByText('+22670000001')).toBeInTheDocument();
    expect(screen.getAllByText('KABORE Awa').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: /Virement bancaire/ }));
    expect(screen.getByText('Coris Bank')).toBeInTheDocument();
    expect(screen.getByText('BF1234567890')).toBeInTheDocument();
  });

  it('renvoie à la fiche quand l’artisan n’a aucun moyen enregistré', async () => {
    mocks.listerMoyens.mockResolvedValue([]);
    render(<PaiementForm />);

    await waitFor(() => expect(screen.getByText('Aucun moyen de paiement enregistré')).toBeInTheDocument());
    // Le règlement ne peut pas être enregistré sans coordonnée.
    expect(screen.getByRole('button', { name: /Enregistrer le paiement/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir la fiche de l’artisan/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/a1/modifier');
  });

  it('enregistre le paiement avec le moyen retenu puis propose la facture', async () => {
    render(<PaiementForm />);
    await waitFor(() => expect(screen.getByText('Moyen de paiement de l’artisan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: /Virement bancaire/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le paiement/ }));

    await waitFor(() => expect(mocks.creerPaiement).toHaveBeenCalled());
    expect(mocks.creerPaiement.mock.calls[0][0]).toMatchObject({
      facture_id: 'f1',
      type_paiement: 'virement_bancaire',
      moyen_paiement_id: 'm2',
      montant_paye: 38_318_000,
    });
    await waitFor(() => expect(mocks.openConfirm).toHaveBeenCalled());
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/paiements');
  });

  it('renvoie à la facture spécimen depuis le dossier de règlement', async () => {
    render(<PaiementForm />);
    await waitFor(() => expect(screen.getByText('Moyen de paiement de l’artisan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Voir la facture \(spécimen\)/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/ventes-or/v1/facture');
  });

  it('explique l’absence de facture au lieu d’un écran vide', async () => {
    mocks.getFacture.mockResolvedValue(null);
    mocks.getVente.mockResolvedValue({ ...vente, statut: 'en_attente' });

    render(<PaiementForm />);

    await waitFor(() => expect(screen.getByText('Dossier de paiement incomplet')).toBeInTheDocument());
    expect(screen.getByText(/Validez la vente pour émettre la facture/)).toBeInTheDocument();
  });

  it('signale une vente introuvable', async () => {
    mocks.getVente.mockResolvedValue(null);
    render(<PaiementForm />);

    await waitFor(() =>
      expect(screen.getByText('Cette vente est introuvable ou a été supprimée.')).toBeInTheDocument()
    );
  });
});
