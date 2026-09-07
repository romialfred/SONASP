import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountTypeFor, canAccessPrivateRoute } from '@/lib/routeAccessRegistry';
import type { UserProfile } from '@/types/auth';
import { PORTAL_THEMES } from './portalThemes';
import { institutionLogo, NATIONAL_ARMS_LOGO, usePortalBrand } from './usePortalBrand';
import { PortalBrandPair } from './PortalBrandPair';

const mocks = vi.hoisted(() => ({ read: vi.fn(), dossier: vi.fn(), url: vi.fn(), organization: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: () => mocks.read(id) }) }) }),
  rpc: (...args: unknown[]) => mocks.organization(...args),
} }));
vi.mock('@/services/comptoirService', () => ({ comptoirService: { get: mocks.dossier, url: mocks.url } }));
const profile = (overrides: Partial<UserProfile>) => ({ id: 'user-a', role: 'owner', is_active: true, mining_company_id: null, ...overrides } as UserProfile);

describe('Identité et thème des portails', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.dossier.mockResolvedValue({ documents: [] }); });

  it.each([
    ['owner', null, null, [], 'admin'], ['admin', null, null, [], 'admin'],
    ['management', null, null, [], 'sonasp'], ['manager', null, null, [], 'direction'],
    ['dgi', 'org-dgi', 'dgi', ['dgi.fiscal.control'], 'dgi'],
    ['dgmg', 'org-dgmg', 'dgmg', ['dgmg.supervise'], 'dgmg'],
    ['comptoir', 'org-cpt', 'comptoir', ['comptoir.manage'], 'comptoir'],
    ['collector', 'org-cpt', 'comptoir', ['collector.operate'], 'collector'],
    ['customer', null, null, ['customer.operate'], 'customer'],
    ['factory', null, null, ['factory.operate'], 'factory'],
    ['airport', null, null, ['airport.operate'], 'airport'],
    ['refinery', null, null, ['refinery.operate'], 'refinery'],
  ])('résout le thème du compte autorisé %s', (role, organization_id, organization_type, capabilities, expected) => {
    const user = profile({ role, organization_id, organization_type, capabilities } as Partial<UserProfile>);
    expect(PORTAL_THEMES[accountTypeFor(user)].id).toBe(expected);
    expect(PORTAL_THEMES[accountTypeFor({ ...user, is_active: false })].id).toBe('unknown');
  });

  it('ne transforme pas une couleur de portail en autorisation', () => {
    const mine = profile({ role: 'mine', mining_company_id: 'mine-a', capabilities: ['mine.operate'] });
    expect(PORTAL_THEMES[accountTypeFor(mine)].id).toBe('mine');
    expect(canAccessPrivateRoute(mine, '/users')).toBe(false);
    expect(accountTypeFor({ ...mine, capabilities: [] })).toBe('unknown');
    expect(accountTypeFor(profile({ role: 'dgi', organization_id: 'org', organization_type: 'comptoir', capabilities: ['dgi.fiscal.control'] }))).toBe('unknown');
  });

  it('ignore une réponse tardive de l’ancien organisme', async () => {
    let resolveA: (value: unknown) => void = () => {};
    mocks.read.mockImplementation((id: string) => id === 'org-a'
      ? new Promise(resolve => { resolveA = resolve; })
      : Promise.resolve({ data: { id, code: 'B', name: 'Comptoir B', organization_type: 'comptoir' }, error: null }));
    const { result, rerender } = renderHook(({ id }) => usePortalBrand(profile({ organization_id: id }), 'comptoir'), { initialProps: { id: 'org-a' } });
    rerender({ id: 'org-b' });
    await waitFor(() => expect(result.current.name).toBe('Comptoir B'));
    await act(async () => resolveA({ data: { id: 'org-a', name: 'Comptoir A', code: 'A', organization_type: 'comptoir' }, error: null }));
    expect(result.current.name).toBe('Comptoir B');
    expect(mocks.dossier).not.toHaveBeenCalledWith('org-a');
  });

  it('retire immédiatement l’identité précédente avant la nouvelle réponse', async () => {
    mocks.read.mockResolvedValueOnce({ data: { id: 'a', name: 'Comptoir A', code: 'A', organization_type: 'comptoir' }, error: null }).mockImplementationOnce(() => new Promise(() => {}));
    const { result, rerender } = renderHook(({ id }) => usePortalBrand(profile({ organization_id: id }), 'comptoir'), { initialProps: { id: 'a' } });
    await waitFor(() => expect(result.current.name).toBe('Comptoir A'));
    rerender({ id: 'b' });
    expect(result.current.name).toBe('Comptoir');
    expect(result.current.logo).toBeNull();
  });

  it('utilise le dernier logo du dossier autorisé et son service privé existant', async () => {
    mocks.read.mockResolvedValue({ data: { id: 'a', name: 'Comptoir A', code: 'A', organization_type: 'comptoir' }, error: null });
    const latest = { kind: 'logo', path: 'a/logo-new.png', uploaded_at: '2026-09-07' };
    mocks.dossier.mockResolvedValue({ documents: [{ kind: 'logo', path: 'a/logo-old.png', uploaded_at: '2026-01-01' }, latest] });
    mocks.url.mockResolvedValue('https://storage.example.test/signed/a-logo');
    const { result } = renderHook(() => usePortalBrand(profile({ organization_id: 'a' }), 'comptoir'));
    await waitFor(() => expect(result.current.logo).toContain('/signed/a-logo'));
    expect(mocks.dossier).toHaveBeenCalledWith('a');
    expect(mocks.url).toHaveBeenCalledWith(latest);
  });

  it.each(['owner', 'admin'] as const)('conserve les armoiries pour %s même avec un organisme rattaché', (accountType) => {
    const { result } = renderHook(() => usePortalBrand(profile({ role: accountType, organization_id: 'sonasp' }), accountType));
    render(<PortalBrandPair brand={result.current} />);
    expect(screen.getAllByRole('img').map(image => image.getAttribute('src'))).toEqual(['/login-faso/faso-sanama.png', NATIONAL_ARMS_LOGO]);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('résout la SONASP de rattachement du collecteur depuis la session', async () => {
    mocks.organization.mockResolvedValue({ data: 'sonasp-a', error: null });
    mocks.read.mockResolvedValue({ data: { id: 'sonasp-a', name: 'SONASP', code: 'SONASP', organization_type: 'sonasp' }, error: null });
    const { result } = renderHook(() => usePortalBrand(profile({ role: 'collector' }), 'collector'));
    await waitFor(() => expect(result.current.logo).toBe('/sonasp_logo.png'));
    expect(mocks.organization).toHaveBeenCalledWith('snp_current_organization_id');
    expect(mocks.read).toHaveBeenCalledWith('sonasp-a');
  });

  it('utilise aussi le logo du comptoir auquel le collecteur est rattaché', async () => {
    mocks.read.mockResolvedValue({ data: { id: 'cpt', name: 'Comptoir Alpha', code: 'ALPHA', organization_type: 'comptoir' }, error: null });
    mocks.dossier.mockResolvedValue({ documents: [{ kind: 'logo', uploaded_at: '2026-09-07' }] });
    mocks.url.mockResolvedValue('https://storage.example.test/signed/alpha');
    const { result } = renderHook(() => usePortalBrand(profile({ role: 'collector', organization_id: 'cpt' }), 'collector'));
    await waitFor(() => expect(result.current.logo).toBe('https://storage.example.test/signed/alpha'));
    expect(mocks.dossier).toHaveBeenCalledWith('cpt');
  });

  it('affiche les armoiries quand un logo est absent ou inaccessible puis accepte le logo suivant', () => {
    const { rerender } = render(<PortalBrandPair brand={{ name: 'Comptoir Alpha', shortName: 'ALPHA', logo: '/missing.png', source: 'test' }} />);
    fireEvent.error(screen.getByRole('img', { name: 'Comptoir Alpha' }));
    expect(screen.getByRole('img', { name: 'Armoiries du Burkina Faso' })).toHaveAttribute('src', NATIONAL_ARMS_LOGO);
    expect(screen.queryByRole('img', { name: 'SONASP' })).not.toBeInTheDocument();
    expect(institutionLogo('mining_company')).toBeNull();
    rerender(<PortalBrandPair brand={{ name: 'Mine Alpha', shortName: 'ALPHA', logo: null, source: 'test' }} />);
    expect(screen.getByRole('img', { name: 'Armoiries du Burkina Faso' })).toBeInTheDocument();
    rerender(<PortalBrandPair brand={{ name: 'Comptoir Bêta', shortName: 'BÊTA', logo: '/beta.png', source: 'test' }} />);
    expect(screen.getByRole('img', { name: 'Comptoir Bêta' })).toHaveAttribute('src', '/beta.png');
  });
});
