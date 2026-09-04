import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conciliation, StatutConciliation } from '@/services/conciliationService';
import {
  ConciliationsPage,
  categorieDossier,
  filtrerDossiers,
  formatMontant,
  resumerMontants,
} from './ConciliationsPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  lister: vi.fn(),
  ventesConciliables: vi.fn(),
  ouvrir: vi.fn(),
  exportWorkbook: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'owner', is_active: true } }),
}));

vi.mock('@/services/conciliationService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/conciliationService')>();
  return {
    ...original,
    conciliationService: {
      ...original.conciliationService,
      lister: mocks.lister,
      ventesConciliables: mocks.ventesConciliables,
      ouvrir: mocks.ouvrir,
    },
  };
});

vi.mock('@/lib/excelExport', () => ({
  downloadExcelWorkbook: mocks.exportWorkbook,
}));

function dossier(
  id: string,
  statut: StatutConciliation,
  partiel: Partial<Conciliation> = {},
): Conciliation {
  return ({
    id,
    reference: `REC-2026-${id}`,
    sale_id: `sale-${id}`,
    contrat_id: null,
    mining_company_id: 'mine-1',
    customer_id: 'customer-1',
    source_analyse_type: null,
    assay_certificate_id: null,
    analyse_teneur_id: null,
    poids_initial_g: null,
    teneur_initiale_pct: null,
    or_fin_initial_g: 607.42,
    prix_initial: 2_800,
    devise_initiale: 'USD',
    ca_initial: 1_733_604.4,
    poids_final_g: null,
    teneur_finale_pct: null,
    or_fin_final_g: null,
    prix_final: null,
    devise_finale: null,
    date_fixing: null,
    ca_final: null,
    statut,
    motif_statut: null,
    observations: null,
    version: 1,
    soumis_par: null,
    soumis_le: null,
    valide_par: null,
    valide_le: null,
    cloture_le: null,
    created_at: '2026-08-27T08:00:00Z',
    updated_at: '2026-08-27T08:00:00Z',
    sale: {
      id: `sale-${id}`,
      sale_number: `VE-OR-2026-${id.padStart(5, '0')}`,
      sale_date: '2026-08-27',
      quantity_oz: 19.529,
      currency: 'USD',
      seller_id: 'mine-1',
      seller_type: 'mining_company',
    },
    customer: { id: 'customer-1', name: 'Raffinerie Africaine' },
    mining_company: { id: 'mine-1', name: 'SONASP Plateau-Central', code: 'SPC' },
    ...partiel,
  }) as Conciliation;
}

const attente = dossier('38', 'en_attente_analyse');
const raffinage = dossier('37', 'analyse_recue');
const litige = dossier('36', 'contestee');
const concilie = dossier('35', 'validee', {
  ca_final: 1_720_000,
  devise_finale: 'USD',
  valide_le: '2026-08-27T09:00:00Z',
});

describe('modèle de la liste de conciliation', () => {
  it('classe les statuts métier dans les cinq vues de la maquette', () => {
    expect(categorieDossier(attente)).toBe('attente');
    expect(categorieDossier(raffinage)).toBe('raffinage');
    expect(categorieDossier(litige)).toBe('litige');
    expect(categorieDossier(concilie)).toBe('concilies');
  });

  it('filtre sur les relations issues de la base et la période de vente', () => {
    expect(filtrerDossiers([attente, raffinage], {
      recherche: 'Raffinerie Africaine',
      societe: 'mine-1',
      acheteur: 'customer-1',
      debut: '2026-08-01',
      fin: '2026-08-27',
      vue: 'attente',
    })).toEqual([attente]);
  });

  it('recherche sans être sensible aux accents ni aux espaces superflus', () => {
    const dossierAccentue = dossier('39', 'en_attente_analyse', {
      mining_company: { id: 'mine-2', name: 'Société\u00a0  Minière de Kalsaka', code: 'SMK' },
      mining_company_id: 'mine-2',
    });

    expect(filtrerDossiers([dossierAccentue], {
      recherche: '  societe   miniere  ',
      societe: 'toutes',
      acheteur: 'tous',
      debut: '',
      fin: '',
      vue: 'attente',
    })).toEqual([dossierAccentue]);
  });

  it('ne mélange pas silencieusement des montants de devises différentes', () => {
    const xof = dossier('40', 'en_attente_analyse', { ca_initial: 900_000, devise_initiale: 'XOF' });
    expect(resumerMontants([attente, xof])).toEqual({ valeur: null, devise: null, multiDevises: true });
    expect(formatMontant(900_000, 'XOF')).toContain('900');
    expect(formatMontant(900_000, 'XOF')).toContain('FCFA');
  });
});

describe('ConciliationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lister.mockResolvedValue([attente, raffinage, litige, concilie]);
    mocks.ventesConciliables.mockResolvedValue([]);
    mocks.exportWorkbook.mockResolvedValue(undefined);
  });

  it('reproduit la vue dossiers avec des données relationnelles réelles', async () => {
    render(<ConciliationsPage />);

    expect(await screen.findByText('VE-OR-2026-00038')).toBeInTheDocument();
    expect(screen.getAllByText('SONASP Plateau-Central').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Raffinerie Africaine').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeInTheDocument();

    const onglets = within(screen.getByRole('navigation', { name: 'États des dossiers' }));
    expect(onglets.getByRole('button', { name: /En raffinage 1/ })).toBeInTheDocument();
    expect(onglets.getByRole('button', { name: /En litige 1/ })).toBeInTheDocument();
  });

  it('n’impose aucune période silencieuse et affiche les 16 dossiers en attente', async () => {
    const seizeDossiers = Array.from({ length: 16 }, (_, index) => {
      const item = dossier(String(index + 1), 'en_attente_analyse');
      return {
        ...item,
        sale: {
          ...item.sale!,
          sale_date: index < 13 ? `2025-${String((index % 12) + 1).padStart(2, '0')}-08` : `2026-08-${String(19 + index - 13).padStart(2, '0')}`,
        },
      };
    });
    mocks.lister.mockResolvedValue(seizeDossiers);

    render(<ConciliationsPage />);

    expect(await screen.findByText('VE-OR-2026-00001')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Voir les détails' })).toHaveLength(16);
    expect(screen.getByText('Affichage 1 à 16 sur 16 dossiers')).toBeInTheDocument();
    expect(screen.getByLabelText('Date de début')).toHaveValue('');
    expect(screen.getByLabelText('Date de fin')).toHaveValue('');
    expect(screen.getByLabelText('Nombre de dossiers par page')).toHaveValue('40');

    const onglets = within(screen.getByRole('navigation', { name: 'États des dossiers' }));
    expect(onglets.getByRole('button', { name: /En attente de conciliation 16/ })).toBeInTheDocument();
  });

  it('pagine tous les dossiers, exporte le périmètre complet et revient à la première page après filtrage', async () => {
    const quaranteEtUnDossiers = Array.from(
      { length: 41 },
      (_, index) => dossier(String(index + 1), 'en_attente_analyse'),
    );
    mocks.lister.mockResolvedValue(quaranteEtUnDossiers);

    render(<ConciliationsPage />);

    expect(await screen.findByText('VE-OR-2026-00001')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Voir les détails' })).toHaveLength(40);

    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(await screen.findByText('VE-OR-2026-00041')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    await waitFor(() => expect(mocks.exportWorkbook).toHaveBeenCalledTimes(1));
    expect(mocks.exportWorkbook.mock.calls[0][0][0].rows).toHaveLength(41);

    fireEvent.change(screen.getByLabelText('Rechercher une vente'), { target: { value: '00001' } });
    expect(await screen.findByText('VE-OR-2026-00001')).toBeInTheDocument();
    expect(screen.getByText('Affichage 1 à 1 sur 1 dossier')).toBeInTheDocument();
  });

  it('synchronise les compteurs, la liste et la réinitialisation avec les filtres actifs', async () => {
    const ancien = dossier('34', 'en_attente_analyse');
    ancien.sale = { ...ancien.sale!, sale_date: '2025-07-10' };
    const recent = dossier('38', 'en_attente_analyse');
    recent.sale = { ...recent.sale!, sale_date: '2026-08-21' };
    const recentRaffinage = dossier('37', 'analyse_recue');
    recentRaffinage.sale = { ...recentRaffinage.sale!, sale_date: '2026-08-08' };
    mocks.lister.mockResolvedValue([ancien, recent, recentRaffinage]);

    render(<ConciliationsPage />);
    expect(await screen.findByText('VE-OR-2026-00034')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2026-08-31' } });

    const onglets = within(screen.getByRole('navigation', { name: 'États des dossiers' }));
    expect(onglets.getByRole('button', { name: /En attente de conciliation 1/ })).toBeInTheDocument();
    expect(onglets.getByRole('button', { name: /En raffinage 1/ })).toBeInTheDocument();
    expect(onglets.getByRole('button', { name: /Toutes les ventes 2/ })).toBeInTheDocument();
    expect(screen.queryByText('VE-OR-2026-00034')).not.toBeInTheDocument();
    expect(screen.getByText('Affichage 1 à 1 sur 1 dossier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filtres 2/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtres 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(await screen.findByText('VE-OR-2026-00034')).toBeInTheDocument();
    expect(onglets.getByRole('button', { name: /En attente de conciliation 2/ })).toBeInTheDocument();
    expect(screen.getByText('Affichage 1 à 2 sur 2 dossiers')).toBeInTheDocument();
  });

  it('change de file de travail et ouvre le détail', async () => {
    render(<ConciliationsPage />);
    await screen.findByText('VE-OR-2026-00038');

    fireEvent.click(screen.getByRole('button', { name: /En raffinage 1/ }));
    expect(await screen.findByText('VE-OR-2026-00037')).toBeInTheDocument();
    expect(screen.queryByText('VE-OR-2026-00038')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voir les détails' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/conciliation/37');
  });

  it('actualise depuis Supabase sans dupliquer les dossiers', async () => {
    render(<ConciliationsPage />);
    await screen.findByText('VE-OR-2026-00038');

    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(mocks.lister).toHaveBeenCalledTimes(2));
  });
});
