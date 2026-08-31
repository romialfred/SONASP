import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionalPortalPage } from './InstitutionalPortalPage';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  responsibilities: ['dgmg.supervise'] as string[],
  user: {
    id: 'institution-user',
    role: 'dgmg',
    is_active: true,
    organization_id: 'dgmg-organization',
    organization_type: 'dgmg',
    module_codes: ['dashboard', 'mining_sites', 'artisan-minier', 'production'],
  },
  organization: { name: 'Institution de test', organization_type: 'dgmg' },
  failingCountTable: null as string | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      ...mocks.user,
      responsibilities: mocks.responsibilities,
      capabilities: mocks.responsibilities,
    },
  }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));

vi.mock('@/components/ui/sn', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/sn')>('@/components/ui/sn');
  return {
    ...actual,
    PageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) => (
      <header><h1>{title}</h1><p>{subtitle}</p>{actions}</header>
    ),
    Section: ({ children, title }: { children: ReactNode; title: string }) => <section><h2>{title}</h2>{children}</section>,
  };
});

function membershipBuilder() {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        organization_id: mocks.user.organization_id,
        snp_organizations: mocks.organization,
      },
      error: null,
    }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  return builder;
}

describe('portails institutionnels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.responsibilities = ['dgmg.supervise'];
    mocks.user = {
      id: 'institution-user',
      role: 'dgmg',
      is_active: true,
      organization_id: 'dgmg-organization',
      organization_type: 'dgmg',
      module_codes: ['dashboard', 'mining_sites', 'artisan-minier', 'production'],
    };
    mocks.organization = { name: 'Institution de test', organization_type: 'dgmg' };
    mocks.failingCountTable = null;
    mocks.rpc.mockResolvedValue({ data: [{ id: 'fiscal-payment' }], error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'snp_user_organization_memberships') return membershipBuilder();
      return {
        select: vi.fn().mockResolvedValue(
          table === mocks.failingCountTable
            ? { count: null, error: { message: 'lecture refusée' } }
            : { count: 3, error: null },
        ),
      };
    });
  });

  it('ouvre les espaces DGMG sans fonction financière', async () => {
    render(<MemoryRouter><InstitutionalPortalPage portal="dgmg" /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Portail DGMG' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registre des sites/ })).toHaveAttribute('href', '/artisan-sites');
    expect(screen.getByRole('link', { name: /Productions déclarées/ })).toHaveAttribute('href', '/production/daily');
    expect(screen.queryByRole('link', { name: /Paiements et soldes/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('3')).toHaveLength(3));
  });

  it('ouvre les espaces de contrôle fiscal DGI', async () => {
    mocks.responsibilities = ['dgi.fiscal.control'];
    mocks.user = {
      id: 'institution-user',
      role: 'dgi',
      is_active: true,
      organization_id: 'dgi-organization',
      organization_type: 'dgi',
      module_codes: ['dashboard', 'production', 'artisan_gold_market', 'conciliation'],
    };
    mocks.organization = { name: 'Perception spécialisée DGI', organization_type: 'dgi' };
    render(<MemoryRouter><InstitutionalPortalPage portal="dgi" /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Portail DGI' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ventes déclarées/ })).toHaveAttribute('href', '/artisan-minier/ventes-or');
    expect(screen.getByRole('link', { name: /Paiements fiscaux/ })).toHaveAttribute('href', '/portail-dgi/paiements');
    expect(screen.getByRole('link', { name: /Règles fiscales/ })).toHaveAttribute('href', '/conciliation/regles-fiscales');
    await waitFor(() => expect(screen.getByText('dgi.fiscal.control')).toBeInTheDocument());
    expect(mocks.from).toHaveBeenCalledWith('snp_artisan_ventes_or');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_dgi_lister_paiements_fiscaux', {
      p_limit: 200,
      p_offset: 0,
    });
    expect(mocks.from).not.toHaveBeenCalledWith('snp_artisan_paiements');
    expect(mocks.from).not.toHaveBeenCalledWith('snp_ventes_or_artisanales');
    expect(screen.getByText('Perception spécialisée DGI')).toBeInTheDocument();
  });

  it('échoue fermé sans rattachement correspondant au portail et ne lit aucune table métier', async () => {
    mocks.user = {
      id: 'institution-user',
      role: 'dgi',
      is_active: true,
      organization_id: 'dgmg-organization',
      organization_type: 'dgmg',
      module_codes: ['dashboard'],
    };
    mocks.responsibilities = ['dgi.fiscal.control'];

    render(<MemoryRouter><InstitutionalPortalPage portal="dgi" /></MemoryRouter>);

    expect(await screen.findByText(/rattachement institutionnel.*incompatible/i)).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('n’affiche et ne charge que les espaces couverts par les modules DGI attribués', async () => {
    mocks.responsibilities = ['dgi.fiscal.control'];
    mocks.user = {
      id: 'institution-user',
      role: 'dgi',
      is_active: true,
      organization_id: 'dgi-organization',
      organization_type: 'dgi',
      module_codes: ['dashboard', 'conciliation'],
    };
    mocks.organization = { name: 'Perception spécialisée DGI', organization_type: 'dgi' };

    render(<MemoryRouter><InstitutionalPortalPage portal="dgi" /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /Règles fiscales/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Conciliations/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ventes déclarées/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Paiements fiscaux/ })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.from).toHaveBeenCalledWith('snp_regles_fiscales'));
    expect(mocks.from).not.toHaveBeenCalledWith('snp_artisan_ventes_or');
    expect(mocks.from).not.toHaveBeenCalledWith('snp_artisan_paiements');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('propose la file Réserve DGMG sans exposer le registre patrimonial', async () => {
    mocks.responsibilities = ['dgmg.supervise', 'reserve.allocations.validate_level_1'];
    mocks.user = {
      id: 'institution-user', role: 'dgmg', is_active: true,
      organization_id: 'dgmg-organization', organization_type: 'dgmg',
      module_codes: ['dashboard', 'national_reserve'],
    };

    render(<MemoryRouter><InstitutionalPortalPage portal="dgmg" /></MemoryRouter>);

    expect(await screen.findByRole('link', { name: /Validations Réserve/ })).toHaveAttribute(
      'href', '/portail-dgmg/reserve-validations',
    );
    expect(screen.queryByRole('link', { name: /Réserve physique/ })).not.toBeInTheDocument();
  });

  it('signale un indicateur refusé sans transformer l’absence de visibilité en zéro', async () => {
    mocks.failingCountTable = 'daily_production';

    render(<MemoryRouter><InstitutionalPortalPage portal="dgmg" /></MemoryRouter>);

    expect(await screen.findByText('Indisponible')).toBeInTheDocument();
    expect(screen.getByText(/Certains indicateurs ne sont pas disponibles/)).toBeInTheDocument();
  });
});
