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
