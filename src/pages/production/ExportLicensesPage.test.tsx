import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExportLicensesPage,
  cumulsLicences,
  etatLicence,
  filtrerLicences,
  kilos,
  limiterLicencesAuPerimetre,
  onces,
  tauxUtilisation,
} from './ExportLicensesPage';
import type { ExportLicense } from '@/services/exportLicenseService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAllLicenses: vi.fn(),
  getLicensesByCompany: vi.fn(),
  workspace: {
    isMine: false,
    companyId: null as string | null,
    companyCode: null as string | null,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/exportLicenseService', () => ({
  exportLicenseService: {
    getAllLicenses: mocks.getAllLicenses,
    getLicensesByCompany: mocks.getLicensesByCompany,
  },
}));

vi.mock('@/hooks/useMineWorkspace', () => ({
  useMineWorkspace: () => mocks.workspace,
}));

const MAINTENANT = new Date('2026-08-19T12:00:00Z');

const licence = (partiel: Partial<ExportLicense> & { id: string }): ExportLicense =>
  ({
    license_number: `EXP-${partiel.id}`,
    mining_company_id: 'm1',
    request_date: '2026-01-01',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    issuing_institution: 'Ministère des Mines et de la Géologie',
    authorized_quantity_grams: 450_000,
    used_quantity_grams: 3_680,
    remaining_quantity_grams: 446_320,
    average_sale_price: null,
    status: 'active',
    comments: null,
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    created_by: null,
    updated_by: null,
    mining_company: { id: 'm1', name: 'SEMAFO Boungou Gold Mine', code: 'SBM' },
    ...partiel,
  }) as ExportLicense;

const active = licence({ id: '1' });
const expiree = licence({ id: '2', end_date: '2026-03-31' });
const epuisee = licence({ id: '3', status: 'exhausted', used_quantity_grams: 450_000, remaining_quantity_grams: 0 });
const tendue = licence({ id: '4', used_quantity_grams: 430_000, remaining_quantity_grams: 20_000 });

describe('conversions', () => {
  it('exprime les grammes en kilos et en onces', () => {
    expect(kilos(450_000)).toBe('450,00');
    // Intl emploie l'espace fine insecable comme separateur de milliers.
    expect(onces(31_103.4768)).toBe('1 000,00');
  });
});

describe('tauxUtilisation', () => {
  it('rapporte le consommé à l’autorisé', () => {
    expect(tauxUtilisation(tendue)).toBeCloseTo(95.56, 1);
  });

  it('ne divise pas par zéro', () => {
    // Sans volume autorisé, il n'y a pas de taux : l'écran affiche « — ».
    expect(tauxUtilisation(licence({ id: '5', authorized_quantity_grams: 0 }))).toBeNull();
  });
});

describe('etatLicence', () => {
  it('classe chaque licence par ordre de priorité', () => {
    expect(etatLicence(epuisee, MAINTENANT)).toBe('epuisee');
    expect(etatLicence(expiree, MAINTENANT)).toBe('expiree');
    expect(etatLicence(tendue, MAINTENANT)).toBe('tension');
    expect(etatLicence(active, MAINTENANT)).toBe('active');
  });

  it('fait primer l’épuisement sur l’expiration', () => {
    const deux = licence({ id: '6', status: 'exhausted', end_date: '2026-01-31' });
    expect(etatLicence(deux, MAINTENANT)).toBe('epuisee');
  });
});

describe('filtrerLicences', () => {
  const toutes = [active, expiree, epuisee, tendue];

  it('sépare les quatre vues', () => {
    expect(filtrerLicences(toutes, 'toutes', MAINTENANT)).toHaveLength(4);
    expect(filtrerLicences(toutes, 'actives', MAINTENANT).map((l) => l.id)).toEqual(['1', '4']);
    expect(filtrerLicences(toutes, 'expirees', MAINTENANT).map((l) => l.id)).toEqual(['2']);
    expect(filtrerLicences(toutes, 'epuisees', MAINTENANT).map((l) => l.id)).toEqual(['3']);
  });
});

describe('cumulsLicences', () => {
  it('ne totalise que les licences en cours de validité', () => {
    // Une licence expirée ou épuisée ne représente plus un volume exportable.
    const cumuls = cumulsLicences([active, expiree, epuisee, tendue], MAINTENANT);
    expect(cumuls.actives).toBe(2);
    expect(cumuls.autorise).toBe(900_000);
    expect(cumuls.utilise).toBe(433_680);
    expect(cumuls.disponible).toBe(466_320);
  });
});

describe('limiterLicencesAuPerimetre', () => {
  it('écarte toute licence appartenant à une autre société', () => {
    const autreMine = licence({ id: '8', mining_company_id: 'm2' });
    expect(limiterLicencesAuPerimetre([active, autreMine], 'm1').map((item) => item.id)).toEqual(['1']);
  });
});

describe('ExportLicensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspace.isMine = false;
    mocks.workspace.companyId = null;
    mocks.workspace.companyCode = null;
    mocks.getAllLicenses.mockResolvedValue([active, expiree, epuisee]);
    mocks.getLicensesByCompany.mockResolvedValue([active, expiree, epuisee]);
  });

  it('affiche les cumuls et les fiches', async () => {
    render(<ExportLicensesPage />);

    const indicateurs = within(await screen.findByRole('region', { name: 'Cumuls des licences en cours' }));
    expect(indicateurs.getByText('450,00 kg')).toBeInTheDocument();

    expect(screen.getByText('EXP-1')).toBeInTheDocument();
    expect(screen.getAllByText('SEMAFO Boungou Gold Mine')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Nouvelle licence' })).toBeInTheDocument();
  });

  it('filtre sur les licences en cours', async () => {
    render(<ExportLicensesPage />);
    await screen.findByText('EXP-1');

    fireEvent.click(screen.getByLabelText(/En cours/));

    expect(screen.getByText('EXP-1')).toBeInTheDocument();
    expect(screen.queryByText('EXP-2')).not.toBeInTheDocument();
    expect(screen.queryByText('EXP-3')).not.toBeInTheDocument();
  });

  it('ouvre la fiche au clic', async () => {
    render(<ExportLicensesPage />);
    await screen.findByText('EXP-1');

    fireEvent.click(screen.getByText('EXP-1').closest('.licence') as HTMLElement);
    expect(mocks.navigate).toHaveBeenCalledWith('/production/licenses/1');
  });

  it('annonce l’échec de chargement au lieu de rester vide', async () => {
    // L'échec n'était consigné qu'au journal : l'écran restait muet.
    mocks.getAllLicenses.mockRejectedValue({ message: 'lecture refusée' });
    render(<ExportLicensesPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('lecture refusée'));
    expect(screen.getByText('Aucune licence')).toBeInTheDocument();
  });

  it('n’invente aucun taux sans volume autorisé', async () => {
    mocks.getAllLicenses.mockResolvedValue([licence({ id: '7', authorized_quantity_grams: 0 })]);
    render(<ExportLicensesPage />);

    await screen.findByText('EXP-7');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('charge uniquement le périmètre de la mine et écarte une réponse incohérente', async () => {
    mocks.workspace.isMine = true;
    mocks.workspace.companyId = 'm1';
    mocks.workspace.companyCode = 'SOPAMIB';
    const licenceEssakane = licence({
      id: '9',
      mining_company_id: 'm2',
      license_number: 'EXP-ESK-2026-0001',
      mining_company: { id: 'm2', name: 'Essakane SA', code: 'ESK' },
    });
    mocks.getLicensesByCompany.mockResolvedValue([active, licenceEssakane]);

    render(<ExportLicensesPage />);

    await screen.findByText('EXP-1');
    expect(mocks.getLicensesByCompany).toHaveBeenCalledWith('m1');
    expect(mocks.getAllLicenses).not.toHaveBeenCalled();
    expect(screen.queryByText('EXP-ESK-2026-0001')).not.toBeInTheDocument();
    expect(screen.queryByText('SEMAFO Boungou Gold Mine')).not.toBeInTheDocument();

    const requestButton = screen.getByRole('button', { name: 'Soumettre une demande' });
    expect(screen.queryByRole('button', { name: 'Nouvelle licence' })).not.toBeInTheDocument();
    fireEvent.click(requestButton);
    expect(mocks.navigate).toHaveBeenCalledWith('/production/licenses/new');
  });
});
