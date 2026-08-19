import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InfractionForm, {
  buildInfractionPayload,
  draftFromInfraction,
  EMPTY_DRAFT,
  validateDraft,
} from './InfractionForm';
import type { ArtisanInfraction } from '@/services/artisanInfractionsService';
import type { ArtisanMinier } from '@/services/artisanMinierService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { artisanId: 'a1' as string | undefined, infractionId: undefined as string | undefined },
  getArtisan: vi.fn(),
  getByArtisanId: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  uploadDocument: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
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

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/services/artisanInfractionsService', () => ({
  artisanInfractionsService: {
    getByArtisanId: mocks.getByArtisanId,
    getById: mocks.getById,
    create: mocks.create,
    update: mocks.update,
    uploadDocument: mocks.uploadDocument,
  },
}));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getById: mocks.getArtisan },
}));

const artisan = {
  id: 'a1',
  type_personne: 'physique',
  nom: 'KABORE',
  prenoms: 'Awa',
  numero_carte: 'CP-0001',
  commune: 'Kalsaka',
  region: 'Nord',
  telephone: '+226 70 00 00 01',
} as unknown as ArtisanMinier;

const constatExistant = {
  id: 'i1',
  artisan_id: 'a1',
  date_infraction: '2026-03-02',
  type_infraction: 'Détournement de convoi',
  description: 'Convoi détourné entre le site et le comptoir agréé, quantité non déclarée.',
  lieu: 'Kalsaka',
  statut_traitement: 'en_cours',
  documents: ['https://stockage/preuve-1.pdf', 'https://stockage/preuve-2.jpg'],
  created_at: '2026-03-02',
  updated_at: '2026-03-02',
} as ArtisanInfraction;

const antecedents = [
  { ...constatExistant, id: 'i0', type_infraction: 'Vente illégale', statut_traitement: 'en_cours' },
] as ArtisanInfraction[];

const faits = 'Or vendu hors circuit officiel, sans reçu ni déclaration.';

describe('validateDraft', () => {
  it('exige les mentions minimales du constat', () => {
    expect(validateDraft(EMPTY_DRAFT)).toBe('Sélectionnez la qualification de l’infraction.');
    expect(validateDraft({ ...EMPTY_DRAFT, type_infraction: 'Autre' })).toBe('Précisez la qualification retenue.');
    expect(
      validateDraft({ ...EMPTY_DRAFT, type_infraction: 'Vente illégale', description: 'trop court' })
    ).toBe('Décrivez les faits constatés (20 caractères minimum).');
    expect(validateDraft({ ...EMPTY_DRAFT, type_infraction: 'Vente illégale', description: faits })).toBeNull();
  });

  it('refuse un constat daté dans le futur', () => {
    const futur = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    expect(
      validateDraft({ ...EMPTY_DRAFT, date_infraction: futur, type_infraction: 'Vente illégale', description: faits })
    ).toBe('La date du constat ne peut pas être postérieure à aujourd’hui.');
  });

  it('encadre la clôture', () => {
    const base = { ...EMPTY_DRAFT, type_infraction: 'Vente illégale', description: faits, statut_traitement: 'cloture' as const };
    expect(validateDraft(base)).toBe('Une clôture exige une conclusion.');
    expect(validateDraft({ ...base, conclusion: 'reconnu' })).toBe('Renseignez la date de clôture.');
    expect(validateDraft({ ...base, conclusion: 'reconnu', date_cloture: '2000-01-01' })).toBe(
      'La clôture ne peut pas précéder le constat.'
    );
  });
});

describe('draftFromInfraction / buildInfractionPayload', () => {
  it('restitue une qualification hors nomenclature sur « Autre »', () => {
    const draft = draftFromInfraction(constatExistant);
    // L'ancienne version laissait le select vide : la qualification était perdue au ré-enregistrement.
    expect(draft.type_infraction).toBe('Autre');
    expect(draft.custom_type).toBe('Détournement de convoi');
    expect(buildInfractionPayload(draft, 'a1', []).type_infraction).toBe('Détournement de convoi');
  });

  it('efface le verdict quand le dossier est rouvert', () => {
    const draft = {
      ...EMPTY_DRAFT,
      type_infraction: 'Vente illégale',
      description: faits,
      statut_traitement: 'en_cours' as const,
      conclusion: 'reconnu' as const,
      date_cloture: '2026-04-01',
    };
    const payload = buildInfractionPayload(draft, 'a1', []);
    expect(payload.conclusion).toBeUndefined();
    expect(payload.date_cloture).toBeUndefined();
  });
});

describe('InfractionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.artisanId = 'a1';
    mocks.params.infractionId = undefined;
    mocks.getArtisan.mockResolvedValue(artisan);
    mocks.getByArtisanId.mockResolvedValue(antecedents);
    mocks.getById.mockResolvedValue(constatExistant);
    mocks.create.mockResolvedValue({ id: 'i2' });
    mocks.update.mockResolvedValue({ id: 'i1' });
    mocks.uploadDocument.mockResolvedValue('https://stockage/nouvelle-piece.pdf');
  });

  const remplirConstat = () => {
    fireEvent.change(screen.getByLabelText(/Qualification retenue/), { target: { value: 'Vente illégale' } });
    fireEvent.change(screen.getByLabelText(/Faits constatés/), { target: { value: faits } });
  };

  it('rappelle l’artisan mis en cause et ses antécédents', async () => {
    render(<InfractionForm />);
    // Le titre est rendu dès le chargement : attendre le volet, qui n'apparaît qu'ensuite.
    const volet = await screen.findByRole('complementary', { name: 'Contexte du dossier' });

    const contexte = within(volet);
    expect(contexte.getByText('KABORE Awa')).toBeInTheDocument();
    expect(contexte.getByText('Kalsaka · Nord')).toBeInTheDocument();
    expect(contexte.getByText('1 dossier(s) déjà en cours')).toBeInTheDocument();
    expect(contexte.getByText('Vente illégale')).toBeInTheDocument();
  });

  it('bloque l’enregistrement tant que le constat est incomplet', async () => {
    render(<InfractionForm />);
    await waitFor(() => expect(screen.getByLabelText(/Qualification retenue/)).toBeInTheDocument());

    const submit = screen.getByRole('button', { name: /Enregistrer le constat/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Sélectionnez la qualification de l’infraction.')).toBeInTheDocument();

    remplirConstat();
    expect(submit).not.toBeDisabled();
  });

  it('ne demande conclusion et date de clôture qu’à la clôture', async () => {
    render(<InfractionForm />);
    await waitFor(() => expect(screen.getByLabelText(/Qualification retenue/)).toBeInTheDocument());
    remplirConstat();

    expect(screen.queryByLabelText(/Date de clôture/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Dossier clôturé' }));

    // La date de clôture est préremplie ; seule la conclusion reste à choisir.
    expect(screen.getByLabelText(/Date de clôture/)).toHaveValue(new Date().toISOString().split('T')[0]);
    expect(screen.getByRole('button', { name: /Enregistrer le constat/ })).toBeDisabled();
    expect(screen.getByText('Une clôture exige une conclusion.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Reconnu/ }));
    expect(screen.getByRole('button', { name: /Enregistrer le constat/ })).not.toBeDisabled();
  });

  it('enregistre un constat et revient au dossier', async () => {
    render(<InfractionForm />);
    await waitFor(() => expect(screen.getByLabelText(/Qualification retenue/)).toBeInTheDocument());

    remplirConstat();
    fireEvent.change(screen.getByLabelText(/Lieu du constat/), { target: { value: 'Kalsaka' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le constat/ }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      artisan_id: 'a1',
      type_infraction: 'Vente illégale',
      lieu: 'Kalsaka',
      statut_traitement: 'en_cours',
      documents: [],
    });
    expect(mocks.showSuccess).toHaveBeenCalledWith('Constat enregistré');
  });

  it('conserve les pièces déjà versées quand une nouvelle est ajoutée', async () => {
    mocks.params.infractionId = 'i1';
    render(<InfractionForm />);
    await waitFor(() => expect(screen.getByText('preuve-1.pdf')).toBeInTheDocument());

    const fichier = new File(['pv'], 'proces-verbal.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Joindre des pièces/), { target: { files: [fichier] } });
    expect(screen.getByText(/proces-verbal\.pdf/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mettre à jour le constat/ }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    // L'ancienne version ne renvoyait que la pièce nouvellement versée : les deux autres étaient perdues.
    expect(mocks.update.mock.calls[0][1].documents).toEqual([
      'https://stockage/preuve-1.pdf',
      'https://stockage/preuve-2.jpg',
      'https://stockage/nouvelle-piece.pdf',
    ]);
  });

  it('refuse un fichier au-delà de 10 Mo', async () => {
    render(<InfractionForm />);
    await waitFor(() => expect(screen.getByLabelText(/Joindre des pièces/)).toBeInTheDocument());

    const enorme = new File(['x'], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(enorme, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText(/Joindre des pièces/), { target: { files: [enorme] } });

    expect(mocks.showError).toHaveBeenCalledWith(
      'Fichier trop volumineux (10 Mo maximum) : video.mp4'
    );
    expect(screen.queryByText(/video\.mp4/)).not.toBeInTheDocument();
  });

  it('reste utilisable si le dossier artisan est indisponible', async () => {
    mocks.getArtisan.mockRejectedValue(new Error('hors ligne'));
    mocks.getByArtisanId.mockRejectedValue(new Error('hors ligne'));

    render(<InfractionForm />);
    await waitFor(() => expect(screen.getByLabelText(/Qualification retenue/)).toBeInTheDocument());

    expect(screen.getByText(/Dossier artisan indisponible/)).toBeInTheDocument();
    remplirConstat();
    expect(screen.getByRole('button', { name: /Enregistrer le constat/ })).not.toBeDisabled();
  });
});
