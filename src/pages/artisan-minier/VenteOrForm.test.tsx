import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  pourAchat: vi.fn(),
  actualiserCours: vi.fn(),
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

// L'écran refuse d'enregistrer tant qu'une taxe n'a pas de règle en vigueur.
// Le référentiel est donc simulé ici, comme la base le renverrait.
vi.mock('@/services/tauxAchatService', () => ({
  tauxAchatService: { pourAchat: mocks.pourAchat },
}));

vi.mock('@/hooks/useCoursOr', async () => {
  const reel = await vi.importActual<typeof import('@/hooks/useCoursOr')>('@/hooks/useCoursOr');
  return {
    ...reel,
    useCoursOr: () => ({
      cours: mocks.prixGramme === null ? null : {
        price: 4_522.75,
        timestamp: '2026-08-27T10:30:00.000Z',
        source: 'Référentiel SONASP',
        currency: 'USD',
      },
      tauxUsdXof: 600,
      prixGrammeFcfa: mocks.prixGramme,
      derniereMaj: null,
      chargement: false,
      erreur: mocks.prixGramme === null ? 'Cours indisponible auprès de la source.' : null,
      actualiser: mocks.actualiserCours,
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
    mocks.prixGramme = 85_821;
    mocks.pourAchat.mockResolvedValue({
      tvaPourcent: 18,
      taxeCommunalePourcent: 1,
      taxesSansRegle: [],
      reglesRetenues: {},
    });
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
    mocks.actualiserCours.mockResolvedValue(undefined);
  });

  it('attribue et affiche le numéro de vente sans le laisser saisir', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText(/vendeur et déclaration/i)).toBeInTheDocument());

    // Un numéro frappé à la main ouvrait la porte aux doublons sur une pièce comptable.
    expect(screen.queryByLabelText('N° de reçu')).not.toBeInTheDocument();
    expect(screen.getByText(/n° de vente/i)).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText(/vendeur et déclaration/i)).toBeInTheDocument());

    // Une valeur de complaisance sur cet écran deviendrait le prix payé à l'artisan.
    expect(screen.getByLabelText(/Prix au gramme/)).toHaveValue(null);
    expect(screen.getAllByText('Cours indisponible auprès de la source.')).toHaveLength(2);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    mocks.prixGramme = 85_821;
  });

  it('organise le formulaire en sections métier', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText(/vendeur et déclaration/i)).toBeInTheDocument());

    expect(screen.getByText(/nature et qualité de l’or/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^valorisation$/i })).toBeInTheDocument();
    // « Observations » nomme la section et son champ : on vise le titre de section.
    expect(screen.getByRole('heading', { name: /observations/i })).toBeInTheDocument();
    expect(screen.getByText(/récapitulatif financier/i)).toBeInTheDocument();
  });

  it('affiche le montant total taxes comprises, identique à l’enregistrement', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText(/vendeur et déclaration/i)).toBeInTheDocument());

    fillSale();

    // 100 g × 40 000 = 4 000 000 brut ; TVA 18 % = 720 000 ; taxe 1 % = 40 000 ; total 4 760 000
    const recap = within(screen.getByText(/récapitulatif financier/i).closest('section') as HTMLElement);
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

  it('affiche les validations au bon endroit et bloque une soumission incomplète', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText(/vendeur et déclaration/i)).toBeInTheDocument());

    const submit = screen.getByRole('button', { name: /Enregistrer la vente/ });
    expect(submit).not.toBeDisabled();
    expect(screen.queryByText('Sélectionnez l’artisan vendeur.')).not.toBeInTheDocument();
    fireEvent.click(submit);
    expect(screen.getByText('Sélectionnez l’artisan vendeur.')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();

    fillSale();
    await waitFor(() =>
      expect(screen.queryByText('Sélectionnez l’artisan vendeur.')).not.toBeInTheDocument(),
    );
  });

  it('lie la pureté en carats et le pourcentage', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText(/nature et qualité de l’or/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Choisir la qualité 24 carats' }));
    // Le champ en pourcentage, non le groupe de boutons en carats : depuis que
    // les deux disent « pureté », le libellé doit porter son unité.
    expect(screen.getByLabelText(/Pureté \(%\)/)).toHaveValue(100);

    fireEvent.change(screen.getByLabelText(/Pureté \(%\)/), { target: { value: '75' } });
    expect(screen.getByText(/18,00 carats/)).toBeInTheDocument();
  });

  it('affiche l’historique de l’artisan sélectionné', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText(/vendeur et déclaration/i)).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a1' } });

    const aside = within(screen.getByRole('complementary', { name: 'Récapitulatif et contexte' }));
    await waitFor(() => expect(aside.getByText('KABORE Awa (CP-0001)')).toBeInTheDocument());
    expect(aside.getByText('Ventes déclarées')).toBeInTheDocument();
    expect(aside.getByText('7')).toBeInTheDocument();
  });

  it('affiche le cours réel du hook et permet de le rafraîchir', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText(/cours de l’or/i)).toBeInTheDocument());

    expect(screen.getByText(/4[\s\u202f]522,75/)).toBeInTheDocument();
    expect(screen.queryByText('Référentiel SONASP')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser le cours de l’or' }));
    await waitFor(() => expect(mocks.actualiserCours).toHaveBeenCalledTimes(1));
  });

  it('résout les taxes pour la date effectivement saisie', async () => {
    render(<VenteOrForm />);
    await waitFor(() => expect(mocks.pourAchat).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Date de vente/), { target: { value: '2026-08-26' } });
    await waitFor(() => expect(mocks.pourAchat).toHaveBeenLastCalledWith('artisan', '2026-08-26'));
  });

  it('ignore une double soumission pendant l’enregistrement', async () => {
    let terminer!: (value: { id: string }) => void;
    mocks.create.mockImplementation(
      () => new Promise<{ id: string }>((resolve) => { terminer = resolve; }),
    );
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('VE-OR-2026-00007')).toBeInTheDocument());
    await waitFor(() => expect(mocks.pourAchat).toHaveBeenCalled());

    fillSale();
    const submit = screen.getByRole('button', { name: /Enregistrer la vente/ });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    await act(async () => terminer({ id: 'new' }));
  });

  it('restitue une erreur de persistance sans redirection', async () => {
    mocks.create.mockRejectedValue(new Error('Référence de vente déjà utilisée'));
    render(<VenteOrForm />);
    await waitFor(() => expect(screen.getByText('VE-OR-2026-00007')).toBeInTheDocument());
    await waitFor(() => expect(mocks.pourAchat).toHaveBeenCalled());

    fillSale();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la vente/ }));

    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith('Référence de vente déjà utilisée'),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
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
