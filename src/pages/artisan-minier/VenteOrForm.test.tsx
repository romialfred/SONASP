import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VenteOrForm, { artisanDisplayName, karatToPercentage, percentageToKarat } from './VenteOrForm';
import type { ArtisanMinier } from '@/services/artisanMinierService';

const mocks = vi.hoisted(() => ({
  prixGramme: 85_821 as number | null,
  navigate: vi.fn(),
  params: { id: undefined as string | undefined },
  getAllArtisans: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getStats: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/services/venteRecuNumberService', () => ({
  genererNumeroRecu: () => Promise.resolve('VE-OR-2026-00007'),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

vi.mock('@/components/prices/LiveGoldPricePanel', () => ({ LiveGoldPricePanel: () => null }));

vi.mock('@/hooks/useCoursOr', async () => {
  const reel = await vi.importActual<typeof import('@/hooks/useCoursOr')>('@/hooks/useCoursOr');
  return {
    ...reel,
    useCoursOr: () => ({
      cours: null,
      tauxUsdXof: 600,
      prixGrammeFcfa: mocks.prixGramme,
      derniereMaj: null,
      chargement: false,
      erreur: mocks.prixGramme === null ? 'Cours indisponible auprès de la source.' : null,
      actualiser: vi.fn(),
    }),
  };
});
vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getAll: mocks.getAllArtisans },
}));

// La fonction de calcul des taxes reste la vraie : le test vérifie que l'écran affiche
// exactement ce que la sauvegarde enregistre.
vi.mock('@/services/artisanGoldSalesService', async () => {
  const actual = await vi.importActual<typeof import('@/services/artisanGoldSalesService')>(
    '@/services/artisanGoldSalesService'
  );
  return {
    artisanGoldSalesService: {
      calculateTaxes: actual.artisanGoldSalesService.calculateTaxes,
      getById: mocks.getById,
      create: mocks.create,
      update: mocks.update,
      getArtisanStatistics: mocks.getStats,
    },
  };
});

const artisans = [
  { id: 'a1', nom: 'KABORE', prenoms: 'Awa', numero_carte: 'CP-0001', region: 'Centre', telephone: '+226 70 00 00 01', actif: true },
  { id: 'a2', raison_sociale: 'BURKINA GOLD', numero_carte: 'CP-0002', region: 'Sahel', actif: true },
] as unknown as ArtisanMinier[];

const fillSale = () => {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a1' } });
  fireEvent.change(screen.getByLabelText(/Quantité \(grammes\)/), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText(/Prix au gramme/), { target: { value: '40000' } });
};

describe('conversions de pureté', () => {
  it('convertit carats et pourcentage dans les deux sens', () => {
    expect(karatToPercentage(24)).toBe(100);
    expect(karatToPercentage(22)).toBe(91.67);
    expect(percentageToKarat(100)).toBe(24);
    expect(percentageToKarat(75)).toBe(18);
  });

  it('compose le libellé de l’artisan', () => {
    expect(artisanDisplayName(artisans[0])).toBe('KABORE Awa (CP-0001)');
    expect(artisanDisplayName(artisans[1])).toBe('BURKINA GOLD (CP-0002)');
  });
});

describe('VenteOrForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.id = undefined;
    mocks.getAllArtisans.mockResolvedValue(artisans);
    mocks.getStats.mockResolvedValue({
      artisan_id: 'a1',
      nom_complet: 'KABORE Awa',
      chiffre_affaires_total: 12_000_000,
      date_derniere_vente: '2026-04-01',
      nombre_ventes_total: 7,
      quantite_totale_grammes: 320,
      quantite_ce_mois_grammes: 40,
      nombre_ventes_ce_mois: 1,
      montant_ce_mois: 1_600_000,
    });
    mocks.create.mockResolvedValue({ id: 'new' });
  });

  it('attribue et affiche le numéro de vente sans le laisser saisir', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('Vendeur et déclaration')).toBeInTheDocument());

    // Un numéro frappé à la main ouvrait la porte aux doublons sur une pièce comptable.
    expect(screen.queryByLabelText('N° de reçu')).not.toBeInTheDocument();
    expect(screen.getByText('N° de vente')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('VE-OR-2026-00007')).toBeInTheDocument());
  });

  it('enregistre la vente sous le numéro annoncé à l’écran', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('VE-OR-2026-00007')).toBeInTheDocument());

    fillSale();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la vente/ }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());

    // Sans cette reprise, le service en aurait attribué un second et la pièce
    // aurait porté un numéro différent de celui affiché.
    expect(mocks.create.mock.calls[0][0].numero_recu).toBe('VE-OR-2026-00007');
  });

  it('aligne le prix au gramme sur le cours du marché', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByLabelText(/Prix au gramme/)).toHaveValue(85_821));

    expect(screen.getByText('Cours du marché : 85 821 FCFA/g')).toBeInTheDocument();
    // Au cours du marché, l'écart est nul.
    expect(screen.getByText('+0,00 %')).toBeInTheDocument();
  });

  it('laisse modifier le prix et annonce l’écart au cours', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByLabelText(/Prix au gramme/)).toHaveValue(85_821));

    fireEvent.change(screen.getByLabelText(/Prix au gramme/), { target: { value: '94403' } });
    expect(screen.getByText('+10,00 %')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Prix au gramme/), { target: { value: '77239' } });
    expect(screen.getByText('-10,00 %')).toBeInTheDocument();
  });

  it('n’écrase pas une saisie quand le cours arrive', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByLabelText(/Prix au gramme/)).toHaveValue(85_821));

    fireEvent.change(screen.getByLabelText(/Prix au gramme/), { target: { value: '90000' } });
    await waitFor(() => expect(screen.getByLabelText(/Prix au gramme/)).toHaveValue(90_000));
  });

  it('laisse le champ vide quand le cours est indisponible', async () => {
    mocks.prixGramme = null;
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('Vendeur et déclaration')).toBeInTheDocument());

    // Une valeur de complaisance sur cet écran deviendrait le prix payé à l'artisan.
    expect(screen.getByLabelText(/Prix au gramme/)).toHaveValue(null);
    expect(screen.getByText('Cours indisponible auprès de la source.')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    mocks.prixGramme = 85_821;
  });

  it('organise le formulaire en sections métier', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('Vendeur et déclaration')).toBeInTheDocument());

    expect(screen.getByText('Nature et pureté de l’or')).toBeInTheDocument();
    expect(screen.getByText('Valorisation')).toBeInTheDocument();
    // « Observations » nomme la section et son champ : on vise le titre de section.
    expect(screen.getByRole('heading', { name: 'Observations' })).toBeInTheDocument();
    expect(screen.getByText('Récapitulatif')).toBeInTheDocument();
  });

  it('affiche le montant total taxes comprises, identique à l’enregistrement', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('Vendeur et déclaration')).toBeInTheDocument());

    fillSale();

    // 100 g × 40 000 = 4 000 000 brut ; TVA 18 % = 720 000 ; taxe 1 % = 40 000 ; total 4 760 000
    const recap = within(screen.getByText('Récapitulatif').closest('section') as HTMLElement);
    expect(recap.getByText('4 000 000 FCFA')).toBeInTheDocument();
    expect(recap.getByText('720 000 FCFA')).toBeInTheDocument();
    expect(recap.getByText('40 000 FCFA')).toBeInTheDocument();
    expect(recap.getByText('4 760 000 FCFA')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la vente/ }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      montant_brut_fcfa: 4_000_000,
      tva_montant_fcfa: 720_000,
      taxe_dev_comm_montant_fcfa: 40_000,
      montant_total_fcfa: 4_760_000,
      prix_kg_fcfa: 40_000_000,
    });
  });

  it('bloque la soumission tant que les champs déterminants manquent', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('Vendeur et déclaration')).toBeInTheDocument());

    const submit = screen.getByRole('button', { name: /Enregistrer la vente/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Sélectionnez l’artisan vendeur.')).toBeInTheDocument();

    fillSale();
    expect(submit).not.toBeDisabled();
  });

  it('lie la pureté en carats et le pourcentage', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('Nature et pureté de l’or')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^24 carats/ }));
    // Le champ en pourcentage, non le groupe de boutons en carats : depuis que
    // les deux disent « pureté », le libellé doit porter son unité.
    expect(screen.getByLabelText(/Pureté \(%\)/)).toHaveValue(100);

    fireEvent.change(screen.getByLabelText(/Pureté \(%\)/), { target: { value: '75' } });
    expect(screen.getByText(/18,00 carats/)).toBeInTheDocument();
  });

  it('affiche l’historique de l’artisan sélectionné', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('Vendeur et déclaration')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a1' } });

    const aside = within(screen.getByRole('complementary', { name: 'Récapitulatif et contexte' }));
    await waitFor(() => expect(aside.getByText('KABORE Awa (CP-0001)')).toBeInTheDocument());
    expect(aside.getByText('Ventes déclarées')).toBeInTheDocument();
    expect(aside.getByText('7')).toBeInTheDocument();
  });

  it('refuse la modification d’une vente validée', async () => {
    mocks.params.id = 'v1';
    mocks.getById.mockResolvedValue({
      id: 'v1',
      artisan_id: 'a1',
      date_vente: '2026-05-01',
      type_or: 'lingot',
      quantite_grammes: 50,
      purete_karat: 22,
      prix_kg_fcfa: 40_000_000,
      statut: 'validee',
    });

    render(<VenteOrForm />);

    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith('Impossible de modifier une vente validée ou payée')
    );
  });
});
