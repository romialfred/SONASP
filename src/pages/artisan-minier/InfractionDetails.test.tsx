import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InfractionDetails, { dureeInstruction, formatDate, isImage, pieceName } from './InfractionDetails';
import type { ArtisanInfraction } from '@/services/artisanInfractionsService';
import type { ArtisanMinier } from '@/services/artisanMinierService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { artisanId: 'a1' as string | undefined, infractionId: 'i1' as string | undefined },
  getInfraction: vi.fn(),
  getArtisan: vi.fn(),
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
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/services/artisanInfractionsService', () => ({
  artisanInfractionsService: { getById: mocks.getInfraction },
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
} as unknown as ArtisanMinier;

const infraction = {
  id: 'i1',
  artisan_id: 'a1',
  date_infraction: '2026-03-02',
  type_infraction: 'Vente illégale',
  description: 'Or vendu hors circuit officiel, sans reçu ni déclaration préalable.',
  lieu: 'Kalsaka',
  statut_traitement: 'en_cours',
  remarques: 'Mise en demeure recommandée.',
  documents: ['https://stockage/pv%20initial.pdf', 'https://stockage/photo-site.jpg'],
  created_at: '2026-03-02T08:00:00Z',
  updated_at: '2026-03-05T08:00:00Z',
} as ArtisanInfraction;

describe('utilitaires du constat', () => {
  it('nomme et classe les pièces', () => {
    expect(pieceName('https://stockage/pv%20initial.pdf')).toBe('pv initial.pdf');
    expect(pieceName('https://stockage/photo.jpg?token=abc')).toBe('photo.jpg');
    expect(isImage('https://stockage/photo.JPG')).toBe(true);
    expect(isImage('https://stockage/pv.pdf')).toBe(false);
  });

  it('n’affiche jamais « Invalid Date »', () => {
    expect(formatDate(undefined)).toBe('Non renseignée');
    expect(formatDate('pas-une-date')).toBe('Non renseignée');
    expect(formatDate('2026-03-02')).toBe('02/03/2026');
  });

  it('mesure la durée d’instruction', () => {
    expect(dureeInstruction({ ...infraction, date_cloture: '2026-03-12' })).toBe(10);
    expect(dureeInstruction(infraction)).toBeGreaterThan(0);
  });
});

describe('InfractionDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.artisanId = 'a1';
    mocks.params.infractionId = 'i1';
    mocks.getInfraction.mockResolvedValue(infraction);
    mocks.getArtisan.mockResolvedValue(artisan);
  });

  it('présente le constat, ses pièces et le dossier concerné', async () => {
    render(<InfractionDetails />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Vente illégale' })).toBeInTheDocument());

    expect(screen.getByText(/Constaté le 02\/03\/2026 à Kalsaka · Dossier de KABORE Awa/)).toBeInTheDocument();
    expect(screen.getByText(/Or vendu hors circuit officiel/)).toBeInTheDocument();
    expect(screen.getByText('Mise en demeure recommandée.')).toBeInTheDocument();

    // Les pièces restent atteignables : ouverture et téléchargement pointent sur l'URL stockée.
    expect(screen.getByText('pv initial.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Ouvrir/ })[0]).toHaveAttribute(
      'href',
      'https://stockage/pv%20initial.pdf'
    );
    expect(screen.getByAltText('photo-site.jpg')).toBeInTheDocument();

    const suivi = within(screen.getByRole('complementary', { name: 'Suivi du constat' }));
    expect(suivi.getByText('Non prononcée')).toBeInTheDocument();
    expect(suivi.getByText('CP-0001')).toBeInTheDocument();
  });

  it('mène à l’instruction tant que le dossier est ouvert', async () => {
    render(<InfractionDetails />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Instruire et clôturer/ })).toBeInTheDocument());

    expect(screen.getAllByText('Instruction en cours').length).toBe(2); // badge d'en-tête et volet de suivi
    screen.getByRole('button', { name: /Instruire et clôturer/ }).click();
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/a1/infractions/i1/modifier');
  });

  it('affiche le verdict d’un dossier clôturé', async () => {
    mocks.getInfraction.mockResolvedValue({
      ...infraction,
      statut_traitement: 'cloture',
      conclusion: 'innocente',
      date_cloture: '2026-04-01',
    });

    render(<InfractionDetails />);
    await waitFor(() => expect(screen.getAllByText('Dossier clôturé').length).toBe(2));

    expect(screen.getAllByText('Innocenté').length).toBe(2); // badge d'en-tête et volet de suivi
    expect(screen.getByText('L’artisan est mis hors de cause.')).toBeInTheDocument();
    expect(screen.getByText('Durée d’instruction')).toBeInTheDocument();
    expect(screen.getByText('30 jour(s)')).toBeInTheDocument();
  });

  it('reste lisible quand le dossier artisan est indisponible', async () => {
    mocks.getArtisan.mockRejectedValue(new Error('hors ligne'));

    render(<InfractionDetails />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Vente illégale' })).toBeInTheDocument());

    expect(screen.getByText('Dossier artisan indisponible.')).toBeInTheDocument();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('propose un retour explicite si le constat est introuvable', async () => {
    mocks.getInfraction.mockResolvedValue(null);

    render(<InfractionDetails />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Constat introuvable' })).toBeInTheDocument());

    expect(mocks.showError).toHaveBeenCalledWith("Impossible de charger ce constat d'infraction");
    screen.getByRole('button', { name: /Retour au dossier/ }).click();
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/a1');
  });
});
