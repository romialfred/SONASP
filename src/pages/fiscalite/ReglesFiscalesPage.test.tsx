import type { ReactNode } from 'react';
import { fireEvent, render as rendreBrut, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReglesFiscalesPage from './ReglesFiscalesPage';
import type { RegleFiscale } from '@/services/reglesFiscalesService';

/** Le fil d'Ariane pose des `Link` : la page a besoin d'un routeur. */
const render = () => rendreBrut(<MemoryRouter><ReglesFiscalesPage /></MemoryRouter>);

const mocks = vi.hoisted(() => ({
  lister: vi.fn(),
  nomsActeurs: vi.fn(),
  approuver: vi.fn(),
  abroger: vi.fn(),
  creer: vi.fn(),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'moi', role: 'owner' } }),
}));

vi.mock('@/lib/capabilities', () => ({
  CAPABILITIES: { TAX_RULES_MANAGE: 'tax.rules.manage' },
  hasCapability: () => true,
}));

vi.mock('@/services/reglesFiscalesService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/reglesFiscalesService')>();
  return {
    ...original,
    reglesFiscalesService: {
      lister: mocks.lister,
      nomsActeurs: mocks.nomsActeurs,
      approuver: mocks.approuver,
      abroger: mocks.abroger,
      creer: mocks.creer,
    },
  };
});

function regle(surcharge: Partial<RegleFiscale> = {}): RegleFiscale {
  return {
    id: 'r1',
    code_taxe: 'tva',
    libelle: 'TVA des comptoirs d’achat',
    assiette: 'ca_ht',
    mode_calcul: 'taux',
    taux: 0.015,
    montant_forfaitaire: null,
    seuil_min: null,
    seuil_max: null,
    unite_seuil: null,
    devise_seuil: null,
    profil_vendeur: 'comptoir',
    categorie_acheteur: 'standard',
    date_effet: '2026-08-26',
    date_fin: null,
    reference_reglementaire: null,
    commentaire: null,
    statut: 'approuvee',
    cree_par: null,
    cree_le: '2026-08-26T08:00:00Z',
    approuve_par: 'chef',
    approuve_le: '2026-08-26T09:00:00Z',
    abroge_par: null,
    abroge_le: null,
    updated_at: '2026-08-26T09:00:00Z',
    ...surcharge,
  };
}

const FNDL = regle({
  id: 'r2',
  code_taxe: 'fndl',
  libelle: 'FNDL sur le chiffre d’affaires',
  taux: 0.01,
  profil_vendeur: 'tous',
});

describe('ReglesFiscalesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nomsActeurs.mockResolvedValue({ chef: 'TIEGNAN Romuald' });
  });

  it('affiche les règles en tuiles par défaut, sans tableau', async () => {
    mocks.lister.mockResolvedValue([regle(), FNDL]);

    const { container } = render();

    await waitFor(() => expect(container.querySelectorAll('.rf-tuile')).toHaveLength(2));
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('1,50 %')).toBeInTheDocument();
  });

  // L'avertissement ne doit pas peser sur un référentiel qui fonctionne : il ne
  // parle que d'un référentiel vide.
  it('ne montre le bandeau d’alerte que lorsqu’aucune règle n’existe', async () => {
    mocks.lister.mockResolvedValue([regle()]);
    const { unmount } = render();

    await waitFor(() => expect(screen.getByText(/TVA des comptoirs/)).toBeInTheDocument());
    expect(screen.queryByText(/Aucune règle n’est enregistrée/)).toBeNull();
    unmount();

    mocks.lister.mockResolvedValue([]);
    render();
    await waitFor(() => expect(screen.getByText(/Aucune règle n’est enregistrée/)).toBeInTheDocument());
  });

  it('porte la dernière mise à jour et son auteur', async () => {
    mocks.lister.mockResolvedValue([regle(), FNDL]);
    render();

    await waitFor(() => expect(screen.getByText('Par TIEGNAN Romuald')).toBeInTheDocument());
  });

  it('filtre les tuiles par la recherche', async () => {
    mocks.lister.mockResolvedValue([regle(), FNDL]);
    const { container } = render();

    await waitFor(() => expect(container.querySelectorAll('.rf-tuile')).toHaveLength(2));

    fireEvent.change(screen.getByLabelText('Rechercher une règle fiscale'), {
      target: { value: 'comptoir' },
    });

    expect(container.querySelectorAll('.rf-tuile')).toHaveLength(1);
    expect(screen.getByText('TVA des comptoirs d’achat')).toBeInTheDocument();
  });

  it('bascule en tableau à la demande', async () => {
    mocks.lister.mockResolvedValue([regle()]);
    const { container } = render();

    await waitFor(() => expect(container.querySelector('.rf-tuile')).not.toBeNull());

    fireEvent.click(screen.getByRole('radio', { name: 'Tableau' }));

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('.rf-tuile')).toBeNull();
  });

  it('sépare les onglets et n’offre « Abroger » que sur une règle en vigueur', async () => {
    mocks.lister.mockResolvedValue([regle(), regle({ id: 'r3', statut: 'projet', approuve_par: null, approuve_le: null })]);
    const { container } = render();

    await waitFor(() => expect(container.querySelectorAll('.rf-tuile')).toHaveLength(1));

    const tuile = container.querySelector('.rf-tuile') as HTMLElement;
    fireEvent.click(within(tuile).getByRole('button', { name: 'Actions sur la règle' }));
    expect(screen.getByRole('menuitem', { name: /Abroger/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Approuver/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /En projet/ }));

    const enProjet = container.querySelector('.rf-tuile') as HTMLElement;
    fireEvent.click(within(enProjet).getByRole('button', { name: 'Actions sur la règle' }));
    expect(screen.getByRole('menuitem', { name: /Approuver/ })).toBeInTheDocument();
  });

  it('ouvre le détail d’une règle et rend l’approbation possible', async () => {
    mocks.lister.mockResolvedValue([regle({ statut: 'projet', approuve_par: null, approuve_le: null })]);
    mocks.approuver.mockResolvedValue({});
    render();

    // La règle est en projet : l'onglet par défaut ne la montre pas.
    fireEvent.click(await screen.findByRole('tab', { name: /En projet/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Voir/ }));

    const volet = screen.getByRole('dialog', { name: 'Détail de la règle' });
    expect(within(volet).getByText('Comptoir d’achat')).toBeInTheDocument();

    fireEvent.click(within(volet).getByRole('button', { name: /Approuver/ }));
    await waitFor(() => expect(mocks.approuver).toHaveBeenCalledWith('r1'));
  });
});
