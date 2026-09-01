import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile, UserRole } from '@/types/auth';
import { CAPABILITIES } from '@/lib/capabilities';
import PublicLayout from '@/pages/public/PublicLayout';
import { PublicRoute } from './PublicRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { MinePortalGuard, useMinePortalAccess } from './MinePortalGuard';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useCoursOr', () => ({
  useCoursOr: () => ({ cours: null, prixGrammeFcfa: null, derniereMaj: null, chargement: false }),
}));
const mockedUseAuth = vi.mocked(useAuth);

function profile(role: UserRole, overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'account-test', email: 'account@example.test', full_name: 'Compte de test',
    role, mining_company_id: null, phone: null, site_ids: [], is_active: true,
    is_sales_approver: false, two_factor_enabled: true, language: 'fr',
    email_notifications: true, batch_notifications: true, approval_notifications: true,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides,
  };
}

const owner = profile('owner', { capabilities: [], module_codes: [], module_domains: [] });
const scenarios = [
  { name: 'Owner sans droits individuels', user: owner, home: '/dashboard' },
  { name: 'Administrateur', user: profile('admin'), home: '/dashboard' },
  { name: 'SONASP', user: profile('management'), home: '/dashboard' },
  { name: 'Direction consultative', user: profile('manager'), home: '/portail-direction' },
  { name: 'DGI', user: profile('dgi', { organization_id: 'dgi-test', organization_type: 'dgi', capabilities: [CAPABILITIES.DGI_FISCAL_CONTROL] }), home: '/portail-dgi' },
  { name: 'DGMG', user: profile('dgmg', { organization_id: 'dgmg-test', organization_type: 'dgmg', capabilities: ['dgmg.supervise'] }), home: '/portail-dgmg' },
  { name: 'Mine A', user: profile('mine', { mining_company_id: 'mine-a', capabilities: ['mine.operate'] }), home: '/portail-mine' },
  { name: 'Mine B historique', user: profile('customer', { mining_company_id: 'mine-b', capabilities: ['mine.operate'] }), home: '/portail-mine' },
  { name: 'Comptoir', user: profile('comptoir', { capabilities: ['comptoir.manage'] }), home: '/portail-comptoir' },
  { name: 'Collecteur', user: profile('collector', { capabilities: ['collector.operate'] }), home: '/portail-collecteur' },
  { name: 'Collecteur historique cumulant Comptoir', user: profile('customer', { capabilities: ['collector.operate', 'comptoir.manage'] }), home: '/portail-collecteur' },
  { name: 'Usine', user: profile('factory'), home: '/dashboard/factory' },
  { name: 'Aéroport', user: profile('airport'), home: '/dashboard/airport' },
  { name: 'Raffinerie', user: profile('refinery'), home: '/dashboard/refinery' },
  { name: 'Client', user: profile('customer'), home: '/dashboard/customer' },
];
const homes = [...new Set(scenarios.map(({ home }) => home))];
const portalLinkName = /^(Portail SONASP|SONASP Portal)$/;

function Workspace({ path }: { path: string }) {
  return <div data-testid="workspace">{path}</div>;
}

function MineWorkspace() {
  const { companyId, canChooseCompany } = useMinePortalAccess();
  return <div data-testid="workspace" data-company={companyId} data-can-choose={canChooseCompany}>/portail-mine</div>;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

// Seule l'identité serveur est simulée ; les liens publics, les redirections et
// les guards sont réels. Aucun appel d'authentification ni accès réseau n'est fait.
function Journey({ user, signedIn = true }: { user: UserProfile; signedIn?: boolean }) {
  const [authenticated, setAuthenticated] = useState(signedIn);
  mockedUseAuth.mockReturnValue({
    user: authenticated ? user : null,
    session: authenticated ? { access_token: 'test-session' } as never : null,
    loading: false, initialized: true, profileLoading: false, profileError: null,
    refreshProfile: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), resetPassword: vi.fn(), updatePassword: vi.fn(),
  });

  return <>
    <LocationProbe />
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<div>Accueil public</div>} />
      </Route>
      <Route path="/login" element={<PublicRoute><button onClick={() => setAuthenticated(true)}>Connexion de test</button></PublicRoute>} />
      {homes.map((path) => <Route key={path} path={path} element={
        <ProtectedRoute>
          {path === '/portail-mine'
            ? <MinePortalGuard><MineWorkspace /></MinePortalGuard>
            : <Workspace path={path} />}
        </ProtectedRoute>
      } />)}
    </Routes>
  </>;
}

function expectWorkspace(user: UserProfile, home: string) {
  expect(screen.getByTestId('location')).toHaveTextContent(home);
  expect(screen.getAllByTestId('workspace')).toHaveLength(1);
  expect(screen.getByTestId('workspace')).toHaveTextContent(home);
  expect(screen.queryByText('Portail Mine non attribué')).not.toBeInTheDocument();
  expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument();
  if (home === '/portail-mine') {
    expect(screen.getByTestId('workspace')).toHaveAttribute('data-company', user.mining_company_id);
    expect(screen.getByTestId('workspace')).toHaveAttribute('data-can-choose', 'false');
  } else {
    expect(screen.getByTestId('workspace')).not.toHaveAttribute('data-company');
  }
}

describe('entrée publique → authentification → portail autorisé', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it.each(scenarios)('ouvre le bon espace depuis le bouton Portail SONASP : $name', ({ user, home }) => {
    render(<MemoryRouter initialEntries={['/']}><Journey user={user} /></MemoryRouter>);
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: portalLinkName }));
    expectWorkspace(user, home);
  });

  it.each(scenarios)('respecte le profil après connexion depuis la vitrine : $name', ({ user, home }) => {
    render(<MemoryRouter initialEntries={['/']}><Journey user={user} signedIn={false} /></MemoryRouter>);
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: portalLinkName }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connexion de test' }));
    expectWorkspace(user, home);
  });

  it.each([true, false])('récupère un ancien lien Mine pour Owner (déjà connecté : %s)', (signedIn) => {
    render(<MemoryRouter initialEntries={['/portail-mine?mine=mine-b']}><Journey user={owner} signedIn={signedIn} /></MemoryRouter>);
    if (!signedIn) fireEvent.click(screen.getByRole('button', { name: 'Connexion de test' }));
    expectWorkspace(owner, '/dashboard');
  });

  it.each(['mine-a', 'mine-b'])('ne change jamais de tenant via le lien de retour : %s', (companyId) => {
    const user = profile('mine', { mining_company_id: companyId, capabilities: ['mine.operate'] });
    render(<MemoryRouter initialEntries={['/portail-mine?mine=autre-mine']}><Journey user={user} /></MemoryRouter>);
    expectWorkspace(user, '/portail-mine');
  });

  it('ne transforme pas un paramètre Owner en droit national pour un Client', () => {
    render(<MemoryRouter initialEntries={['/portail-mine?role=owner&mine=mine-a']}><Journey user={profile('customer')} /></MemoryRouter>);
    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
  });

  it('garde fermé un profil Owner incohérent portant un tenant Mine', () => {
    render(<MemoryRouter initialEntries={['/portail-mine']}><Journey user={profile('owner', { mining_company_id: 'mine-a' })} /></MemoryRouter>);
    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
  });
});
